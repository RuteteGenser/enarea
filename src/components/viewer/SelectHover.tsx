import type { Annotation } from '@/types';

/** Light outline of the room under the pointer in the Velg tool. */
export function HoverOutline({ annotation, zoom }: { annotation: Annotation | undefined; zoom: number }) {
  if (!annotation || annotation.type === 'line') return null;
  return (
    <g pointerEvents="none">
      {[annotation.points, ...(annotation.regions ?? [])].map((ring, i) => (
        <polygon
          key={i}
          points={ring.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
          fill="none"
          stroke="#0091ff"
          strokeWidth={3}
          strokeLinejoin="round"
          opacity={0.55}
        />
      ))}
    </g>
  );
}

const END_INSET_PX = 8; // keeps the corner handles clickable

type WallDeleteLayerProps = {
  annotations: Annotation[];
  zoom: number;
  hovered: string | null;
  onHover: (key: string | null) => void;
  onDelete: (annotationId: string, edgeIndex: number) => void;
};

/** Marked outer walls: hover highlights one in red with an ×, click removes the wall marking (Ctrl+Z brings it back). */
export function WallDeleteLayer({ annotations, zoom, hovered, onHover, onDelete }: WallDeleteLayerProps) {
  return (
    <g>
      {annotations.map((annotation) => {
        if (annotation.type === 'line' || !annotation.visible || annotation.locked) return null;
        return annotation.points.map((p, i) => {
          if (annotation.edges?.[i]?.wallType !== 'external') return null;
          const q = annotation.points[(i + 1) % annotation.points.length];
          const a = { x: p.x * zoom, y: p.y * zoom };
          const b = { x: q.x * zoom, y: q.y * zoom };
          const len = Math.hypot(b.x - a.x, b.y - a.y);
          if (len < 3 * END_INSET_PX) return null;
          const ux = (b.x - a.x) / len;
          const uy = (b.y - a.y) / len;
          const a2 = { x: a.x + ux * END_INSET_PX, y: a.y + uy * END_INSET_PX };
          const b2 = { x: b.x - ux * END_INSET_PX, y: b.y - uy * END_INSET_PX };
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const key = `${annotation.id}:${i}`;
          const isHovered = hovered === key;
          return (
            <g key={key}>
              <line
                x1={a2.x}
                y1={a2.y}
                x2={b2.x}
                y2={b2.y}
                stroke="transparent"
                strokeWidth={12}
                className="cursor-pointer"
                onMouseEnter={() => onHover(key)}
                onMouseLeave={() => onHover(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(annotation.id, i);
                }}
              />
              {isHovered && (
                <g pointerEvents="none">
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#dc2626" strokeWidth={5} strokeLinecap="round" opacity={0.85} />
                  <g transform={`translate(${mid.x}, ${mid.y})`}>
                    <circle r={9} fill="white" stroke="#dc2626" strokeWidth={1.5} />
                    <line x1={-3.5} y1={-3.5} x2={3.5} y2={3.5} stroke="#dc2626" strokeWidth={2} strokeLinecap="round" />
                    <line x1={-3.5} y1={3.5} x2={3.5} y2={-3.5} stroke="#dc2626" strokeWidth={2} strokeLinecap="round" />
                  </g>
                </g>
              )}
            </g>
          );
        });
      })}
    </g>
  );
}
