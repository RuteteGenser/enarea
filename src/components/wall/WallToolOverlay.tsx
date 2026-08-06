import { useState } from 'react';
import EdgeContextMenu from '@/components/wall/EdgeContextMenu';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, EdgeMeta, Point } from '@/types';

type WallToolOverlayProps = {
  zoom: number;
  width: number;
  height: number;
};

function toScreen(p: Point, zoom: number) {
  return { x: p.x * zoom, y: p.y * zoom };
}

export default function WallToolOverlay({ zoom, width, height }: WallToolOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const setEdgeMeta = useAnnotationStore((s) => s.setEdgeMeta);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const eligible = annotations.filter((a) => a.type !== 'line' && a.visible && !a.locked);

  function toggleWall(annotation: Annotation, edgeIndex: number) {
    if (useViewportStore.getState().isSpaceDown) return;
    const edge = annotation.edges?.[edgeIndex] ?? {};
    if (edge.wallType === 'external') {
      setEdgeMeta(annotation.id, edgeIndex, { wallType: 'internal', orientation: undefined });
    } else {
      setEdgeMeta(annotation.id, edgeIndex, { wallType: 'external' });
    }
  }

  return (
    <svg className="absolute inset-0 cursor-pointer" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {eligible.map((annotation) =>
        annotation.points.map((point, i) => {
          const next = annotation.points[(i + 1) % annotation.points.length];
          const a = toScreen(point, zoom);
          const b = toScreen(next, zoom);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const key = `${annotation.id}:${i}`;
          const edge: EdgeMeta = annotation.edges?.[i] ?? {};
          const isHovered = hoveredKey === key;
          const isExternal = edge.wallType === 'external';

          return (
            <EdgeContextMenu key={key} edge={edge} onChange={(meta) => setEdgeMeta(annotation.id, i, meta)}>
              <g
                onMouseEnter={() => setHoveredKey(key)}
                onMouseLeave={() => setHoveredKey((k) => (k === key ? null : k))}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleWall(annotation, i);
                }}
              >
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} />
                {isHovered && (
                  <>
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="#f5a623"
                      strokeWidth={6}
                      strokeLinecap="round"
                      opacity={0.45}
                      pointerEvents="none"
                    />
                    <g transform={`translate(${mid.x}, ${mid.y})`} pointerEvents="none">
                      <circle r={9} className="fill-primary" />
                      {isExternal ? (
                        <line x1={-3.5} y1={0} x2={3.5} y2={0} stroke="white" strokeWidth={1.5} />
                      ) : (
                        <>
                          <line x1={-3.5} y1={0} x2={3.5} y2={0} stroke="white" strokeWidth={1.5} />
                          <line x1={0} y1={-3.5} x2={0} y2={3.5} stroke="white" strokeWidth={1.5} />
                        </>
                      )}
                    </g>
                  </>
                )}
              </g>
            </EdgeContextMenu>
          );
        }),
      )}
    </svg>
  );
}
