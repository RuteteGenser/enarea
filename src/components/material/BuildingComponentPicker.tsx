import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { BUILDING_COMPONENT_CATEGORY_LABELS } from '@/types';
import type { BuildingComponentAssignment, BuildingComponentCategory, BuildingComponentType } from '@/types';

type BuildingComponentPickerProps = {
  categories: BuildingComponentCategory[];
  current?: BuildingComponentAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assignment: BuildingComponentAssignment | null) => void;
  children: React.ReactNode;
};

function toAssignment(type: BuildingComponentType): BuildingComponentAssignment {
  return {
    typeId: type.id,
    category: type.category,
    name: type.name,
    uValue: type.uValue,
    wallThickness: type.wallThickness,
  };
}

export default function BuildingComponentPicker({
  categories,
  current,
  open,
  onOpenChange,
  onSelect,
  children,
}: BuildingComponentPickerProps) {
  const types = useBuildingComponentTypeStore((s) => s.types);
  const createType = useBuildingComponentTypeStore((s) => s.createType);

  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<BuildingComponentCategory>(categories[0]);
  const [name, setName] = useState('');
  const [uValue, setUValue] = useState('');
  const [wallThickness, setWallThickness] = useState('');

  const isYttervegg = addCategory === 'yttervegg';
  const parsedUValue = Number(uValue.replace(',', '.'));
  const parsedThickness = Number(wallThickness.replace(',', '.'));
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(parsedUValue) &&
    parsedUValue > 0 &&
    (!isYttervegg || (Number.isFinite(parsedThickness) && parsedThickness > 0));

  function resetForm() {
    setName('');
    setUValue('');
    setWallThickness('');
    setAddCategory(categories[0]);
    setAdding(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleCreate() {
    if (!canSubmit) return;
    const created = await createType(addCategory, name.trim(), parsedUValue, isYttervegg ? parsedThickness : undefined);
    onSelect(toAssignment(created));
    resetForm();
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        {!adding ? (
          <>
            <div className="max-h-64 overflow-y-auto">
              {categories.map((category) => {
                const categoryTypes = types.filter((t) => t.category === category);
                return (
                  <div key={category} className="mb-2">
                    {categories.length > 1 && (
                      <div className="px-1 py-1 text-xs font-semibold text-muted-foreground">
                        {BUILDING_COMPONENT_CATEGORY_LABELS[category]}
                      </div>
                    )}
                    {categoryTypes.length === 0 && (
                      <div className="px-1 py-1 text-xs text-muted-foreground">Ingen typer ennå.</div>
                    )}
                    {categoryTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          onSelect(toAssignment(type));
                          onOpenChange(false);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="truncate">{type.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {type.uValue} W/m²K
                          {current?.typeId === type.id && <Check className="size-3.5 text-primary" />}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {current && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  onOpenChange(false);
                }}
                className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-secondary"
              >
                <X className="size-3.5" /> Fjern merking
              </button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start"
              onClick={() => {
                setAddCategory(categories[0]);
                setAdding(true);
              }}
            >
              <Plus /> Legg til type
            </Button>
          </>
        ) : (
          <div className="grid gap-2">
            {categories.length > 1 && (
              <div className="flex gap-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setAddCategory(category)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs',
                      addCategory === category
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    {BUILDING_COMPONENT_CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
            )}
            <Input
              autoFocus
              placeholder="Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              inputMode="decimal"
              placeholder="U-verdi"
              value={uValue}
              onChange={(e) => setUValue(e.target.value)}
              className="h-8 text-sm"
            />
            {isYttervegg && (
              <Input
                inputMode="decimal"
                placeholder="Tykkelse (mm)"
                value={wallThickness}
                onChange={(e) => setWallThickness(e.target.value)}
                className="h-8 text-sm"
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAdding(false)}>
                Avbryt
              </Button>
              <Button size="sm" className="flex-1" disabled={!canSubmit} onClick={() => void handleCreate()}>
                Legg til
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
