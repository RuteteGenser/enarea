import { metersPerUnit } from '@/lib/calibration';
import { placedOpeningRect } from '@/lib/openings';
import { useAnnotationStore } from '@/store/annotationStore';
import type { Calibration, OpeningItem } from '@/types';

const KIND_COLORS = { vindu: '#0091ff', dor: '#b45309' } as const;

type OpeningRectsProps = { openings: OpeningItem[]; zoom: number; calibration: Calibration };

/** The placed windows and doors of the file, drawn as rectangles on their walls. */
export default function OpeningRects({ openings, zoom, calibration }: OpeningRectsProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const mpu = metersPerUnit(calibration);

  return (
    <g pointerEvents="none">
      {openings.map((item) => {
        const rect = placedOpeningRect(item, annotations, mpu);
        if (!rect) return null;
        const color = KIND_COLORS[item.kind];
        return (
          <g key={item.id}>
            <polygon
              points={rect.corners.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
              fill={color}
              fillOpacity={0.35}
              stroke={color}
              strokeWidth={2}
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
            >
              {item.name}
            </text>
          </g>
        );
      })}
    </g>
  );
}
