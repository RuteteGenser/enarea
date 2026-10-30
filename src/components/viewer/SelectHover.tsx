import { splitWall } from '@/lib/splitWall';
import { useAnnotationStore } from '@/store/annotationStore';
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
  armed: string | null;
  onHover: (key: string | null) => void;
  onArm: (key: string | null) => void;
};

/**
 * Outer walls in the Velg tool: hover highlights one and a click marks it (red). The Delete key then
 * removes the wall marking (Ctrl+Z brings it back). A selected wall is blue, not red.
 */
export function WallDeleteLayer({ annotations, zoom, hovered, armed, onHover, onArm }: WallDeleteLayerProps) {
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
          const key = `${annotation.id}:${i}`;
          const isHovered = hovered === key;
          const isArmed = armed === key;
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
                  onArm(key);
                }}
              />
              {isArmed && len >= 40 && (
                <WallButtons
                  x={(a.x + b.x) / 2}
                  y={(a.y + b.y) / 2}
                  onSplit={() => {
                    onArm(null);
                    splitWall(annotation.id, i);
                  }}
                  onRemove={() => {
                    onArm(null);
                    useAnnotationStore
                      .getState()
                      .setEdgeMeta(annotation.id, i, { wallType: undefined, orientation: undefined, buildingComponent: undefined });
                  }}
                />
              )}
              {(isHovered || isArmed) && (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke={isArmed ? '#0091ff' : '#f5a623'}
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.85}
                  pointerEvents="none"
                />
              )}
            </g>
          );
        });
      })}
    </g>
  );
}

/** The + (split the wall in two) and − (remove the wall marking) buttons on a selected wall. */
function WallButtons({ x, y, onSplit, onRemove }: { x: number; y: number; onSplit: () => void; onRemove: () => void }) {
  const button = (dx: number, title: string, onClick: () => void, minus: boolean) => (
    <g
      transform={`translate(${x + dx}, ${y})`}
      className="cursor-pointer"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <title>{title}</title>
      <circle r={9} className={minus ? 'fill-destructive' : 'fill-primary'} />
      <line x1={-3.5} y1={0} x2={3.5} y2={0} stroke="white" strokeWidth={1.5} />
      {!minus && <line x1={0} y1={-3.5} x2={0} y2={3.5} stroke="white" strokeWidth={1.5} />}
    </g>
  );
  return (
    <g>
      {button(-12, 'Del veggen i to', onSplit, false)}
      {button(12, 'Fjern veggmarkeringen', onRemove, true)}
    </g>
  );
}
