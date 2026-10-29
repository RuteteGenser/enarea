import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatOpeningArea, parseArea } from '@/lib/wallOpenings';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { BUILDING_COMPONENT_CATEGORY_LABELS } from '@/types';
import type { BuildingComponentAssignment, BuildingComponentCategory, BuildingComponentType, WallOpening } from '@/types';

type BuildingComponentPickerProps = {
  categories: BuildingComponentCategory[];
  current?: BuildingComponentAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assignment: BuildingComponentAssignment | null) => void;
  /**
   * Categories (e.g. vindu, ytterdør) that are added to a wall as an opening with its own area
   * instead of replacing `current`. Picking one asks for the area (m²) and calls `onSelectOpening`.
   */
  openingCategories?: BuildingComponentCategory[];
  onSelectOpening?: (assignment: BuildingComponentAssignment, area: number) => void;
  /** Openings already on the wall; listed first, each removable. */
  openings?: WallOpening[];
  onRemoveOpening?: (id: string) => void;
  /** Element the popup is positioned against instead of the trigger (e.g. a point at the mouse click). */
  anchor?: React.ReactElement;
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
  openingCategories = [],
  onSelectOpening,
  openings = [],
  onRemoveOpening,
  anchor,
  children,
}: BuildingComponentPickerProps) {
  const types = useBuildingComponentTypeStore((s) => s.types);
  const createType = useBuildingComponentTypeStore((s) => s.createType);

  const allCategories = [...categories, ...openingCategories.filter((c) => !categories.includes(c))];
  const isOpeningCategory = (category: BuildingComponentCategory) =>
    onSelectOpening !== undefined && openingCategories.includes(category);

  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<BuildingComponentCategory>(allCategories[0]);
  // A window/door type that was picked and is waiting for its area (m²).
  const [pendingOpening, setPendingOpening] = useState<BuildingComponentAssignment | null>(null);
  const [areaText, setAreaText] = useState('');
  const parsedArea = parseArea(areaText);
  const [name, setName] = useState('');
  const [uValue, setUValue] = useState('');
  const [wallThickness, setWallThickness] = useState('');

  const isYttervegg = addCategory === 'yttervegg';
  const trimmedUValue = uValue.trim();
  const trimmedThickness = wallThickness.trim();
  const parsedUValue = trimmedUValue ? Number(trimmedUValue.replace(',', '.')) : undefined;
  const parsedThickness = trimmedThickness ? Number(trimmedThickness.replace(',', '.')) : undefined;
  const uValueValid = parsedUValue === undefined || (Number.isFinite(parsedUValue) && parsedUValue > 0);
  const thicknessValid = parsedThickness === undefined || (Number.isFinite(parsedThickness) && parsedThickness > 0);
  const canSubmit = name.trim().length > 0 && uValueValid && (!isYttervegg || thicknessValid);

  function resetForm() {
    setName('');
    setUValue('');
    setWallThickness('');
    setAddCategory(allCategories[0]);
    setAdding(false);
    setPendingOpening(null);
    setAreaText('');
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleCreate() {
    if (!canSubmit) return;
    const created = await createType(addCategory, name.trim(), parsedUValue, isYttervegg ? parsedThickness : undefined);
    if (isOpeningCategory(created.category)) {
      // New window/door type: still needs its area before it is placed on the wall.
      setName('');
      setUValue('');
      setWallThickness('');
      setAdding(false);
      setPendingOpening(toAssignment(created));
      return;
    }
    onSelect(toAssignment(created));
    resetForm();
    onOpenChange(false);
  }

  function handleAddOpening() {
    if (!pendingOpening || parsedArea === undefined || !onSelectOpening) return;
    onSelectOpening(pendingOpening, parsedArea);
    resetForm();
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      {anchor && <PopoverAnchor asChild>{anchor}</PopoverAnchor>}
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        {pendingOpening ? (
          <div className="grid gap-2">
            <div className="text-sm font-medium">{pendingOpening.name}</div>
            <Input
              autoFocus
              inputMode="decimal"
              placeholder="Areal, m²"
              value={areaText}
              onChange={(e) => setAreaText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddOpening()}
              className="h-8 text-sm"
              aria-label="Areal i kvadratmeter"
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setPendingOpening(null)}>
                Tilbake
              </Button>
              <Button size="sm" className="flex-1" disabled={parsedArea === undefined} onClick={handleAddOpening}>
                Legg til
              </Button>
            </div>
          </div>
        ) : !adding ? (
          <>
            <div className="max-h-64 overflow-y-auto">
              {openings.length > 0 && (
                <div className="mb-2">
                  <div className="px-1 py-1 text-xs font-semibold text-muted-foreground">På denne veggen</div>
                  {openings.map((opening) => (
                    <div key={opening.id} className="flex items-center justify-between rounded-md px-2 py-1 text-sm">
                      <span className="truncate">{opening.component.name}</span>
                      <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                        {formatOpeningArea(opening.area)}
                        <button
                          type="button"
                          onClick={() => onRemoveOpening?.(opening.id)}
                          className="rounded p-0.5 hover:bg-secondary hover:text-destructive"
                          title="Fjern"
                        >
                          <X className="size-3.5" />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {allCategories.map((category) => {
                const categoryTypes = types.filter((t) => t.category === category);
                return (
                  <div key={category} className="mb-2">
                    {allCategories.length > 1 && (
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
                          if (isOpeningCategory(type.category)) {
                            setPendingOpening(toAssignment(type));
                            return;
                          }
                          onSelect(toAssignment(type));
                          onOpenChange(false);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="truncate">{type.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {type.uValue !== undefined && `${type.uValue} W/m²K`}
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
                setAddCategory(allCategories[0]);
                setAdding(true);
              }}
            >
              <Plus /> Legg til type
            </Button>
          </>
        ) : (
          <div className="grid gap-2">
            {allCategories.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {allCategories.map((category) => (
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
