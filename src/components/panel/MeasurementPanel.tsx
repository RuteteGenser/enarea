import { useState, type ReactNode } from 'react';
import { Ruler } from 'lucide-react';
import MeasurementRow from '@/components/panel/MeasurementRow';
import MeasurementWallRow from '@/components/panel/MeasurementWallRow';
import BuildingComponentGroupHeader from '@/components/panel/BuildingComponentGroupHeader';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import { formatArea, metersPerUnit } from '@/lib/calibration';
import { polygonArea } from '@/lib/geometry';
import { cn } from '@/lib/utils';
import { BUILDING_COMPONENT_CATEGORY_LABELS } from '@/types';
import type { Annotation, BuildingComponentCategory, Calibration, EdgeMeta } from '@/types';

type MeasurementPanelProps = {
  calibration: Calibration;
};

type PanelEntry =
  | { kind: 'shape'; annotation: Annotation }
  | { kind: 'wall'; annotation: Annotation; edgeIndex: number; edge: EdgeMeta };

type FilterValue = 'all' | 'yttervegg' | 'gulv' | 'dekke';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'yttervegg', label: BUILDING_COMPONENT_CATEGORY_LABELS.yttervegg },
  { value: 'gulv', label: BUILDING_COMPONENT_CATEGORY_LABELS.gulv },
  { value: 'dekke', label: BUILDING_COMPONENT_CATEGORY_LABELS.dekke },
];

function entryCategory(entry: PanelEntry): BuildingComponentCategory | undefined {
  return entry.kind === 'wall' ? entry.edge.buildingComponent?.category : entry.annotation.buildingComponent?.category;
}

function entryTypeId(entry: PanelEntry): string | undefined {
  return entry.kind === 'wall' ? entry.edge.buildingComponent?.typeId : entry.annotation.buildingComponent?.typeId;
}

export default function MeasurementPanel({ calibration }: MeasurementPanelProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const selectedId = useAnnotationStore((s) => s.selectedId);
  const setSelected = useAnnotationStore((s) => s.setSelected);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const toggleLock = useAnnotationStore((s) => s.toggleLock);
  const toggleVisible = useAnnotationStore((s) => s.toggleVisible);
  const unit = useViewportStore((s) => s.unit);

  const [filter, setFilter] = useState<FilterValue>('all');

  const mpu = metersPerUnit(calibration);
  const totalArea = annotations
    .filter((a) => a.type !== 'line')
    .reduce((sum, a) => sum + polygonArea(a.points) * mpu * mpu, 0);

  const entries: PanelEntry[] = [];
  for (const annotation of annotations) {
    entries.push({ kind: 'shape', annotation });
    if (annotation.type !== 'line') {
      annotation.edges?.forEach((edge, edgeIndex) => {
        if (edge.buildingComponent) entries.push({ kind: 'wall', annotation, edgeIndex, edge });
      });
    }
  }

  function renderEntry(entry: PanelEntry) {
    if (entry.kind === 'shape') {
      return (
        <MeasurementRow
          key={entry.annotation.id}
          annotation={entry.annotation}
          selected={entry.annotation.id === selectedId}
          unit={unit}
          calibration={calibration}
          onSelect={() => setSelected(entry.annotation.id)}
          onDelete={() => deleteAnnotation(entry.annotation.id)}
          onRename={(name) => updateAnnotation(entry.annotation.id, { name })}
          onColorChange={(color) => updateAnnotation(entry.annotation.id, { color })}
          onToggleLock={() => toggleLock(entry.annotation.id)}
          onToggleVisible={() => toggleVisible(entry.annotation.id)}
        />
      );
    }
    return (
      <MeasurementWallRow
        key={`${entry.annotation.id}:${entry.edgeIndex}`}
        annotation={entry.annotation}
        edgeIndex={entry.edgeIndex}
        edge={entry.edge}
        selected={entry.annotation.id === selectedId}
        unit={unit}
        calibration={calibration}
        onSelect={() => setSelected(entry.annotation.id)}
      />
    );
  }

  let content: ReactNode;

  if (filter === 'all') {
    content = entries.map(renderEntry);
  } else {
    const filtered = entries.filter((e) => entryCategory(e) === filter);
    const groups = new Map<string, PanelEntry[]>();
    for (const entry of filtered) {
      const typeId = entryTypeId(entry);
      if (!typeId) continue;
      if (!groups.has(typeId)) groups.set(typeId, []);
      groups.get(typeId)!.push(entry);
    }

    content =
      groups.size === 0 ? (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">
          Ingen elementer med denne kategorien ennå.
        </p>
      ) : (
        Array.from(groups.entries()).map(([typeId, groupEntries]) => {
          const first = groupEntries[0];
          const assignment = first.kind === 'wall' ? first.edge.buildingComponent! : first.annotation.buildingComponent!;
          return (
            <div key={typeId}>
              <BuildingComponentGroupHeader
                typeId={typeId}
                name={assignment.name}
                category={assignment.category}
                count={groupEntries.length}
                currentUValue={assignment.uValue}
                currentWallThickness={assignment.wallThickness}
              />
              {groupEntries.map(renderEntry)}
            </div>
          );
        })
      );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Målinger {annotations.length > 0 && `(${annotations.length})`}
        </h2>
        {totalArea > 0 && (
          <span className="text-xs font-medium text-foreground">Totalt {formatArea(totalArea, unit)}</span>
        )}
      </div>

      {annotations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <Ruler className="size-5" />
          Ingen målinger ennå. Velg et verktøy i toolbaren for å starte.
        </div>
      ) : (
        <>
          <div className="flex shrink-0 items-center gap-1 border-b border-border px-2 py-1.5">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFilter(f.value)}
                className={cn(
                  'rounded-md px-2 py-1 text-xs font-medium transition-colors',
                  filter === f.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">{content}</div>
        </>
      )}
    </div>
  );
}
