import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { toast } from 'sonner';
import PersonIcon from '@/components/people/PersonIcon';
import { createId } from '@/lib/id';
import { areaAtPoint, withPersonAdded } from '@/lib/personMarkers';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Point } from '@/types';

type PeopleToolOverlayProps = { zoom: number; width: number; height: number };

/** Personer tool: click inside an area to place a person icon at the cursor. Outside an area nothing can be placed. */
export default function PeopleToolOverlay({ zoom, width, height }: PeopleToolOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<Point | null>(null);

  function toPdf(e: ReactMouseEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  const area = cursor ? areaAtPoint(annotations, cursor) : undefined;

  function handleClick(e: ReactMouseEvent) {
    if (isSpaceDown || e.button !== 0) return;
    const point = toPdf(e);
    const target = areaAtPoint(annotations, point);
    if (!target) {
      toast.warning('Personer må plasseres inne i et område');
      return;
    }
    if (target.locked) {
      toast.warning('Området er låst');
      return;
    }
    updateAnnotation(target.id, withPersonAdded(target, point, createId()));
  }

  return (
    <svg
      ref={svgRef}
      className={cn('absolute inset-0', !isSpaceDown && (area ? 'cursor-copy' : 'cursor-not-allowed'))}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={(e) => !isSpaceDown && setCursor(toPdf(e))}
      onMouseLeave={() => setCursor(null)}
      onClick={handleClick}
    >
      {area && cursor && (
        <g pointerEvents="none">
          {[area.points, ...(area.regions ?? [])].map((ring, i) => (
            <polygon
              key={i}
              points={ring.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
              fill="#8e4ec6"
              fillOpacity={0.08}
              stroke="#8e4ec6"
              strokeWidth={2}
            />
          ))}
          <g opacity={0.6}>
            <PersonIcon x={cursor.x * zoom} y={cursor.y * zoom} />
          </g>
        </g>
      )}
    </svg>
  );
}
