import { useState } from 'react';
import { Ruler } from 'lucide-react';
import MeasurementRow from '@/components/panel/MeasurementRow';
import MeasurementWallRow from '@/components/panel/MeasurementWallRow';
import MeasurementGroupHeader from '@/components/panel/MeasurementGroupHeader';
import { useAnnotationStore, type BulkAssignTarget } from '@/store/annotationStore';
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

const UNCATEGORIZED_WALL_KEY = 'uncategorized-wall';
const UNCATEGORIZED_SHAPE_KEY = 'uncategorized-shape';

const FILTERS: { value: FilterValue; label: string }[] = [
  { value: 'all', label: 'Alle' },
  { value: 'yttervegg', label: BUILDING_COMPONENT_CATEGORY_LABELS.yttervegg },
  { value: 'gulv', label: BUILDING_COMPONENT_CATEGORY_LABELS.gulv },
  { value: 'dekke', label: BUILDING_COMPONENT_CATEGORY_LABELS.dekke },
];

function groupKeyFor(entry: PanelEntry): string {
  if (entry.kind === 'wall') return entry.edge.buildingComponent?.typeId ?? UNCATEGORIZED_WALL_KEY;
  return entry.annotation.buildingComponent?.typeId ?? UNCATEGORIZED_SHAPE_KEY;
}

function entryMatchesFilter(entry: PanelEntry, filter: FilterValue): boolean {
  if (filter === 'all') return true;
  if (filter === 'yttervegg') return entry.kind === 'wall';
  if (entry.kind !== 'shape') return false;
  const category = entry.annotation.buildingComponent?.category;
  return category === filter || category === undefined;
}

function entryTarget(entry: PanelEntry): BulkAssignTarget {
  return entry.kind === 'wall'
    ? { annotationId: entry.annotation.id, edgeIndex: entry.edgeIndex }
    : { annotationId: entry.annotation.id };
}

function groupTypeLabel(kind: PanelEntry['kind'], category?: BuildingComponentCategory): string {
  if (kind === 'wall') return 'Vegg';
  if (category === 'gulv') return BUILDING_COMPONENT_CATEGORY_LABELS.gulv;
  if (category === 'dekke') return BUILDING_COMPONENT_CATEGORY_LABELS.dekke;
  return 'Gulv/Dekke';
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
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  function toggleGroup(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const mpu = metersPerUnit(calibration);
  const totalArea = annotations
    .filter((a) => a.type !== 'line')
    .reduce((sum, a) => sum + polygonArea(a.points) * mpu * mpu, 0);

  const lineAnnotations = annotations.filter((a) => a.type === 'line');

  const groups = new Map<string, PanelEntry[]>();
  for (const annotation of annotations) {
    if (annotation.type === 'line') continue;

    const shapeEntry: PanelEntry = { kind: 'shape', annotation };
    if (entryMatchesFilter(shapeEntry, filter)) {
      const key = groupKeyFor(shapeEntry);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(shapeEntry);
    }

    const edges = annotation.edges ?? annotation.points.map(() => ({}) as EdgeMeta);
    edges.forEach((edge, edgeIndex) => {
      const wallEntry: PanelEntry = { kind: 'wall', annotation, edgeIndex, edge };
      if (entryMatchesFilter(wallEntry, filter)) {
        const key = groupKeyFor(wallEntry);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(wallEntry);
      }
    });
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

  const hasAnyContent = annotations.length > 0;

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

      {!hasAnyContent ? (
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
          <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
            {filter === 'all' &&
              lineAnnotations.map((annotation) => (
                <MeasurementRow
                  key={annotation.id}
                  annotation={annotation}
                  selected={annotation.id === selectedId}
                  unit={unit}
                  calibration={calibration}
                  onSelect={() => setSelected(annotation.id)}
                  onDelete={() => deleteAnnotation(annotation.id)}
                  onRename={(name) => updateAnnotation(annotation.id, { name })}
                  onColorChange={(color) => updateAnnotation(annotation.id, { color })}
                  onToggleLock={() => toggleLock(annotation.id)}
                  onToggleVisible={() => toggleVisible(annotation.id)}
                />
              ))}

            {groups.size === 0 && lineAnnotations.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                Ingen elementer med denne kategorien ennå.
              </p>
            )}

            {Array.from(groups.entries()).map(([key, groupEntries]) => {
              const isOpen = openGroups.has(key);
              const first = groupEntries[0];

              if (key === UNCATEGORIZED_WALL_KEY || key === UNCATEGORIZED_SHAPE_KEY) {
                const kind = key === UNCATEGORIZED_WALL_KEY ? 'wall' : 'shape';
                const label = `${groupTypeLabel(kind)}: Ukategorisert`;
                const categories: BuildingComponentCategory[] =
                  key === UNCATEGORIZED_WALL_KEY ? ['yttervegg'] : ['gulv', 'dekke'];
                return (
                  <div key={key}>
                    <MeasurementGroupHeader
                      mode="uncategorized"
                      label={label}
                      count={groupEntries.length}
                      open={isOpen}
                      onToggleOpen={() => toggleGroup(key)}
                      categories={categories}
                      targets={groupEntries.map(entryTarget)}
                    />
                    {isOpen && groupEntries.map(renderEntry)}
                  </div>
                );
              }

              const assignment = first.kind === 'wall' ? first.edge.buildingComponent! : first.annotation.buildingComponent!;
              const label = `${groupTypeLabel(first.kind, assignment.category)}: ${assignment.name}`;
              return (
                <div key={key}>
                  <MeasurementGroupHeader
                    mode="assigned"
                    label={label}
                    count={groupEntries.length}
                    open={isOpen}
                    onToggleOpen={() => toggleGroup(key)}
                    typeId={key}
                    category={assignment.category}
                    currentUValue={assignment.uValue}
                    currentWallThickness={assignment.wallThickness}
                  />
                  {isOpen && groupEntries.map(renderEntry)}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
