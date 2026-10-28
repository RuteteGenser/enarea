import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { annotationArea, isPointInPolygon } from '@/lib/geometry';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, Point } from '@/types';

type PeopleToolOverlayProps = {
  zoom: number;
  width: number;
  height: number;
};

/** The smallest visible, unlocked area containing the point (so a room inside a bigger one wins). */
function areaAt(annotations: Annotation[], point: Point): Annotation | undefined {
  return annotations
    .filter((a) => a.type !== 'line' && a.visible && !a.locked)
    .filter((a) => [a.points, ...(a.regions ?? [])].some((ring) => isPointInPolygon(point, ring)))
    .sort((a, b) => annotationArea(a) - annotationArea(b))[0];
}

/** Click inside an area to add a person to it; Shift+click removes one. */
export default function PeopleToolOverlay({ zoom, width, height }: PeopleToolOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);

  function toPdf(e: ReactMouseEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  function handleMouseMove(e: ReactMouseEvent) {
    if (isSpaceDown) return;
    const p = toPdf(e);
    setCursor(p);
    setHoveredId(areaAt(annotations, p)?.id ?? null);
  }

  function handleClick(e: ReactMouseEvent) {
    if (isSpaceDown || e.button !== 0) return;
    const target = areaAt(annotations, toPdf(e));
    if (!target) return;
    const next = Math.max(0, (target.people ?? 0) + (e.shiftKey ? -1 : 1));
    updateAnnotation(target.id, { people: next > 0 ? next : undefined });
  }

  const hovered = annotations.find((a) => a.id === hoveredId);

  return (
    <svg
      ref={svgRef}
      className={cn('absolute inset-0', !isSpaceDown && 'cursor-copy')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        setHoveredId(null);
        setCursor(null);
      }}
      onClick={handleClick}
    >
      {hovered &&
        [hovered.points, ...(hovered.regions ?? [])].map((ring, i) => (
          <polygon
            key={i}
            points={ring.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
            fill="#8e4ec6"
            fillOpacity={0.15}
            stroke="#8e4ec6"
            strokeWidth={2}
          />
        ))}

      {hovered && cursor && (
        <g transform={`translate(${cursor.x * zoom + 14}, ${cursor.y * zoom - 14})`} className="pointer-events-none">
          <rect x={0} y={-14} width={92} height={20} rx={4} className="fill-card/95 stroke-border" />
          <text x={46} y={0} textAnchor="middle" fontSize={11} className="select-none fill-foreground" style={{ fontWeight: 500 }}>
            {`+1 person (${hovered.people ?? 0})`}
          </text>
        </g>
      )}
    </svg>
  );
}
