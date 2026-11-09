import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { ORIENTATION_NAMES, ORIENTATION_OPTIONS } from '@/lib/wallOrientation';
import type { EdgeMeta, Orientation } from '@/types';

const ORIENTATIONS: { value: Orientation; label: string }[] = ORIENTATION_OPTIONS.map((value) => ({
  value,
  label: ORIENTATION_NAMES[value],
}));

type EdgeContextMenuProps = {
  edge: EdgeMeta;
  onChange: (meta: EdgeMeta) => void;
  children: React.ReactNode;
};

export default function EdgeContextMenu({ edge, onChange, children }: EdgeContextMenuProps) {
  const isExternal = edge.wallType === 'external';
  const isPartition = edge.wallType === 'partition';

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuLabel>Vegg-type</ContextMenuLabel>
        {isExternal ? (
          <ContextMenuItem onSelect={() => onChange({ wallType: 'internal', orientation: undefined, buildingComponent: undefined })}>
            Fjern yttervegg-merking
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onSelect={() => onChange({ wallType: 'external', buildingComponent: isPartition ? undefined : edge.buildingComponent })}>
            Merk som yttervegg
          </ContextMenuItem>
        )}
        {isPartition ? (
          <ContextMenuItem onSelect={() => onChange({ wallType: 'internal', orientation: undefined, buildingComponent: undefined })}>
            Fjern skillekonstruksjon-merking
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onSelect={() => onChange({ wallType: 'partition', orientation: undefined, buildingComponent: undefined })}>
            Merk som skillekonstruksjon
          </ContextMenuItem>
        )}

        {isExternal && (
          <>
            <ContextMenuSeparator />
            <ContextMenuLabel>Himmelretning</ContextMenuLabel>
            <ContextMenuItem onSelect={() => onChange({ wallType: 'external', orientation: undefined })}>
              Etter kompass {!edge.orientation && '✓'}
            </ContextMenuItem>
            {ORIENTATIONS.map((o) => (
              <ContextMenuItem
                key={o.value}
                onSelect={() => onChange({ wallType: 'external', orientation: o.value })}
              >
                {o.label} {edge.orientation === o.value && '✓'}
              </ContextMenuItem>
            ))}
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
