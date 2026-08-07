import { useState } from 'react';
import { Eye, EyeOff, Hexagon, Lock, Plus, Slash, Square, Trash2, Unlock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import BuildingComponentPicker from '@/components/material/BuildingComponentPicker';
import { useAnnotationStore } from '@/store/annotationStore';
import { cn } from '@/lib/utils';
import { formatArea, formatLength, metersPerUnit } from '@/lib/calibration';
import { distance, polygonArea } from '@/lib/geometry';
import { displayName } from '@/lib/annotationLabel';
import { ANNOTATION_COLORS } from '@/types';
import type { Annotation, AnnotationColor, Calibration, Unit } from '@/types';

const TYPE_ICON = { line: Slash, rectangle: Square, polygon: Hexagon } as const;

const COLOR_ORDER: AnnotationColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'black'];

type MeasurementRowProps = {
  annotation: Annotation;
  selected: boolean;
  unit: Unit;
  calibration: Calibration;
  onSelect: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onColorChange: (color: AnnotationColor) => void;
  onToggleLock: () => void;
  onToggleVisible: () => void;
};

export default function MeasurementRow({
  annotation,
  selected,
  unit,
  calibration,
  onSelect,
  onDelete,
  onRename,
  onColorChange,
  onToggleLock,
  onToggleVisible,
}: MeasurementRowProps) {
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(annotation.name ?? '');
  const [pickerOpen, setPickerOpen] = useState(false);

  const mpu = metersPerUnit(calibration);
  const value =
    annotation.type === 'line'
      ? formatLength(distance(annotation.points[0], annotation.points[1]) * mpu, unit)
      : formatArea(polygonArea(annotation.points) * mpu * mpu, unit);

  const Icon = TYPE_ICON[annotation.type];

  function commitRename() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== annotation.name) onRename(draft.trim());
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={cn(
        'group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
        selected ? 'bg-accent' : 'hover:bg-secondary/60',
        !annotation.visible && 'opacity-50',
      )}
    >
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.stopPropagation()}
            className="size-3.5 shrink-0 rounded-full ring-1 ring-black/10"
            style={{ backgroundColor: ANNOTATION_COLORS[annotation.color] }}
            title="Endre farge"
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1.5">
            {COLOR_ORDER.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                className={cn(
                  'size-6 rounded-full ring-1 ring-black/10 transition-transform hover:scale-110',
                  c === annotation.color && 'ring-2 ring-primary ring-offset-1',
                )}
                style={{ backgroundColor: ANNOTATION_COLORS[c] }}
              />
            ))}
          </div>
        </PopoverContent>
      </Popover>

      <Icon className="size-3.5 shrink-0 text-muted-foreground" />

      {editing ? (
        <Input
          autoFocus
          value={draft}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') {
              setDraft(annotation.name ?? '');
              setEditing(false);
            }
          }}
          className="h-6 flex-1 px-1.5 py-0 text-sm"
        />
      ) : (
        <span
          className="flex-1 truncate text-foreground"
          onDoubleClick={(e) => {
            e.stopPropagation();
            setDraft(annotation.name ?? '');
            setEditing(true);
          }}
        >
          {displayName(annotation)}
        </span>
      )}

      <span className="shrink-0 tabular-nums text-muted-foreground">{value}</span>

      {annotation.buildingComponent?.uValue !== undefined && (
        <span className="shrink-0 text-xs text-muted-foreground">{annotation.buildingComponent.uValue} W/m²K</span>
      )}

      {annotation.type !== 'line' && !annotation.buildingComponent && (
        <BuildingComponentPicker
          categories={['gulv', 'dekke']}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          onSelect={(next) => {
            if (next) updateAnnotation(annotation.id, { buildingComponent: next });
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

      <div className="flex shrink-0 items-center opacity-0 group-hover:opacity-100">
        <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onToggleVisible(); }}>
          {annotation.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onToggleLock(); }}>
          {annotation.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
