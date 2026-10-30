import { useState } from 'react';
import { midpoint } from '@/lib/geometry';
import EdgeContextMenu from '@/components/wall/EdgeContextMenu';
import { cn } from '@/lib/utils';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, EdgeMeta, Point } from '@/types';

type SelectionHandlesProps = {
  annotation: Annotation;
  points: Point[];
  zoom: number;
  /** Corner that was clicked once and now shows a red X; another click removes it. */
  armedIndex: number | null;
  onVertexMouseDown: (index: number, e: React.MouseEvent) => void;
  onInsertPoint: (edgeIndex: number) => void;
  onEdgeMetaChange: (edgeIndex: number, meta: EdgeMeta) => void;
};

export default function SelectionHandles({
  annotation,
  points,
  zoom,
  armedIndex,
  onVertexMouseDown,
  onInsertPoint,
  onEdgeMetaChange,
}: SelectionHandlesProps) {
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [hoveredVertex, setHoveredVertex] = useState<number | null>(null);
  const isShiftDown = useViewportStore((s) => s.isShiftDown);

  if (annotation.locked) return null;

  const screenPoints = points.map((p) => ({ x: p.x * zoom, y: p.y * zoom }));
  const isClosedShape = annotation.type !== 'line';
  const edgeCount = isClosedShape ? points.length : points.length - 1;
  const minPoints = annotation.type === 'line' ? 2 : 3;
  const canDeleteVertex = points.length > minPoints;

  return (
    <g>
      {isClosedShape &&
        Array.from({ length: edgeCount }).map((_, i) => {
          const aScreen = screenPoints[i];
          const bScreen = screenPoints[(i + 1) % screenPoints.length];
          const mid = midpoint(aScreen, bScreen);
          const edgeMeta = annotation.edges?.[i] ?? {};
          return (
            <EdgeContextMenu key={i} edge={edgeMeta} onChange={(meta) => onEdgeMetaChange(i, meta)}>
              <g>
                <line
                  x1={aScreen.x}
                  y1={aScreen.y}
                  x2={bScreen.x}
                  y2={bScreen.y}
                  stroke="transparent"
                  strokeWidth={14}
                  onMouseEnter={() => setHoveredEdge(i)}
                  onMouseLeave={() => setHoveredEdge((current) => (current === i ? null : current))}
                />
                {hoveredEdge === i && (
                  <g
                    className="cursor-copy"
                    onMouseEnter={() => setHoveredEdge(i)}
                    onClick={(e) => {
                      e.stopPropagation();
                      onInsertPoint(i);
                    }}
                  >
                    <circle cx={mid.x} cy={mid.y} r={8} className="fill-primary" />
                    <line x1={mid.x - 3.5} y1={mid.y} x2={mid.x + 3.5} y2={mid.y} stroke="white" strokeWidth={1.5} />
                    <line x1={mid.x} y1={mid.y - 3.5} x2={mid.x} y2={mid.y + 3.5} stroke="white" strokeWidth={1.5} />
                  </g>
                )}
              </g>
            </EdgeContextMenu>
          );
        })}

      {screenPoints.map((p, i) => {
        const showDeleteHint = isShiftDown && canDeleteVertex && hoveredVertex === i;
        if (armedIndex === i) {
          return (
            <g key={i} className="cursor-pointer" onMouseDown={(e) => onVertexMouseDown(i, e)}>
              <circle cx={p.x} cy={p.y} r={9} fill="white" stroke="#dc2626" strokeWidth={1.5} />
              <line x1={p.x - 4.5} y1={p.y - 4.5} x2={p.x + 4.5} y2={p.y + 4.5} stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />
              <line x1={p.x - 4.5} y1={p.y + 4.5} x2={p.x + 4.5} y2={p.y - 4.5} stroke="#dc2626" strokeWidth={2.5} strokeLinecap="round" />
            </g>
          );
        }
        return (
          <rect
            key={i}
            x={p.x - 5}
            y={p.y - 5}
            width={10}
            height={10}
            className={cn(
              'cursor-pointer',
              showDeleteHint ? 'fill-destructive stroke-destructive' : 'fill-background stroke-primary',
            )}
            strokeWidth={2}
            onMouseEnter={() => setHoveredVertex(i)}
            onMouseLeave={() => setHoveredVertex((current) => (current === i ? null : current))}
            onMouseDown={(e) => onVertexMouseDown(i, e)}
          />
        );
      })}
    </g>
  );
}
