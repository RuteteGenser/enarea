import { formatArea, formatLength, metersPerUnit } from '@/lib/calibration';
import { annotationArea, distance } from '@/lib/geometry';
import { areaLabelPoint } from '@/lib/labelPoint';
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
};

export default function ShapeRenderer({
  annotation,
  points,
  zoom,
  calibration,
  unit,
  selected,
  onSelect,
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
    const squareMeters = annotationArea(annotation, geometryPoints) * mpu * mpu;
    valueLabel = formatArea(squareMeters, unit);
    // The middle of the widest part of the area, so the box is not on an edge (also for L/U shapes).
    const middle = areaLabelPoint(geometryPoints, annotation.regions);
    labelPos = { x: middle.x * zoom, y: middle.y * zoom };
  }

  // A label placed at the click point when a type was assigned (see MaterialPickerOverlay)
  // overrides the computed centroid/midpoint — annotations without one keep the default.
  if (annotation.labelPos) {
    labelPos = { x: annotation.labelPos.x * zoom, y: annotation.labelPos.y * zoom };
  }

  const pointsAttr = screenPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const strokeDasharray = annotation.locked ? '5 3' : undefined;
  // Label lines for an area:  "Romnr Romnavn" / kvadratmeter / personer. Lines have a single value.
  const isArea = annotation.type !== 'line';
  const titleText = isArea ? [annotation.roomNumber, annotation.name].filter(Boolean).join(' ') : (annotation.name ?? '');
  const peopleText = isArea && annotation.people ? `${annotation.people} ${annotation.people === 1 ? 'person' : 'personer'}` : '';
  const labelLines = [
    ...(titleText ? [{ text: titleText, strong: true }] : []),
    { text: valueLabel, strong: !titleText },
    ...(peopleText ? [{ text: peopleText, strong: false }] : []),
  ];
  const LINE_HEIGHT = 14;
  const labelWidth = Math.max(...labelLines.map((l) => l.text.length)) * 6.3 + 14;
  const labelHeight = labelLines.length * LINE_HEIGHT + 8;

  return (
    <g
      className={onSelect ? 'cursor-pointer' : undefined}
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
        <>
          <polygon
            points={pointsAttr}
            fill={color}
            fillOpacity={selected ? 0.18 : 0.1}
            stroke={color}
            strokeWidth={selected ? 3 : 2}
            strokeDasharray={strokeDasharray}
          />
          {annotation.regions?.map((region, i) => (
            <polygon
              key={`region-${i}`}
              points={region.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
              fill={color}
              fillOpacity={selected ? 0.18 : 0.1}
              stroke={color}
              strokeWidth={selected ? 3 : 2}
              strokeDasharray={strokeDasharray}
            />
          ))}
        </>
      )}

      {annotation.type !== 'line' && annotation.edges && (
        <g pointerEvents="none">
          {annotation.edges.map((edge, i) => {
            if (edge.wallType !== 'external') return null;
            const a = screenPoints[i];
            const b = screenPoints[(i + 1) % screenPoints.length];
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };

            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const edgeLen = Math.hypot(dx, dy) || 1;
            let perp = { x: -dy / edgeLen, y: dx / edgeLen };
            const outward = { x: mid.x + perp.x * 10, y: mid.y + perp.y * 10 };
            if (distance(outward, labelPos) < distance(mid, labelPos)) {
              perp = { x: -perp.x, y: -perp.y };
            }
            const wallLabelOffset = 14;
            const wallLabelPos = { x: mid.x + perp.x * wallLabelOffset, y: mid.y + perp.y * wallLabelOffset };
            const wallLength = distance(geometryPoints[i], geometryPoints[(i + 1) % geometryPoints.length]) * mpu;
            const wallLengthText = formatLength(wallLength, unit);
            const wallLabelWidth = wallLengthText.length * 6 + 10;

            return (
              <g key={i}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#f5a623" strokeWidth={4} strokeLinecap="round" opacity={0.85} />
                <g transform={`translate(${wallLabelPos.x}, ${wallLabelPos.y})`}>
                  <rect
                    x={-wallLabelWidth / 2}
                    y={-8}
                    width={wallLabelWidth}
                    height={16}
                    rx={3}
                    className="fill-card/90 stroke-amber-500"
                    strokeWidth={1}
                  />
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    y={0.5}
                    fontSize={10}
                    fontWeight={600}
                    className="select-none fill-amber-700"
                  >
                    {wallLengthText}
                  </text>
                </g>
              </g>
            );
          })}
        </g>
      )}

      {/* The box is centred on the label point. */}
      <g transform={`translate(${labelPos.x}, ${labelPos.y})`}>
        <rect
          x={-labelWidth / 2}
          y={-labelHeight / 2}
          width={labelWidth}
          height={labelHeight}
          rx={4}
          className="fill-card/90 stroke-border"
          strokeWidth={1}
        />
        {labelLines.map((line, i) => (
          <text
            key={i}
            x={0}
            y={-labelHeight / 2 + 4 + LINE_HEIGHT * i + LINE_HEIGHT / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            className={line.strong ? 'select-none fill-foreground' : 'select-none fill-muted-foreground'}
            style={{ fontWeight: line.strong ? 600 : 500 }}
          >
            {line.text}
          </text>
        ))}
      </g>
    </g>
  );
}
