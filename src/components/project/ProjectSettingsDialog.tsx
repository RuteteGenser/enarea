import { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
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
import { useProjectStore } from '@/store/projectStore';
import type { Project } from '@/types';

type ProjectSettingsDialogProps = {
  open: boolean;
  project: Project;
  onOpenChange: (open: boolean) => void;
};

export default function ProjectSettingsDialog({ open, project, onOpenChange }: ProjectSettingsDialogProps) {
  const updateNorthDirection = useProjectStore((s) => s.updateNorthDirection);
  const [degrees, setDegrees] = useState(String(project.northDirection));

  useEffect(() => {
    if (open) setDegrees(String(project.northDirection));
  }, [open, project.northDirection]);

  const parsed = Number(degrees);
  const valid = Number.isFinite(parsed) && parsed >= 0 && parsed <= 360;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    void updateNorthDirection(project.id, parsed);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Prosjektinnstillinger</DialogTitle>
            <DialogDescription>
              Nordretning brukes til å beregne himmelretning for yttervegger.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2">
            <Label htmlFor="north-direction">Nordretning (grader, 0–360)</Label>
            <div className="flex items-center gap-3">
              <div className="relative flex size-12 shrink-0 items-center justify-center rounded-full border border-border">
                <Compass
                  className="size-6 text-primary transition-transform"
                  style={{ transform: `rotate(${valid ? parsed : 0}deg)` }}
                />
              </div>
              <Input
                id="north-direction"
                type="number"
                min={0}
                max={360}
                value={degrees}
                onChange={(e) => setDegrees(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">°</span>
            </div>
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!valid}>
              Lagre
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
