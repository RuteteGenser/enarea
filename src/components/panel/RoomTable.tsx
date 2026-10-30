import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Eye, EyeOff, Lock, Search, Trash2, TriangleAlert, Unlock } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BuildingComponentPicker from '@/components/material/BuildingComponentPicker';
import RoomTemplatePicker from '@/components/roomTemplate/RoomTemplatePicker';
import { useAnnotationStore } from '@/store/annotationStore';
import { useProjectStore } from '@/store/projectStore';
import { useParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatArea, metersPerUnit } from '@/lib/calibration';
import { annotationArea } from '@/lib/geometry';
import { createId } from '@/lib/id';
import { ventilationBreakdown, ventilationTotal } from '@/lib/ventilation';
import { markersForPeople } from '@/lib/personMarkers';
import { AREA_TYPES, areaTypeForCategory, findAreaType } from '@/lib/areaTypes';
import { formatOpeningArea, openingsSummary } from '@/lib/wallOpenings';
import { displayName } from '@/lib/annotationLabel';
import { applyRoomNameAndMatch } from '@/lib/roomTemplateMatch';
import { distinctWallTypeNames } from '@/lib/wallTypesSummary';
import { ANNOTATION_COLORS, VENTILATION_UNIT_LABELS } from '@/types';
import type { Annotation, AnnotationColor, Calibration, OpeningItem, Unit } from '@/types';

const NO_AREA_TYPE = 'none';

/** Distance between person icons put in the middle of a room, in meters. */
const PERSON_SPACING_METERS = 0.7;

const COLOR_ORDER: AnnotationColor[] = ['red', 'blue', 'green', 'yellow', 'purple', 'black'];

type ColumnKey = 'romnr' | 'rom' | 'romtype' | 'area' | 'arealtype' | 'personer' | 'gulvdekke' | 'veggtype' | 'vinduer' | 'luftmengde';

const COLUMNS: { key: ColumnKey; label: string }[] = [
  { key: 'romnr', label: 'Nr' },
  { key: 'rom', label: 'Navn' },
  { key: 'romtype', label: 'Romtype' },
  { key: 'area', label: 'Kvadratmeter' },
  { key: 'arealtype', label: 'Arealtype' },
  { key: 'personer', label: 'Personer' },
  { key: 'gulvdekke', label: 'Type gulv/dekke' },
  { key: 'veggtype', label: 'Type vegg' },
  { key: 'vinduer', label: 'Vindu/dør' },
  { key: 'luftmengde', label: 'Luftmengde' },
];

type MissingFilter = 'alle' | 'romnr' | 'romnavn' | 'romtype' | 'gulvdekke' | 'veggtype' | 'luftmengde';

const MISSING_FILTERS: { value: MissingFilter; label: string }[] = [
  { value: 'alle', label: 'Alle rom' },
  { value: 'romnr', label: 'Mangler romnr' },
  { value: 'romnavn', label: 'Mangler romnavn' },
  { value: 'romtype', label: 'Mangler romtype' },
  { value: 'gulvdekke', label: 'Mangler gulv/dekke' },
  { value: 'veggtype', label: 'Mangler veggtype' },
  { value: 'luftmengde', label: 'Mangler luftmengde' },
];

function sortValue(annotation: Annotation, key: ColumnKey, mpu: number, openingItems: OpeningItem[]): string | number {
  switch (key) {
    case 'rom':
      return displayName(annotation).toLowerCase();
    case 'romnr':
      return annotation.roomNumber?.toLowerCase() ?? '';
    case 'area':
      return annotationArea(annotation) * mpu * mpu;
    case 'romtype':
      return annotation.roomTemplate?.name.toLowerCase() ?? '';
    case 'arealtype':
      return findAreaType(annotation.areaType)?.label.toLowerCase() ?? '';
    case 'personer':
      return annotation.people ?? -1;
    case 'gulvdekke':
      return annotation.buildingComponent?.name.toLowerCase() ?? '';

    case 'veggtype':
      return distinctWallTypeNames(annotation).join(', ').toLowerCase();
    case 'vinduer':
      return openingsSummary(annotation, openingItems).area || -1;
    case 'luftmengde': {
      const t = annotation.roomTemplate;
      if (!t) return -1;
      const total = ventilationTotal(t.ventilationRate, t.ventilationUnit, annotationArea(annotation) * mpu * mpu, annotation.people, t.perPersonRate);
      return total ?? t.ventilationRate ?? -1;
    }
  }
}

function isMissing(annotation: Annotation, filter: MissingFilter): boolean {
  if (filter === 'romnr') return !annotation.roomNumber?.trim();
  if (filter === 'romnavn') return !annotation.name?.trim();
  if (filter === 'romtype') return !annotation.roomTemplate;
  if (filter === 'gulvdekke') return !annotation.buildingComponent;
  if (filter === 'veggtype') return distinctWallTypeNames(annotation).length === 0;
  if (filter === 'luftmengde') return !annotation.roomTemplate;
  return true;
}

type RoomTableProps = {
  annotations: Annotation[];
  selectedIds: string[];
  unit: Unit;
  calibration: Calibration;
  onSelectAndJump: (id: string) => void;
  openings?: OpeningItem[];
};

export default function RoomTable({
  annotations,
  selectedIds,
  unit,
  calibration,
  onSelectAndJump,
  openings = [],
}: RoomTableProps) {
  const [search, setSearch] = useState('');
  const [missingFilter, setMissingFilter] = useState<MissingFilter>('alle');
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const mpu = metersPerUnit(calibration);
  const setSelected = useAnnotationStore((s) => s.setSelected);
  const setSelectedMany = useAnnotationStore((s) => s.setSelectedMany);
  // The row a Shift-range starts from (the last row clicked without Shift).
  const anchorId = useRef<string | null>(null);

  function toggleSort(key: ColumnKey) {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
    }
  }

  /** Windows-style selection: Ctrl toggles one row, Shift selects from the anchor row to this one. */
  function selectRow(id: string, e: React.MouseEvent | React.KeyboardEvent) {
    const ctrl = e.ctrlKey || e.metaKey;
    if (e.shiftKey && anchorId.current) {
      const from = rows.findIndex((r) => r.id === anchorId.current);
      const to = rows.findIndex((r) => r.id === id);
      if (from >= 0 && to >= 0) {
        const range = rows.slice(Math.min(from, to), Math.max(from, to) + 1).map((r) => r.id);
        setSelectedMany(ctrl ? [...new Set([...selectedIds, ...range])] : range);
        return;
      }
    }
    if (ctrl) {
      anchorId.current = id;
      useAnnotationStore.getState().toggleSelected(id);
      return;
    }
    // Clicking a control inside a selected row (to edit all selected rows) must not drop the selection.
    const insideControl = e.target instanceof Element && e.target.closest('input, button, select, [role="combobox"]');
    if (insideControl && selectedIds.length > 1 && selectedIds.includes(id)) return;
    anchorId.current = id;
    setSelected(id);
    onSelectAndJump(id);
  }

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    let filtered = annotations.filter((a) => {
      if (missingFilter !== 'alle' && !isMissing(a, missingFilter)) return false;
      if (!query) return true;
      return displayName(a).toLowerCase().includes(query) || (a.roomNumber ?? '').toLowerCase().includes(query);
    });

    if (sortKey) {
      filtered = [...filtered].sort((a, b) => {
        const va = sortValue(a, sortKey, mpu, openings);
        const vb = sortValue(b, sortKey, mpu, openings);
        const aEmpty = va === '' || va === -1;
        const bEmpty = vb === '' || vb === -1;
        if (aEmpty !== bEmpty) return aEmpty ? 1 : -1;
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }

    return filtered;
  }, [annotations, search, missingFilter, sortKey, sortDir, mpu, openings]);

  return (
    <div className="flex flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Søk rom eller romnr…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-7 text-xs"
          />
        </div>
        <Select value={missingFilter} onValueChange={(v) => setMissingFilter(v as MissingFilter)}>
          <SelectTrigger className="h-7 w-44 shrink-0 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MISSING_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {rows.length === 0 ? (
        <p className="px-2 py-4 text-center text-sm text-muted-foreground">Ingen rom matcher filteret.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map((col) => (
                  <th key={col.key} className="whitespace-nowrap px-2 py-1 text-left">
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                    >
                      {col.label}
                      {sortKey === col.key ? (
                        sortDir === 'asc' ? (
                          <ArrowUp className="size-3" />
                        ) : (
                          <ArrowDown className="size-3" />
                        )
                      ) : (
                        <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
                  </th>
                ))}
                <th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {rows.map((annotation) => (
                <RoomTableRow
                  key={annotation.id}
                  annotation={annotation}
                  selected={selectedIds.includes(annotation.id)}
                  unit={unit}
                  mpu={mpu}
                  openingItems={openings}
                  onSelect={(e) => selectRow(annotation.id, e)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type RoomTableRowProps = {
  annotation: Annotation;
  selected: boolean;
  unit: Unit;
  mpu: number;
  openingItems: OpeningItem[];
  onSelect: (e: React.MouseEvent | React.KeyboardEvent) => void;
};

type EditingField = 'rom' | 'romnr' | null;

function RoomTableRow({ annotation, selected, unit, mpu, openingItems, onSelect }: RoomTableRowProps) {
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const batch = useAnnotationStore((s) => s.batch);

  /** The rows an edit applies to: every selected row when this one is part of a multi-selection, else just this one. */
  function targets(): Annotation[] {
    const { annotations, selectedIds } = useAnnotationStore.getState();
    if (selectedIds.length > 1 && selectedIds.includes(annotation.id)) {
      return annotations.filter((a) => selectedIds.includes(a.id) && a.type !== 'line');
    }
    return [annotation];
  }

  /** Applies a patch to all targets as one undo step. */
  function applyToTargets(patchFor: (a: Annotation) => Partial<Annotation>) {
    batch(() => {
      for (const a of targets()) updateAnnotation(a.id, patchFor(a));
    });
  }

  const [editing, setEditing] = useState<EditingField>(null);
  const [draft, setDraft] = useState('');
  const [gulvDekkePickerOpen, setGulvDekkePickerOpen] = useState(false);
  const [roomPickerOpen, setRoomPickerOpen] = useState(false);
  const [peopleDraft, setPeopleDraft] = useState(String(annotation.people ?? ''));

  // Follow changes made elsewhere (the Personer tool, undo/redo).
  useEffect(() => {
    setPeopleDraft(String(annotation.people ?? ''));
  }, [annotation.people]);

  // Rooms made before an area type was stored show the one matching the project's building category.
  const { projectId } = useParams<{ projectId: string }>();
  const defaultAreaType = useProjectStore((s) =>
    areaTypeForCategory(projectId ? s.getProject(projectId)?.buildingCategory : undefined),
  );
  const areaSquareMeters = annotationArea(annotation) * mpu * mpu;

  /** Person icons matching a people count: added in the middle of the room, or removed from the end. */
  function markersFor(target: Annotation, count: number | undefined) {
    return markersForPeople(target, count ?? 0, PERSON_SPACING_METERS / mpu, createId);
  }

  function setPeople(count: number | undefined) {
    applyToTargets((a) => ({ people: count, personMarkers: markersFor(a, count) }));
  }

  function changeAreaType(id: string) {
    const type = findAreaType(id);
    if (!type) {
      // Stored explicitly so the project's default isn't shown again for this room.
      applyToTargets(() => ({ areaType: NO_AREA_TYPE }));
      return;
    }
    // Only the area type is set; the number of people is entered by hand.
    applyToTargets(() => ({ areaType: id }));
  }

  const area = formatArea(areaSquareMeters, unit);

  // Luftmengde = the room type's rate on the floor area, plus the air for the people in the room.
  const template = annotation.roomTemplate;
  const air = template
    ? ventilationTotal(template.ventilationRate, template.ventilationUnit, areaSquareMeters, annotation.people, template.perPersonRate)
    : null;
  const airBreakdown = template
    ? ventilationBreakdown(template.ventilationRate, template.ventilationUnit, areaSquareMeters, annotation.people, template.perPersonRate)
    : null;
  const wallTypes = distinctWallTypeNames(annotation).join(', ');
  const openings = openingsSummary(annotation, openingItems);

  function startEdit(field: EditingField, initial: string) {
    setDraft(initial);
    setEditing(field);
  }

  function commitRom() {
    setEditing(null);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== annotation.name) batch(() => targets().forEach((a) => applyRoomNameAndMatch(a.id, trimmed)));
  }

  function commitRomnr() {
    setEditing(null);
    const trimmed = draft.trim();
    if (trimmed !== (annotation.roomNumber ?? '')) applyToTargets(() => ({ roomNumber: trimmed || undefined }));
  }

  function commitPeople() {
    const parsed = Math.max(0, Math.round(Number(peopleDraft)));
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
    setPeopleDraft(String(next ?? ''));
    if (next !== annotation.people) setPeople(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>, commit: () => void, revertTo: string) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      setDraft(revertTo);
      setEditing(null);
    }
  }

  return (
    <tr
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect(e)}
      className={cn(
        'group select-none border-b border-border/50 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-secondary/60',
        !annotation.visible && 'opacity-50',
      )}
    >
      <td className="px-2 py-1.5">
        {editing === 'romnr' ? (
          <Input
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRomnr}
            onKeyDown={(e) => handleKeyDown(e, commitRomnr, annotation.roomNumber ?? '')}
            className="h-6 w-20 px-1.5 py-0 text-sm"
          />
        ) : (
          <span
            className="block w-20 truncate text-muted-foreground"
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEdit('romnr', annotation.roomNumber ?? '');
            }}
          >
            {annotation.roomNumber || '—'}
          </span>
        )}
      </td>

      <td className="px-2 py-1.5">
        {editing === 'rom' ? (
          <Input
            autoFocus
            value={draft}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRom}
            onKeyDown={(e) => handleKeyDown(e, commitRom, annotation.name ?? '')}
            className="h-6 min-w-32 px-1.5 py-0 text-sm"
          />
        ) : (
          <span
            className="block min-w-32 truncate text-foreground"
            onDoubleClick={(e) => {
              e.stopPropagation();
              startEdit('rom', annotation.name ?? '');
            }}
          >
            {displayName(annotation)}
          </span>
        )}
      </td>

      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <RoomTemplatePicker
          current={annotation.roomTemplate}
          open={roomPickerOpen}
          onOpenChange={setRoomPickerOpen}
          onSelect={(next) => applyToTargets(() => ({ roomTemplate: next ?? undefined }))}
        >
          <button
            type="button"
            className="flex min-w-28 items-center gap-1 truncate text-left hover:underline"
            title={
              annotation.roomTemplate?.matchType === 'fuzzy'
                ? 'Automatisk (usikker) match — klikk for å bekrefte eller endre'
                : 'Klikk for å velge romtype'
            }
          >
            {annotation.roomTemplate?.matchType === 'fuzzy' && <TriangleAlert className="size-3.5 shrink-0 text-amber-500" />}
            <span className={annotation.roomTemplate ? 'text-foreground' : 'text-muted-foreground'}>
              {annotation.roomTemplate?.name ?? '--'}
            </span>
          </button>
        </RoomTemplatePicker>
      </td>

      <td className="px-2 py-1.5 tabular-nums text-muted-foreground">{area}</td>

      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <Select value={annotation.areaType ?? defaultAreaType ?? NO_AREA_TYPE} onValueChange={changeAreaType}>
          <SelectTrigger className="h-6 min-w-32 px-1.5 py-0 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NO_AREA_TYPE}>--</SelectItem>
            {AREA_TYPES.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </td>

      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <Input
          type="number"
          min={0}
          step={1}
          value={peopleDraft}
          placeholder="0"
          onChange={(e) => setPeopleDraft(e.target.value)}
          onBlur={commitPeople}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              setPeopleDraft(String(annotation.people ?? ''));
              e.currentTarget.blur();
            }
          }}
          className="h-6 w-16 px-1.5 py-0 text-sm tabular-nums"
        />
      </td>

      <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
        <BuildingComponentPicker
          categories={['gulv', 'dekke']}
          current={annotation.buildingComponent}
          open={gulvDekkePickerOpen}
          onOpenChange={setGulvDekkePickerOpen}
          onSelect={(next) => applyToTargets(() => ({ buildingComponent: next ?? undefined }))}
        >
          <button
            type="button"
            className={cn('truncate hover:underline', annotation.buildingComponent ? 'text-foreground' : 'text-muted-foreground')}
          >
            {annotation.buildingComponent?.name ?? '—'}
          </button>
        </BuildingComponentPicker>
      </td>

      <td className="px-2 py-1.5 truncate text-muted-foreground">{wallTypes || '—'}</td>

      <td className="px-2 py-1.5 whitespace-nowrap tabular-nums text-muted-foreground">
        {openings.count > 0 ? `${openings.count} · ${formatOpeningArea(openings.area)}` : '--'}
      </td>

      <td
        className="px-2 py-1.5 whitespace-nowrap tabular-nums text-muted-foreground"
        title={airBreakdown ?? undefined}
      >
        {air !== null
          ? `${air.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} m³/h`
          : annotation.roomTemplate?.ventilationRate !== undefined
            ? `${annotation.roomTemplate.ventilationRate} ${VENTILATION_UNIT_LABELS[annotation.roomTemplate.ventilationUnit ?? 'm3h_per_m2']}`
            : '--'}
      </td>

      <td className="px-2 py-1.5">
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100">
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
                    onClick={() => applyToTargets(() => ({ color: c }))}
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
          <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); applyToTargets(() => ({ visible: !annotation.visible })); }}>
            {annotation.visible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); applyToTargets(() => ({ locked: !annotation.locked })); }}>
            {annotation.locked ? <Lock className="size-3.5" /> : <Unlock className="size-3.5" />}
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={(e) => { e.stopPropagation(); batch(() => targets().forEach((a) => deleteAnnotation(a.id))); }}>
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}
