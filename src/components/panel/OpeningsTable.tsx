import { useEffect } from 'react';
import { DoorOpen, SquarePen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { displayName } from '@/lib/annotationLabel';
import { openingArea } from '@/lib/openings';
import { useAnnotationStore } from '@/store/annotationStore';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { useViewportStore } from '@/store/viewportStore';
import type { OpeningItem } from '@/types';

/** The file's windows and doors in Målinger: Vindu 1, Vindu 2, Dør 3 … with size, type and where they sit. */
export default function OpeningsTable({ openings }: { openings: OpeningItem[] }) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const types = useBuildingComponentTypeStore((s) => s.types);
  const typesLoaded = useBuildingComponentTypeStore((s) => s.loaded);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);
  const setDialogOpen = useViewportStore((s) => s.setOpeningsDialogOpen);

  useEffect(() => {
    if (!typesLoaded) void loadTypes();
  }, [typesLoaded, loadTypes]);

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-2 py-0.5">
        <h3 className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <DoorOpen className="size-3" /> Vinduer og dører ({openings.length})
        </h3>
        <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[10px]" onClick={() => setDialogOpen(true)}>
          <SquarePen className="size-3" /> Rediger
        </Button>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Navn', 'Bredde × høyde (mm)', 'Areal', 'Type', 'U-verdi', 'Plassering'].map((title) => (
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
            const room = item.placement ? annotations.find((a) => a.id === item.placement?.annotationId) : undefined;
            return (
              <tr key={item.id} className="border-b border-border/50">
                <td className="px-2 py-1 text-foreground">{item.name}</td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">
                  {item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm}` : '--'}
                </td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">
                  {area === undefined ? '--' : `${area.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²`}
                </td>
                <td className="px-2 py-1 text-muted-foreground">{type?.name ?? '--'}</td>
                <td className="px-2 py-1 tabular-nums text-muted-foreground">
                  {type?.uValue !== undefined ? `${type.uValue} W/m²K` : '--'}
                </td>
                <td className="px-2 py-1 text-muted-foreground">
                  {room && item.placement ? `${displayName(room)}, vegg ${item.placement.edgeIndex + 1}` : 'Ikke plassert'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
