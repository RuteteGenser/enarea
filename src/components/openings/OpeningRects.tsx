import { useEffect, useState } from 'react';
import { metersPerUnit } from '@/lib/calibration';
import { DEFAULT_OPENING_WIDTH_MM, joinPlacements, placedOpeningRect } from '@/lib/openings';
import { useAnnotationStore } from '@/store/annotationStore';
import { useFilesStore } from '@/store/filesStore';
import type { Calibration, OpeningItem, PlacedOpening } from '@/types';

const KIND_COLORS = { vindu: '#0091ff', dor: '#b45309' } as const;

type OpeningRectsProps = {
  fileId: string;
  /** The window/door types. */
  openings: OpeningItem[];
  /** Where they are placed (one entry per placed copy). */
  placed: PlacedOpening[];
  zoom: number;
  calibration: Calibration;
  /** In the Velg tool a window/door can be grabbed and moved along its wall. */
  movable?: boolean;
};

/** The placed windows and doors of the file, drawn as rectangles on their walls. */
export default function OpeningRects({ fileId, openings, placed, zoom, calibration, movable = false }: OpeningRectsProps) {
  const joined = joinPlacements(openings, placed);
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
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedId(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target instanceof HTMLInputElement)) {
        // Delete removes the selected window/door (and must not also delete the selected area).
        e.preventDefault();
        e.stopImmediatePropagation();
        // Removes this placed copy only; the window/door type stays in the list.
        const file = useFilesStore.getState().getFile(fileId);
        void setOpenings(fileId, file?.openings ?? [], (file?.placedOpenings ?? []).filter((p) => p.id !== selectedId));
        setSelectedId(null);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads the latest list from the store
  }, [selectedId]);

  const dragId = drag?.id;
  useEffect(() => {
    if (!dragId) return;
    const item = joined.find((o) => o.id === dragId);
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
          openings,
          placed.map((p) => (p.id === dragId ? { ...p, t: latest } : p)),
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
      {joined.map((item) => {
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
              fillOpacity={selected ? 0.5 : active ? 0.45 : 0.3}
              stroke={color}
              strokeWidth={selected ? 3 : active ? 3 : 2}
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
