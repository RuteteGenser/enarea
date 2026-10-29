import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import { metersPerUnit } from '@/lib/calibration';
import { annotationArea, isPointInPolygon } from '@/lib/geometry';
import { ADJACENT_GAP_METERS, outerSides } from '@/lib/wallAuto';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, Calibration, Point } from '@/types';

type WallAutoOverlayProps = {
  zoom: number;
  width: number;
  height: number;
  calibration: Calibration;
};

/** Automatic wall tool: click a room and every outer side becomes an external wall (sides shared with a neighbour are skipped). */
export default function WallAutoOverlay({ zoom, width, height, calibration }: WallAutoOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const gap = ADJACENT_GAP_METERS / metersPerUnit(calibration);
  const rooms = annotations.filter((a) => a.type !== 'line' && a.visible);

  function toPdf(e: ReactMouseEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  /** Smallest room under the point, so a room inside a bigger one wins. */
  function roomAt(point: Point): Annotation | undefined {
    return rooms
      .filter((a) => [a.points, ...(a.regions ?? [])].some((ring) => isPointInPolygon(point, ring)))
      .sort((a, b) => annotationArea(a) - annotationArea(b))[0];
  }

  function handleClick(e: ReactMouseEvent) {
    if (isSpaceDown || e.button !== 0) return;
    const target = roomAt(toPdf(e));
    if (!target) return;
    if (target.locked) {
      toast.warning('Rommet er låst');
      return;
    }

    const outer = outerSides(target, rooms, gap);
    const edges = target.points.map((_, i) => {
      const edge = target.edges?.[i] ?? {};
      if (outer[i]) return { ...edge, wallType: 'external' as const };
      // Shared with a neighbouring room: an internal wall, unless the user already set something.
      return edge.wallType ? edge : { ...edge, wallType: 'internal' as const };
    });
    updateAnnotation(target.id, { edges });

    const count = outer.filter(Boolean).length;
    toast.success(`${count} ${count === 1 ? 'yttervegg' : 'yttervegger'} markert`);
  }

  const hovered = rooms.find((a) => a.id === hoveredId);
  const hoveredOuter = hovered ? outerSides(hovered, rooms, gap) : [];
  const screen = (p: Point) => ({ x: p.x * zoom, y: p.y * zoom });

  return (
    <svg
      ref={svgRef}
      className={cn('absolute inset-0', !isSpaceDown && 'cursor-pointer')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={(e) => !isSpaceDown && setHoveredId(roomAt(toPdf(e))?.id ?? null)}
      onMouseLeave={() => setHoveredId(null)}
      onClick={handleClick}
    >
      {hovered && (
        <g pointerEvents="none">
          <polygon
            points={hovered.points.map((p) => `${screen(p).x},${screen(p).y}`).join(' ')}
            fill="#f5a623"
            fillOpacity={0.08}
          />
          {hovered.points.map((p, i) => {
            const a = screen(p);
            const b = screen(hovered.points[(i + 1) % hovered.points.length]);
            const isOuter = hoveredOuter[i];
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke={isOuter ? '#f5a623' : '#8a8a8a'}
                strokeWidth={isOuter ? 5 : 3}
                strokeDasharray={isOuter ? undefined : '6 4'}
                strokeLinecap="round"
                opacity={0.9}
              />
            );
          })}
        </g>
      )}
    </svg>
  );
}
