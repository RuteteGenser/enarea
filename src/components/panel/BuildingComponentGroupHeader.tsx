import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnnotationStore } from '@/store/annotationStore';
import type { BuildingComponentCategory } from '@/types';

type BuildingComponentGroupHeaderProps = {
  typeId: string;
  name: string;
  category: BuildingComponentCategory;
  count: number;
  currentUValue?: number;
  currentWallThickness?: number;
};

export default function BuildingComponentGroupHeader({
  typeId,
  name,
  category,
  count,
  currentUValue,
  currentWallThickness,
}: BuildingComponentGroupHeaderProps) {
  const bulkUpdateBuildingComponent = useAnnotationStore((s) => s.bulkUpdateBuildingComponent);
  const isYttervegg = category === 'yttervegg';

  const [open, setOpen] = useState(false);
  const [uValue, setUValue] = useState('');
  const [wallThickness, setWallThickness] = useState('');

  const trimmedUValue = uValue.trim();
  const trimmedThickness = wallThickness.trim();
  const parsedUValue = trimmedUValue ? Number(trimmedUValue.replace(',', '.')) : undefined;
  const parsedThickness = trimmedThickness ? Number(trimmedThickness.replace(',', '.')) : undefined;
  const uValueValid = parsedUValue === undefined || (Number.isFinite(parsedUValue) && parsedUValue > 0);
  const thicknessValid = parsedThickness === undefined || (Number.isFinite(parsedThickness) && parsedThickness > 0);
  const canSubmit = uValueValid && thicknessValid && (parsedUValue !== undefined || parsedThickness !== undefined);

  function handleOpenChange(next: boolean) {
    if (next) {
      setUValue(currentUValue !== undefined ? String(currentUValue) : '');
      setWallThickness(currentWallThickness !== undefined ? String(currentWallThickness) : '');
    }
    setOpen(next);
  }

  function handleApply() {
    if (!canSubmit) return;
    bulkUpdateBuildingComponent(typeId, {
      ...(parsedUValue !== undefined && { uValue: parsedUValue }),
      ...(isYttervegg && parsedThickness !== undefined && { wallThickness: parsedThickness }),
    });
    setOpen(false);
  }

  return (
    <div className="mb-1 mt-3 flex items-center gap-2 px-2 first:mt-0">
      <span className="text-xs font-semibold text-foreground">
        {name} ({count})
      </span>
      <Popover open={open} onOpenChange={handleOpenChange}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" title="Rediger for hele gruppen">
            <Pencil className="size-3.5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-2" onClick={(e) => e.stopPropagation()}>
          <div className="grid gap-2">
            <Input
              autoFocus
              inputMode="decimal"
              placeholder="U-verdi (valgfritt)"
              value={uValue}
              onChange={(e) => setUValue(e.target.value)}
              className="h-8 text-sm"
            />
            {isYttervegg && (
              <Input
                inputMode="decimal"
                placeholder="Tykkelse, mm (valgfritt)"
                value={wallThickness}
                onChange={(e) => setWallThickness(e.target.value)}
                className="h-8 text-sm"
              />
            )}
            <Button size="sm" disabled={!canSubmit} onClick={handleApply}>
              Oppdater {count} element{count !== 1 ? 'er' : ''}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
