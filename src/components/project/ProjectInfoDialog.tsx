import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BUILDING_CATEGORY_LABELS } from '@/types';
import type { BuildingCategory, ProjectInfo } from '@/types';

type ProjectInfoDialogProps = {
  open: boolean;
  title: string;
  submitLabel: string;
  initial?: ProjectInfo;
  onOpenChange: (open: boolean) => void;
  onSubmit: (info: ProjectInfo) => void;
};

const MIN_BUILD_YEAR = 1500;

export default function ProjectInfoDialog({
  open,
  title,
  submitLabel,
  initial,
  onOpenChange,
  onSubmit,
}: ProjectInfoDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<BuildingCategory | ''>('');
  const [buildYear, setBuildYear] = useState('');
  const [climateLocation, setClimateLocation] = useState('');

  // Start from the project's current values (edit) or empty (new) each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? '');
    setDescription(initial?.description ?? '');
    setCategory(initial?.buildingCategory ?? '');
    setBuildYear(initial?.buildYear ? String(initial.buildYear) : '');
    setClimateLocation(initial?.climateLocation ?? '');
  }, [open, initial]);

  const maxYear = new Date().getFullYear();
  const yearNumber = buildYear.trim() === '' ? undefined : Number(buildYear);
  const yearValid = yearNumber === undefined || (Number.isInteger(yearNumber) && yearNumber >= MIN_BUILD_YEAR && yearNumber <= maxYear);
  const valid = name.trim().length > 0 && category !== '' && yearValid;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (category === '' || !valid) return;
    onSubmit({
      name: name.trim(),
      description,
      buildingCategory: category,
      buildYear: yearNumber,
      climateLocation,
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>Prosjektinformasjon</DialogDescription>
          </DialogHeader>

          <div className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="project-name">Prosjektnavn *</Label>
              <Input
                id="project-name"
                autoFocus
                placeholder="Enebolig Hansen"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-description">Bygningsbeskrivelse</Label>
              <textarea
                id="project-description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-category">Arealtype / bygningskategori *</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as BuildingCategory)}>
                <SelectTrigger id="project-category">
                  <SelectValue placeholder="Velg bygningskategori" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BUILDING_CATEGORY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-year">Byggeår</Label>
              <Input
                id="project-year"
                type="number"
                inputMode="numeric"
                min={MIN_BUILD_YEAR}
                max={maxYear}
                placeholder="1985"
                value={buildYear}
                onChange={(e) => setBuildYear(e.target.value)}
                aria-invalid={!yearValid}
              />
              <p className="text-xs text-muted-foreground">
                Nyttig dersom du senere skal foreslå historiske standardverdier for konstruksjoner.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="project-climate">Klimasted / kommune</Label>
              <Input
                id="project-climate"
                placeholder="Oslo"
                value={climateLocation}
                onChange={(e) => setClimateLocation(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!valid}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
