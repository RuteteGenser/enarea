import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DoorOpen, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { displayName } from '@/lib/annotationLabel';
import { openingArea, typeCategoryFor } from '@/lib/openings';
import { nextSelection } from '@/lib/rowSelection';
import { compassPoint, ORIENTATION_NAMES, wallBearing } from '@/lib/wallOrientation';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { useFilesStore } from '@/store/filesStore';
import { useProjectStore } from '@/store/projectStore';
import { useViewportStore } from '@/store/viewportStore';
import type { OpeningItem, PlacedOpening } from '@/types';

const NO_TYPE = 'none';

/** Parses a size typed in mm; undefined for empty or invalid input. */
function parseMm(text: string): number | undefined {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

function MmInput({ value, label, onCommit }: { value: number | undefined; label: string; onCommit: (mm: number | undefined) => void }) {
  const [draft, setDraft] = useState(value ? String(value) : '');
  useEffect(() => setDraft(value ? String(value) : ''), [value]);
  const commit = () => {
    const parsed = parseMm(draft);
    setDraft(parsed ? String(parsed) : '');
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <Input
      inputMode="decimal"
      value={draft}
      placeholder="—"
      aria-label={label}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(value ? String(value) : '');
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className="h-6 w-20 px-1.5 py-0 text-sm tabular-nums"
    />
  );
}

/**
 * The file's windows and doors in Målinger, one line for every placed window/door (Vindu 1 on this wall, Vindu 1
 * on that wall …); a type that isn't placed anywhere gets one line saying so. Rows are selected like in Windows
 * (click, Ctrl+click, Shift+click); a click moves the drawing to the window/door and marks it. Size and type belong
 * to the type, so editing a row changes every window/door of that type, and every type among the selected rows.
 */
export default function OpeningsTable({ openings, placed }: { openings: OpeningItem[]; placed: PlacedOpening[] }) {
  const { projectId } = useParams<{ projectId: string }>();
  const north = useProjectStore((s) => (projectId ? s.getProject(projectId)?.northDirection : undefined)) ?? 0;
  const annotations = useAnnotationStore((s) => s.annotations);
  const types = useBuildingComponentTypeStore((s) => s.types);
  const typesLoaded = useBuildingComponentTypeStore((s) => s.loaded);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);
  const setDialogOpen = useViewportStore((s) => s.setOpeningsDialogOpen);
  const requestJump = useViewportStore((s) => s.requestJump);
  const setHighlighted = useViewportStore((s) => s.setHighlightedOpenings);
  const fileId = useFilesStore((s) => s.activeFileId);
  const setOpenings = useFilesStore((s) => s.setOpenings);

  /** One row per placed copy (in the order of the types), or one row for a type that isn't placed. */
  type Row = { key: string; item: OpeningItem; placement: PlacedOpening | undefined };
  const rows: Row[] = openings.flatMap((item): Row[] => {
    const copies = placed.filter((p) => p.openingId === item.id);
    return copies.length > 0 ? copies.map((p) => ({ key: p.id, item, placement: p })) : [{ key: `type:${item.id}`, item, placement: undefined }];
  });
  const order = rows.map((r) => r.key);

  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  // Rows that were deleted drop out of the selection; Esc clears it.
  useEffect(() => {
    setSelected((current) => (current.every((key) => order.includes(key)) ? current : current.filter((key) => order.includes(key))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- order is derived from openings and placed
  }, [openings, placed]);
  useEffect(() => {
    if (selected.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) {
        setSelected([]);
        setHighlighted([]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected.length, setHighlighted]);
  useEffect(() => () => setHighlighted([]), [setHighlighted]);

  useEffect(() => {
    if (!typesLoaded) void loadTypes();
  }, [typesLoaded, loadTypes]);

  function selectRow(key: string, e: React.MouseEvent) {
    const next = nextSelection(order, { selected, anchor: anchor.current }, key, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
    anchor.current = next.anchor;
    setSelected(next.selected);
    // Mark the picked windows/doors on the drawing and, for a single one, move the view to it.
    const picks = rows.filter((r) => next.selected.includes(r.key) && r.placement);
    const placements = picks.map((r) => r.placement as PlacedOpening);
    setHighlighted(placements.map((p) => p.id));
    const roomIds = [...new Set(placements.map((p) => p.annotationId))];
    useAnnotationStore.getState().setSelectedMany(roomIds);
    if (placements.length === 1 && next.selected.length === 1) requestJump(placements[0].annotationId);
  }

  /** Applies a change to the type of this row, or to the types of all selected rows when this one is part of a multi-selection. */
  function edit(item: OpeningItem, key: string, patch: Partial<OpeningItem>, sameKindOnly = false) {
    if (!fileId) return;
    const multi = selected.length > 1 && selected.includes(key);
    const targets = new Set(multi ? rows.filter((r) => selected.includes(r.key)).map((r) => r.item.id) : [item.id]);
    void setOpenings(
      fileId,
      openings.map((o) => (targets.has(o.id) && (!sameKindOnly || o.kind === item.kind) ? { ...o, ...patch } : o)),
      placed,
    );
  }

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-2 py-0.5">
        <h3 className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <DoorOpen className="size-3" /> Vinduer og dører ({placed.length}
          {selected.length > 1 && `, ${selected.length} valgt`})
        </h3>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setDialogOpen(true)}>
          <SquarePen className="size-3" /> Rediger
        </Button>
      </div>
      <table className="w-full select-none border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Navn', 'Bredde (mm)', 'Høyde (mm)', 'Areal', 'Type', 'U-verdi', 'Rom', 'Vegg', 'Himmelretning'].map((title) => (
              <th key={title} className="sticky top-0 z-10 bg-panel shadow-[0_1px_0_0_var(--border)] whitespace-nowrap px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ key, item, placement }) => {
            const type = types.find((t) => t.id === item.typeId);
            const area = openingArea(item);
            const room = placement ? annotations.find((a) => a.id === placement.annotationId) : undefined;
            const bearing = room && placement ? wallBearing(room, placement.edgeIndex, north) : undefined;
            const options = types.filter((t) => t.category === typeCategoryFor(item.kind));
            return (
              <tr
                key={key}
                onClick={(e) => selectRow(key, e)}
                className={cn('cursor-pointer border-b border-border/50 transition-colors', selected.includes(key) ? 'bg-accent' : 'hover:bg-secondary/60')}
              >
                <td className="px-2 py-1 text-foreground">{item.name}</td>
                <td className="px-2 py-1">
                  <MmInput value={item.widthMm} label={`Bredde ${item.name}`} onCommit={(mm) => edit(item, key, { widthMm: mm })} />
                </td>
                <td className="px-2 py-1">
                  <MmInput value={item.heightMm} label={`Høyde ${item.name}`} onCommit={(mm) => edit(item, key, { heightMm: mm })} />
                </td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">
                  {area === undefined ? '--' : `${area.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²`}
                </td>
                <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.typeId ?? NO_TYPE} onValueChange={(id) => edit(item, key, { typeId: id === NO_TYPE ? undefined : id }, true)}>
                    <SelectTrigger className="h-6 min-w-32 px-1.5 py-0 text-sm" aria-label={`Type ${item.name}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_TYPE}>--</SelectItem>
                      {options.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">
                  {type?.uValue !== undefined ? `${type.uValue} W/m²K` : '--'}
                </td>
                <td className="px-2 py-1 text-muted-foreground">{placement ? (room ? displayName(room) : '--') : 'Ikke plassert'}</td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">{placement ? placement.edgeIndex + 1 : '--'}</td>
                <td className="whitespace-nowrap px-2 py-1 text-foreground">
                  {bearing === undefined ? (
                    <span className="text-muted-foreground">--</span>
                  ) : (
                    <>
                      {ORIENTATION_NAMES[compassPoint(bearing)]} <span className="tabular-nums text-muted-foreground">({bearing}°)</span>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
