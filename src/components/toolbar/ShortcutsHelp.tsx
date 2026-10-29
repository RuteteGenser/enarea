import { Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const SHORTCUTS: [string, string][] = [
  ['V', 'Velg-verktøy'],
  ['L', 'Mål avstand (midlertidig)'],
  ['R', 'Rektangel'],
  ['P', 'Polygon'],
  ['D', 'Gjenkjenn rom'],
  ['N', 'Gjenkjenn romnavn (klikk på navn/nummer)'],
  ['W', 'Merk yttervegg'],
  ['O', 'Personer (klikk i rom, Shift + klikk fjerner)'],
  ['H / Mellomrom + dra', 'Panorer'],
  ['Shift + dra', 'Lås til vannrett/loddrett/diagonal'],
  ['Shift + klikk hjørne', 'Slett hjørnepunkt'],
  ['Scroll', 'Zoom'],
  ['Hold F', 'Forstørrelsesglass og saktere musepeker (siktet fortsetter der du slipper)'],
  ['Ctrl + Z', 'Angre'],
  ['Ctrl + Shift + Z', 'Gjør om'],
  ['Delete', 'Slett valgt (også markert yttervegg, vindu/dør og person)'],
  ['Ctrl + C / Ctrl + V', 'Kopier / lim inn'],
  ['Esc', 'Avbryt tegning / tilbake til Velg'],
];

export default function ShortcutsHelp() {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon">
              <Keyboard />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Tastatursnarveier</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Tastatursnarveier</h3>
        <dl className="space-y-1.5">
          {SHORTCUTS.map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3 text-xs">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="rounded border border-border bg-secondary px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                {key}
              </dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  );
}
