import { useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Plus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAnnotationStore, type BulkAssignTarget } from '@/store/annotationStore';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { BUILDING_COMPONENT_CATEGORY_LABELS } from '@/types';
import type { BuildingComponentAssignment, BuildingComponentCategory, BuildingComponentType } from '@/types';

function toAssignment(type: BuildingComponentType): BuildingComponentAssignment {
  return {
    typeId: type.id,
    category: type.category,
    name: type.name,
    uValue: type.uValue,
    wallThickness: type.wallThickness,
  };
}

type MeasurementGroupHeaderProps = {
  label: string;
  count: number;
  open: boolean;
  onToggleOpen: () => void;
} & (
  | {
      mode: 'assigned';
      typeId: string;
      category: BuildingComponentCategory;
      currentUValue?: number;
      currentWallThickness?: number;
    }
  | {
      mode: 'uncategorized';
      categories: BuildingComponentCategory[];
      targets: BulkAssignTarget[];
    }
);

export default function MeasurementGroupHeader(props: MeasurementGroupHeaderProps) {
  const { label, count, open, onToggleOpen } = props;
  const [popoverOpen, setPopoverOpen] = useState(false);

  return (
    <div className="mb-1 mt-3 flex items-center gap-1 px-2 first:mt-0">
      <button
        type="button"
        onClick={onToggleOpen}
        onDoubleClick={() => setPopoverOpen(true)}
        className="flex flex-1 items-center gap-1 text-left text-xs font-semibold text-foreground"
      >
        {open ? <ChevronDown className="size-3.5 text-muted-foreground" /> : <ChevronRight className="size-3.5 text-muted-foreground" />}
        {label} ({count})
      </button>
      {props.mode === 'assigned' ? (
        <BulkEditValuePopover
          typeId={props.typeId}
          category={props.category}
          currentUValue={props.currentUValue}
          currentWallThickness={props.currentWallThickness}
          count={count}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        />
      ) : (
        <BulkAssignPopover
          categories={props.categories}
          targets={props.targets}
          count={count}
          open={popoverOpen}
          onOpenChange={setPopoverOpen}
        />
      )}
    </div>
  );
}

type BulkEditValuePopoverProps = {
  typeId: string;
  category: BuildingComponentCategory;
  currentUValue?: number;
  currentWallThickness?: number;
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function BulkEditValuePopover({
  typeId,
  category,
  currentUValue,
  currentWallThickness,
  count,
  open,
  onOpenChange,
}: BulkEditValuePopoverProps) {
  const bulkUpdateBuildingComponent = useAnnotationStore((s) => s.bulkUpdateBuildingComponent);
  const isYttervegg = category === 'yttervegg';

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
    onOpenChange(next);
  }

  function handleApply() {
    if (!canSubmit) return;
    bulkUpdateBuildingComponent(typeId, {
      ...(parsedUValue !== undefined && { uValue: parsedUValue }),
      ...(isYttervegg && parsedThickness !== undefined && { wallThickness: parsedThickness }),
    });
    onOpenChange(false);
  }

  return (
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
  );
}

type BulkAssignPopoverProps = {
  categories: BuildingComponentCategory[];
  targets: BulkAssignTarget[];
  count: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function BulkAssignPopover({ categories, targets, count, open, onOpenChange }: BulkAssignPopoverProps) {
  const types = useBuildingComponentTypeStore((s) => s.types);
  const createType = useBuildingComponentTypeStore((s) => s.createType);
  const bulkAssignBuildingComponent = useAnnotationStore((s) => s.bulkAssignBuildingComponent);

  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<BuildingComponentCategory>(categories[0]);
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
    setAddCategory(categories[0]);
    setAdding(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  function assignAndClose(assignment: BuildingComponentAssignment) {
    bulkAssignBuildingComponent(targets, assignment);
    handleOpenChange(false);
  }

  async function handleCreate() {
    if (!canSubmit) return;
    const created = await createType(addCategory, name.trim(), parsedUValue, isYttervegg ? parsedThickness : undefined);
    assignAndClose(toAssignment(created));
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" title="Tilordne type for hele gruppen">
          <Plus className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
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
                        onClick={() => assignAndClose(toAssignment(type))}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="truncate">{type.name}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {type.uValue !== undefined && `${type.uValue} W/m²K`}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
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
                    className="rounded-md border border-border px-2 py-1 text-xs data-[active=true]:border-primary data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                    data-active={addCategory === category}
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
                Legg til og tilordne {count}
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
