import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import BuildingComponentTypeRow from '@/components/buildingComponentTypes/BuildingComponentTypeRow';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { BUILDING_COMPONENT_CATEGORY_LABELS } from '@/types';
import type { BuildingComponentCategory, BuildingComponentType } from '@/types';

type CategorySectionProps = {
  category: BuildingComponentCategory;
  types: BuildingComponentType[];
};

export default function CategorySection({ category, types }: CategorySectionProps) {
  const createType = useBuildingComponentTypeStore((s) => s.createType);
  const updateType = useBuildingComponentTypeStore((s) => s.updateType);
  const deleteType = useBuildingComponentTypeStore((s) => s.deleteType);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [uValue, setUValue] = useState('');
  const [wallThickness, setWallThickness] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BuildingComponentType | null>(null);

  const isYttervegg = category === 'yttervegg';
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
    setAdding(false);
  }

  function handleCreate() {
    if (!canSubmit) return;
    void createType(category, name.trim(), parsedUValue, isYttervegg ? parsedThickness : undefined);
    resetForm();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{BUILDING_COMPONENT_CATEGORY_LABELS[category]}</h2>

      {types.length === 0 && !adding && <p className="mb-2 text-sm text-muted-foreground">Ingen typer ennå.</p>}

      {(types.length > 0 || adding) && (
        <div className="divide-y divide-border rounded-md border border-border">
          {types.map((type) => (
            <BuildingComponentTypeRow
              key={type.id}
              type={type}
              onUpdate={(patch) => void updateType(type.id, patch)}
              onDelete={() => setDeleteTarget(type)}
            />
          ))}

          {adding && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <Input
                autoFocus
                placeholder="Navn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 flex-1 px-1.5 py-0 text-sm"
              />
              <Input
                inputMode="decimal"
                placeholder="U-verdi (valgfritt)"
                value={uValue}
                onChange={(e) => setUValue(e.target.value)}
                className="h-7 w-32 px-1.5 py-0 text-sm"
              />
              {isYttervegg && (
                <Input
                  inputMode="decimal"
                  placeholder="Tykkelse, mm (valgfritt)"
                  value={wallThickness}
                  onChange={(e) => setWallThickness(e.target.value)}
                  className="h-7 w-36 px-1.5 py-0 text-sm"
                />
              )}
              <Button size="sm" disabled={!canSubmit} onClick={handleCreate}>
                Legg til
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                Avbryt
              </Button>
            </div>
          )}
        </div>
      )}

      {!adding && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(true)}>
          <Plus /> Legg til type
        </Button>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={deleteTarget !== null}
          title={`Slette «${deleteTarget.name}»?`}
          description="Dette kan ikke angres."
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => void deleteType(deleteTarget.id)}
        />
      )}
    </section>
  );
}
