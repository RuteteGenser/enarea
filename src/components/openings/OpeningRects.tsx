import { useEffect, useState } from 'react';
import { metersPerUnit } from '@/lib/calibration';
import { DEFAULT_OPENING_WIDTH_MM, placedOpeningRect } from '@/lib/openings';
import { useAnnotationStore } from '@/store/annotationStore';
import { useFilesStore } from '@/store/filesStore';
import type { Calibration, OpeningItem } from '@/types';

const KIND_COLORS = { vindu: '#0091ff', dor: '#b45309' } as const;

type OpeningRectsProps = {
  fileId: string;
  openings: OpeningItem[];
  zoom: number;
  calibration: Calibration;
  /** In the Velg tool a window/door can be grabbed and moved along its wall. */
  movable?: boolean;
};

/** The placed windows and doors of the file, drawn as rectangles on their walls. */
export default function OpeningRects({ fileId, openings, zoom, calibration, movable = false }: OpeningRectsProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const setOpenings = useFilesStore((s) => s.setOpenings);
  const mpu = metersPerUnit(calibration);
  const [drag, setDrag] = useState<{ id: string; t: number; svg: SVGSVGElement } | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  // First click selects a window/door; only a selected one can then be dragged along its wall.
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    const onDown = (e: MouseEvent) => {
      if (!(e.target as Element | null)?.closest?.('[data-opening]')) setSelectedId(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedId(null);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [selectedId]);

  const dragId = drag?.id;
  useEffect(() => {
    if (!dragId) return;
    const item = openings.find((o) => o.id === dragId);
    const place = item?.placement;
    const room = place ? annotations.find((a) => a.id === place.annotationId) : undefined;
    const a = room && place ? room.points[place.edgeIndex] : undefined;
    const b = room && place ? room.points[(place.edgeIndex + 1) % room.points.length] : undefined;
    if (!item || !place || !a || !b) return;

    const widthUnits = (item.widthMm ?? DEFAULT_OPENING_WIDTH_MM) / 1000 / mpu;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const half = Math.min(0.5, widthUnits / 2 / len);
    let latest = place.t;

    function tAt(e: MouseEvent, svg: SVGSVGElement): number {
      const box = svg.getBoundingClientRect();
      const px = (e.clientX - box.left) / zoom;
      const py = (e.clientY - box.top) / zoom;
      const raw = ((px - a!.x) * (b!.x - a!.x) + (py - a!.y) * (b!.y - a!.y)) / (len * len);
      return Math.min(1 - half, Math.max(half, raw)); // stays on the wall
    }

    function onMove(e: MouseEvent) {
      latest = tAt(e, drag!.svg);
      setDrag((d) => (d ? { ...d, t: latest } : d));
    }
    function finish(commit: boolean) {
      if (commit && Math.abs(latest - place!.t) > 1e-6) {
        void setOpenings(
          fileId,
          openings.map((o) => (o.id === dragId && o.placement ? { ...o, placement: { ...o.placement, t: latest } } : o)),
        );
      }
      setDrag(null);
    }
    const onUp = () => finish(true);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- set up once per drag
  }, [dragId]);

  return (
    <g>
      {openings.map((item) => {
        const live = drag?.id === item.id && item.placement ? { ...item, placement: { ...item.placement, t: drag.t } } : item;
        const rect = placedOpeningRect(live, annotations, mpu);
        if (!rect) return null;
        const color = KIND_COLORS[item.kind];
        const selected = movable && selectedId === item.id;
        const active = movable && (hoveredId === item.id || drag?.id === item.id || selected);
        return (
          <g
            key={item.id}
            pointerEvents={movable ? 'all' : 'none'}
            data-opening
            className={movable ? (drag ? 'cursor-grabbing' : selected ? 'cursor-grab' : 'cursor-pointer') : undefined}
            onMouseEnter={() => movable && setHoveredId(item.id)}
            onMouseLeave={() => setHoveredId((id) => (id === item.id ? null : id))}
            onMouseDown={(e) => {
              if (!movable || e.button !== 0) return;
              e.stopPropagation();
              if (selectedId !== item.id) {
                setSelectedId(item.id); // first click only selects
                return;
              }
              const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
              if (svg) setDrag({ id: item.id, t: item.placement?.t ?? 0.5, svg });
            }}
            onClick={(e) => movable && e.stopPropagation()}
          >
            <polygon
              points={rect.corners.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
              fill={color}
              fillOpacity={active ? 0.55 : 0.35}
              stroke={color}
              strokeWidth={active ? 3 : 2}
              strokeDasharray={selected ? '5 3' : undefined}
              strokeLinejoin="round"
            />
            <text
              x={rect.center.x * zoom}
              y={rect.center.y * zoom - 10}
              textAnchor="middle"
              fontSize={9}
              fontWeight={600}
              fill={color}
              stroke="white"
              strokeWidth={2.5}
              paintOrder="stroke"
              className="select-none"
              pointerEvents="none"
            >
              {item.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
