import { BrickWall } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatLength, metersPerUnit } from '@/lib/calibration';
import { distance } from '@/lib/geometry';
import type { Annotation, Calibration, EdgeMeta, Unit } from '@/types';

type MeasurementWallRowProps = {
  annotation: Annotation;
  edgeIndex: number;
  edge: EdgeMeta;
  selected: boolean;
  unit: Unit;
  calibration: Calibration;
  onSelect: () => void;
};

export default function MeasurementWallRow({
  annotation,
  edgeIndex,
  edge,
  selected,
  unit,
  calibration,
  onSelect,
}: MeasurementWallRowProps) {
  const mpu = metersPerUnit(calibration);
  const a = annotation.points[edgeIndex];
  const b = annotation.points[(edgeIndex + 1) % annotation.points.length];
  const length = formatLength(distance(a, b) * mpu, unit);
  const assignment = edge.buildingComponent!;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={cn(
        'flex items-center gap-2 rounded-md py-1.5 pl-6 pr-2 text-sm transition-colors',
        selected ? 'bg-accent' : 'hover:bg-secondary/60',
      )}
    >
      <BrickWall className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="flex-1 truncate text-foreground">{assignment.name}</span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{length}</span>
      <span className="shrink-0 text-xs text-muted-foreground">
        {assignment.uValue !== undefined ? `${assignment.uValue} W/m²K` : '—'}
      </span>
    </div>
  );
}
