import { useEffect, useRef, useState } from 'react';
import { DoorOpen, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { displayName } from '@/lib/annotationLabel';
import { openingArea, typeCategoryFor } from '@/lib/openings';
import { nextSelection } from '@/lib/rowSelection';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { useFilesStore } from '@/store/filesStore';
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
 * The file's windows and doors in Målinger: Vindu 1, Vindu 2, Dør 1 … with size, type and where they sit.
 * Rows are selected like in Windows (click, Ctrl+click, Shift+click); editing the width, height or type of a
 * selected row changes every selected row (the type only for rows of the same kind: windows or doors).
 */
export default function OpeningsTable({ openings, placed }: { openings: OpeningItem[]; placed: PlacedOpening[] }) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const types = useBuildingComponentTypeStore((s) => s.types);
  const typesLoaded = useBuildingComponentTypeStore((s) => s.loaded);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);
  const setDialogOpen = useViewportStore((s) => s.setOpeningsDialogOpen);
  const fileId = useFilesStore((s) => s.activeFileId);
  const setOpenings = useFilesStore((s) => s.setOpenings);

  const [selected, setSelected] = useState<string[]>([]);
  const anchor = useRef<string | null>(null);
  const order = openings.map((o) => o.id);
  // Rows that were deleted drop out of the selection; Esc clears it.
  useEffect(() => {
    setSelected((current) => (current.every((id) => order.includes(id)) ? current : current.filter((id) => order.includes(id))));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- order is derived from openings
  }, [openings]);
  useEffect(() => {
    if (selected.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !(e.target instanceof HTMLInputElement)) setSelected([]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected.length]);

  useEffect(() => {
    if (!typesLoaded) void loadTypes();
  }, [typesLoaded, loadTypes]);

  function selectRow(id: string, e: React.MouseEvent) {
    const next = nextSelection(order, { selected, anchor: anchor.current }, id, { shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey });
    anchor.current = next.anchor;
    setSelected(next.selected);
  }

  /** Applies a change to this row, or to all selected rows when this one is part of a multi-selection. */
  function edit(item: OpeningItem, patch: Partial<OpeningItem>, sameKindOnly = false) {
    if (!fileId) return;
    const multi = selected.length > 1 && selected.includes(item.id);
    const targets = new Set(multi ? selected : [item.id]);
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
          <DoorOpen className="size-3" /> Vinduer og dører ({openings.length}
          {selected.length > 1 && `, ${selected.length} valgt`})
        </h3>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setDialogOpen(true)}>
          <SquarePen className="size-3" /> Rediger
        </Button>
      </div>
      <table className="w-full select-none border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Navn', 'Bredde (mm)', 'Høyde (mm)', 'Areal', 'Type', 'U-verdi', 'Antall plassert', 'Samlet areal', 'Plassering'].map((title) => (
              <th key={title} className="whitespace-nowrap px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {openings.map((item) => {
            const type = types.find((t) => t.id === item.typeId);
            const area = openingArea(item);
            const mine = placed.filter((p) => p.openingId === item.id);
            const places = mine
              .map((p) => {
                const room = annotations.find((a) => a.id === p.annotationId);
                return room ? `${displayName(room)} v${p.edgeIndex + 1}` : null;
              })
              .filter(Boolean)
              .join(', ');
            const options = types.filter((t) => t.category === typeCategoryFor(item.kind));
            return (
              <tr
                key={item.id}
                onClick={(e) => selectRow(item.id, e)}
                className={cn('cursor-pointer border-b border-border/50 transition-colors', selected.includes(item.id) ? 'bg-accent' : 'hover:bg-secondary/60')}
              >
                <td className="px-2 py-1 text-foreground">{item.name}</td>
                <td className="px-2 py-1">
                  <MmInput value={item.widthMm} label={`Bredde ${item.name}`} onCommit={(mm) => edit(item, { widthMm: mm })} />
                </td>
                <td className="px-2 py-1">
                  <MmInput value={item.heightMm} label={`Høyde ${item.name}`} onCommit={(mm) => edit(item, { heightMm: mm })} />
                </td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">
                  {area === undefined ? '--' : `${area.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²`}
                </td>
                <td className="px-2 py-1" onClick={(e) => e.stopPropagation()}>
                  <Select value={item.typeId ?? NO_TYPE} onValueChange={(id) => edit(item, { typeId: id === NO_TYPE ? undefined : id }, true)}>
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
                <td className="px-2 py-1 tabular-nums text-foreground">{mine.length}</td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">
                  {area === undefined || mine.length === 0
                    ? '--'
                    : `${(area * mine.length).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²`}
                </td>
                <td className="px-2 py-1 text-muted-foreground">{places || 'Ikke plassert'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
