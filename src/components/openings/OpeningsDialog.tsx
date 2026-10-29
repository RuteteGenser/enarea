import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { nextOpeningName, openingArea, OPENING_KIND_LABELS, typeCategoryFor } from '@/lib/openings';
import { createId } from '@/lib/id';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { useFilesStore } from '@/store/filesStore';
import { useViewportStore } from '@/store/viewportStore';
import type { OpeningItem, OpeningKind, PdfFile } from '@/types';

const NO_TYPE = 'none';

type OpeningsDialogProps = { file: PdfFile };

/** Popup panel: add windows/doors (Vindu 1, Dør 3 …), enter width and height and pick the type from the bygningstabell. */
export default function OpeningsDialog({ file }: OpeningsDialogProps) {
  const open = useViewportStore((s) => s.openingsDialogOpen);
  const setOpen = useViewportStore((s) => s.setOpeningsDialogOpen);
  const setOpenings = useFilesStore((s) => s.setOpenings);
  const types = useBuildingComponentTypeStore((s) => s.types);
  const typesLoaded = useBuildingComponentTypeStore((s) => s.loaded);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);

  useEffect(() => {
    if (!typesLoaded) void loadTypes();
  }, [typesLoaded, loadTypes]);

  // Edits are kept in a draft and only written on "Lagre og lukk".
  const saved = file.openings ?? [];
  const [draft, setDraft] = useState<OpeningItem[]>(saved);
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    if (open) setDraft(file.openings ?? []);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only when the dialog opens
  }, [open]);

  const items = draft;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  function save(next: OpeningItem[]) {
    setDraft(next);
  }

  function saveAndClose() {
    void setOpenings(file.id, draft);
    setOpen(false);
  }

  /** Closing with unsaved edits (X, Esc, click outside, Avbryt) asks first. */
  function requestClose() {
    if (dirty) setConfirmOpen(true);
    else setOpen(false);
  }

  function add(kind: OpeningKind) {
    save([...items, { id: createId(), kind, name: nextOpeningName(items, kind) }]);
  }

  function update(id: string, patch: Partial<OpeningItem>) {
    save(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : requestClose())}>
      <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vinduer og dører</DialogTitle>
          <DialogDescription>
            Lag vindu- og dørtyper, skriv inn bredde og høyde i mm og velg type fra bygningstabellen. Hver type kan
            plasseres mange ganger på veggene med plasseringsverktøyet.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 grid gap-2">
          {items.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Ingen vinduer eller dører ennå.</p>}

          {items.length > 0 && (
            <div className="grid grid-cols-[7rem_6rem_6rem_5rem_1fr_2rem] items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Navn</span>
              <span>Bredde (mm)</span>
              <span>Høyde (mm)</span>
              <span>Areal</span>
              <span>Type (bygningstabell)</span>
              <span />
            </div>
          )}

          {items.map((item) => (
            <OpeningRow
              key={item.id}
              item={item}
              typeOptions={types.filter((t) => t.category === typeCategoryFor(item.kind))}
              placedCount={(file.placedOpenings ?? []).filter((p) => p.openingId === item.id).length}
              onChange={(patch) => update(item.id, patch)}
              onDelete={() => save(items.filter((i) => i.id !== item.id))}
            />
          ))}
        </div>

        <div className="mt-2 flex gap-2">
          <Button variant="outline" size="sm" onClick={() => add('vindu')}>
            <Plus /> Legg til vindu
          </Button>
          <Button variant="outline" size="sm" onClick={() => add('dor')}>
            <Plus /> Legg til dør
          </Button>
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={requestClose}>
            Avbryt
          </Button>
          <Button type="button" onClick={saveAndClose}>
            Lagre og lukk
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <ConfirmDialog
      open={confirmOpen}
      title="Forkaste endringer?"
      description="Du har endringer som ikke er lagret. Hvis du lukker nå, går de tapt."
      confirmLabel="Forkast endringer"
      onOpenChange={setConfirmOpen}
      onConfirm={() => setOpen(false)}
    />
    </>
  );
}

type OpeningRowProps = {
  item: OpeningItem;
  typeOptions: { id: string; name: string; uValue?: number }[];
  placedCount: number;
  onChange: (patch: Partial<OpeningItem>) => void;
  onDelete: () => void;
};

function parseMm(text: string): number | undefined {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

function OpeningRow({ item, typeOptions, placedCount, onChange, onDelete }: OpeningRowProps) {
  const [name, setName] = useState(item.name);
  const [width, setWidth] = useState(item.widthMm ? String(item.widthMm) : '');
  const [height, setHeight] = useState(item.heightMm ? String(item.heightMm) : '');
  const typing = useRef(false); // don't overwrite text while it is being typed (e.g. "1." while typing a decimal)

  // Follow changes made elsewhere (the draft being reset when the dialog opens).
  useEffect(() => {
    if (typing.current) return;
    setName(item.name);
    setWidth(item.widthMm ? String(item.widthMm) : '');
    setHeight(item.heightMm ? String(item.heightMm) : '');
  }, [item.name, item.widthMm, item.heightMm]);

  const area = openingArea({ widthMm: parseMm(width), heightMm: parseMm(height) });

  return (
    <div className="grid grid-cols-[7rem_6rem_6rem_5rem_1fr_2rem] items-center gap-2">
      <Input
        value={name}
        onFocus={() => (typing.current = true)}
        onChange={(e) => {
          setName(e.target.value);
          if (e.target.value.trim()) onChange({ name: e.target.value.trim() });
        }}
        onBlur={() => {
          typing.current = false;
          if (!name.trim()) setName(item.name);
        }}
        className="h-8 px-2 text-sm"
        aria-label={`Navn ${OPENING_KIND_LABELS[item.kind]}`}
      />
      <Input
        inputMode="decimal"
        placeholder="1200"
        value={width}
        onFocus={() => (typing.current = true)}
        onChange={(e) => {
          setWidth(e.target.value);
          onChange({ widthMm: parseMm(e.target.value) });
        }}
        onBlur={() => (typing.current = false)}
        className="h-8 px-2 text-sm"
        aria-label={`Bredde ${item.name}`}
      />
      <Input
        inputMode="decimal"
        placeholder="1500"
        value={height}
        onFocus={() => (typing.current = true)}
        onChange={(e) => {
          setHeight(e.target.value);
          onChange({ heightMm: parseMm(e.target.value) });
        }}
        onBlur={() => (typing.current = false)}
        className="h-8 px-2 text-sm"
        aria-label={`Høyde ${item.name}`}
      />
      <span className="text-sm tabular-nums text-muted-foreground">
        {area === undefined ? '--' : `${area.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²`}
      </span>
      <Select value={item.typeId ?? NO_TYPE} onValueChange={(v) => onChange({ typeId: v === NO_TYPE ? undefined : v })}>
        <SelectTrigger className="h-8 text-sm" aria-label={`Type ${item.name}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NO_TYPE}>--</SelectItem>
          {typeOptions.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
              {t.uValue !== undefined ? ` (${t.uValue} W/m²K)` : ''}
            </SelectItem>
          ))}
          {typeOptions.length === 0 && (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">
              Ingen typer i bygningstabellen ennå ({item.kind === 'vindu' ? 'Vindu' : 'Ytterdør'}).
            </div>
          )}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        title={placedCount > 0 ? `Slett (fjerner også ${placedCount} plasserte)` : 'Slett'}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
