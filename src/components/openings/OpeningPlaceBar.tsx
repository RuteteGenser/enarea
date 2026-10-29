import { ListPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useViewportStore } from '@/store/viewportStore';
import type { PdfFile } from '@/types';

/** Floating bar shown with the placement tool: choose which window/door to place next. */
export default function OpeningPlaceBar({ file }: { file: PdfFile }) {
  const placingId = useViewportStore((s) => s.placingOpeningId);
  const setPlacingId = useViewportStore((s) => s.setPlacingOpeningId);
  const setDialogOpen = useViewportStore((s) => s.setOpeningsDialogOpen);

  const items = file.openings ?? [];
  const current = items.find((i) => i.id === placingId) ?? items[0];
  const countOf = (id: string) => (file.placedOpenings ?? []).filter((p) => p.openingId === id).length;

  return (
    <div className="absolute left-1/2 top-3 z-10 flex -translate-x-1/2 items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5 shadow-md">
      {items.length === 0 ? (
        <span className="text-sm text-muted-foreground">Legg til vinduer og dører først.</span>
      ) : (
        <>
          <span className="text-xs text-muted-foreground">Plasser:</span>
          <Select value={current?.id} onValueChange={setPlacingId}>
            <SelectTrigger className="h-7 w-44 text-xs" aria-label="Velg vindu eller dør">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}
                  {item.widthMm && item.heightMm ? ` – ${item.widthMm}×${item.heightMm}` : ''}
                  {countOf(item.id) > 0 ? ` (${countOf(item.id)} plassert)` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="hidden text-xs text-muted-foreground sm:inline">Klikk på vegger for å plassere flere</span>
        </>
      )}
      <Button variant="outline" size="sm" className="h-7" onClick={() => setDialogOpen(true)}>
        <ListPlus /> Mål og typer
      </Button>
    </div>
  );
}
