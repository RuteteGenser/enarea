import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

  const items = file.openings ?? [];

  function save(next: OpeningItem[]) {
    void setOpenings(file.id, next);
  }

  function add(kind: OpeningKind) {
    save([...items, { id: createId(), kind, name: nextOpeningName(items, kind) }]);
  }

  function update(id: string, patch: Partial<OpeningItem>) {
    save(items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Vinduer og dører</DialogTitle>
          <DialogDescription>
            Legg til vinduer og dører, skriv inn bredde og høyde i mm og velg type fra bygningstabellen. Plasser dem
            på veggene med plasseringsverktøyet.
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
      </DialogContent>
    </Dialog>
  );
}

type OpeningRowProps = {
  item: OpeningItem;
  typeOptions: { id: string; name: string; uValue?: number }[];
  onChange: (patch: Partial<OpeningItem>) => void;
  onDelete: () => void;
};

function parseMm(text: string): number | undefined {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 ? n : undefined;
}

function OpeningRow({ item, typeOptions, onChange, onDelete }: OpeningRowProps) {
  const [name, setName] = useState(item.name);
  const [width, setWidth] = useState(item.widthMm ? String(item.widthMm) : '');
  const [height, setHeight] = useState(item.heightMm ? String(item.heightMm) : '');

  // Follow changes made elsewhere (undo, another row's save).
  useEffect(() => setName(item.name), [item.name]);
  useEffect(() => setWidth(item.widthMm ? String(item.widthMm) : ''), [item.widthMm]);
  useEffect(() => setHeight(item.heightMm ? String(item.heightMm) : ''), [item.heightMm]);

  const area = openingArea({ widthMm: parseMm(width), heightMm: parseMm(height) });

  return (
    <div className="grid grid-cols-[7rem_6rem_6rem_5rem_1fr_2rem] items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name.trim() !== item.name && onChange({ name: name.trim() })}
        className="h-8 px-2 text-sm"
        aria-label={`Navn ${OPENING_KIND_LABELS[item.kind]}`}
      />
      <Input
        inputMode="decimal"
        placeholder="1200"
        value={width}
        onChange={(e) => setWidth(e.target.value)}
        onBlur={() => onChange({ widthMm: parseMm(width) })}
        className="h-8 px-2 text-sm"
        aria-label={`Bredde ${item.name}`}
      />
      <Input
        inputMode="decimal"
        placeholder="1500"
        value={height}
        onChange={(e) => setHeight(e.target.value)}
        onBlur={() => onChange({ heightMm: parseMm(height) })}
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
      <Button variant="ghost" size="icon-sm" onClick={onDelete} title="Slett">
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
