import { formatArea, formatLength, metersPerUnit } from '@/lib/calibration';
import { polygonArea, distance } from '@/lib/geometry';
import { ANNOTATION_COLORS } from '@/types';
import type { Annotation, Calibration, Point, Unit } from '@/types';

type ShapeRendererProps = {
  annotation: Annotation;
  points?: Point[];
  zoom: number;
  calibration: Calibration;
  unit: Unit;
  selected: boolean;
  onSelect?: (id: string) => void;
  onBodyMouseDown?: (e: React.MouseEvent) => void;
};

export default function ShapeRenderer({
  annotation,
  points,
  zoom,
  calibration,
  unit,
  selected,
  onSelect,
  onBodyMouseDown,
}: ShapeRendererProps) {
  if (!annotation.visible) return null;

  const geometryPoints = points ?? annotation.points;
  const color = ANNOTATION_COLORS[annotation.color];
  const screenPoints = geometryPoints.map((p) => ({ x: p.x * zoom, y: p.y * zoom }));
  const mpu = metersPerUnit(calibration);

  let valueLabel = '';
  let labelPos = screenPoints[0] ?? { x: 0, y: 0 };

  if (annotation.type === 'line') {
    const meters = distance(geometryPoints[0], geometryPoints[1]) * mpu;
    valueLabel = formatLength(meters, unit);
    labelPos = {
      x: (screenPoints[0].x + screenPoints[1].x) / 2,
      y: (screenPoints[0].y + screenPoints[1].y) / 2,
    };
  } else {
    const squareMeters = polygonArea(geometryPoints) * mpu * mpu;
    valueLabel = formatArea(squareMeters, unit);
    labelPos = {
      x: screenPoints.reduce((sum, p) => sum + p.x, 0) / screenPoints.length,
      y: screenPoints.reduce((sum, p) => sum + p.y, 0) / screenPoints.length,
    };
  }

  const pointsAttr = screenPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const strokeDasharray = annotation.locked ? '5 3' : undefined;
  const interactive = !!onSelect && !annotation.locked;

  return (
    <g
      className={onSelect ? (annotation.locked ? 'cursor-default' : 'cursor-move') : undefined}
      onMouseDown={(e) => {
        if (interactive && onBodyMouseDown) onBodyMouseDown(e);
      }}
      onClick={(e) => {
        if (!onSelect) return;
        e.stopPropagation();
        onSelect(annotation.id);
      }}
    >
      {annotation.type === 'line' ? (
        <line
          x1={screenPoints[0].x}
          y1={screenPoints[0].y}
          x2={screenPoints[1].x}
          y2={screenPoints[1].y}
          stroke={color}
          strokeWidth={selected ? 3 : 2}
          strokeDasharray={strokeDasharray}
        />
      ) : (
        <polygon
          points={pointsAttr}
          fill={color}
          fillOpacity={selected ? 0.18 : 0.1}
          stroke={color}
          strokeWidth={selected ? 3 : 2}
          strokeDasharray={strokeDasharray}
        />
      )}

      {annotation.type !== 'line' && annotation.edges && (
        <g pointerEvents="none">
          {annotation.edges.map((edge, i) => {
            if (edge.wallType !== 'external') return null;
            const a = screenPoints[i];
            const b = screenPoints[(i + 1) % screenPoints.length];
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f5a623" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
                {edge.orientation && (
                  <g transform={`translate(${mid.x}, ${mid.y})`}>
                    <circle r={9} className="fill-card stroke-amber-500" strokeWidth={1.5} />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={700} className="fill-amber-600 select-none">
                      {edge.orientation}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </g>
      )}

      <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
        <rect
          x={-2}
          y={-19}
          width={annotation.name ? annotation.name.length * 6.2 + valueLabel.length * 6.2 + 20 : valueLabel.length * 6.2 + 12}
          height={20}
          rx={4}
          className="fill-card/90 stroke-border"
          strokeWidth={1}
        />
        <text x={6} y={-4} fontSize={11} className="select-none fill-foreground" style={{ fontWeight: 500 }}>
          {annotation.name ? `${annotation.name}  ` : ''}
          <tspan className="fill-muted-foreground">{valueLabel}</tspan>
        </text>
      </g>
    </g>
  );
}
