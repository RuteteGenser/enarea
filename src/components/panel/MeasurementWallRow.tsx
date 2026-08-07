import { useState } from 'react';
import { BrickWall, Plus } from 'lucide-react';
import BuildingComponentPicker from '@/components/material/BuildingComponentPicker';
import { useAnnotationStore } from '@/store/annotationStore';
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
  const setEdgeMeta = useAnnotationStore((s) => s.setEdgeMeta);
  const [pickerOpen, setPickerOpen] = useState(false);

  const mpu = metersPerUnit(calibration);
  const a = annotation.points[edgeIndex];
  const b = annotation.points[(edgeIndex + 1) % annotation.points.length];
  const length = formatLength(distance(a, b) * mpu, unit);
  const assignment = edge.buildingComponent;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={cn(
        'group flex items-center gap-2 rounded-md py-1.5 pl-6 pr-2 text-sm transition-colors',
        selected ? 'bg-accent' : 'hover:bg-secondary/60',
      )}
    >
      <BrickWall className="size-3.5 shrink-0 text-muted-foreground" />
      <span className={cn('flex-1 truncate', assignment ? 'text-foreground' : 'text-muted-foreground')}>
        {assignment?.name ?? 'Ukategorisert vegg'}
      </span>
      <span className="shrink-0 tabular-nums text-muted-foreground">{length}</span>
      {assignment?.uValue !== undefined && (
        <span className="shrink-0 text-xs text-muted-foreground">{assignment.uValue} W/m²K</span>
      )}
      {!assignment && (
        <BuildingComponentPicker
          categories={['yttervegg']}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(next) => {
            if (next) setEdgeMeta(annotation.id, edgeIndex, { buildingComponent: next });
          }}
        >
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 hover:bg-secondary group-hover:opacity-100"
            title="Tilordne type"
          >
            <Plus className="size-3.5" />
          </button>
        </BuildingComponentPicker>
      )}
    </div>
  );
}
