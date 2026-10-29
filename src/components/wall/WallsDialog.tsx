import { useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { metersPerUnit } from '@/lib/calibration';
import { displayName } from '@/lib/annotationLabel';
import { distance } from '@/lib/geometry';
import { useAnnotationStore } from '@/store/annotationStore';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { useViewportStore } from '@/store/viewportStore';
import type { BuildingComponentAssignment, BuildingComponentType, Orientation, PdfFile } from '@/types';

const NONE = 'none';
const ORIENTATIONS: { value: Orientation; label: string }[] = [
  { value: 'N', label: 'Nord' },
  { value: 'E', label: 'Øst' },
  { value: 'S', label: 'Sør' },
  { value: 'W', label: 'Vest' },
];

function toAssignment(type: BuildingComponentType): BuildingComponentAssignment {
  return { typeId: type.id, category: type.category, name: type.name, uValue: type.uValue, wallThickness: type.wallThickness };
}

/** Info panel for the wall tool: every outer wall with length, direction and type (from the bygningstabell). */
export default function WallsDialog({ file }: { file: PdfFile }) {
  const open = useViewportStore((s) => s.wallsDialogOpen);
  const setOpen = useViewportStore((s) => s.setWallsDialogOpen);
  const annotations = useAnnotationStore((s) => s.annotations);
  const setEdgeMeta = useAnnotationStore((s) => s.setEdgeMeta);
  const types = useBuildingComponentTypeStore((s) => s.types);
  const typesLoaded = useBuildingComponentTypeStore((s) => s.loaded);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);

  useEffect(() => {
    if (!typesLoaded) void loadTypes();
  }, [typesLoaded, loadTypes]);

  const mpu = metersPerUnit(file.calibration);
  const wallTypes = types.filter((t) => t.category === 'yttervegg');

  const walls = annotations
    .filter((a) => a.type !== 'line')
    .flatMap((annotation) =>
      annotation.points.flatMap((p, i) => {
        const edge = annotation.edges?.[i];
        if (edge?.wallType !== 'external') return [];
        const length = distance(p, annotation.points[(i + 1) % annotation.points.length]) * mpu;
        return [{ annotation, index: i, edge, length }];
      }),
    );
  const totalLength = walls.reduce((sum, w) => sum + w.length, 0);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90svh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yttervegger</DialogTitle>
          <DialogDescription>
            {walls.length} {walls.length === 1 ? 'yttervegg' : 'yttervegger'}, samlet lengde{' '}
            {totalLength.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m. Velg himmelretning og type fra bygningstabellen.
          </DialogDescription>
        </DialogHeader>

        {walls.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Ingen yttervegger ennå. Bruk vegg-verktøyet for å merke dem.
          </p>
        ) : (
          <div className="grid gap-1.5">
            <div className="grid grid-cols-[1fr_4rem_5rem_7rem_1fr_2rem] items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>Rom</span>
              <span>Vegg</span>
              <span>Lengde</span>
              <span>Retning</span>
              <span>Type (bygningstabell)</span>
              <span />
            </div>
            {walls.map(({ annotation, index, edge, length }) => (
              <div key={`${annotation.id}:${index}`} className="grid grid-cols-[1fr_4rem_5rem_7rem_1fr_2rem] items-center gap-2">
                <span className="truncate text-sm">{displayName(annotation)}</span>
                <span className="text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {length.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m
                </span>
                <Select
                  value={edge.orientation ?? NONE}
                  onValueChange={(v) => setEdgeMeta(annotation.id, index, { orientation: v === NONE ? undefined : (v as Orientation) })}
                >
                  <SelectTrigger className="h-8 text-sm" aria-label="Himmelretning">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>--</SelectItem>
                    {ORIENTATIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={edge.buildingComponent?.typeId ?? NONE}
                  onValueChange={(v) => {
                    const type = wallTypes.find((t) => t.id === v);
                    setEdgeMeta(annotation.id, index, { buildingComponent: type ? toAssignment(type) : undefined });
                  }}
                >
                  <SelectTrigger className="h-8 text-sm" aria-label="Veggtype">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>--</SelectItem>
                    {wallTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                        {t.uValue !== undefined ? ` (${t.uValue} W/m²K)` : ''}
                      </SelectItem>
                    ))}
                    {wallTypes.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">Ingen yttervegg-typer i bygningstabellen ennå.</div>
                    )}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Fjern yttervegg"
                  onClick={() =>
                    setEdgeMeta(annotation.id, index, { wallType: undefined, orientation: undefined, buildingComponent: undefined })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
