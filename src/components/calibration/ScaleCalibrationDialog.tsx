import { useState } from 'react';
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

const PRESET_SCALES = [25, 50, 100, 200, 500];
const CUSTOM = 'custom';

type ScaleCalibrationDialogProps = {
  open: boolean;
  isRecalibration: boolean;
  onCancel: () => void;
  onConfirm: (scale: number) => void;
};

export default function ScaleCalibrationDialog({
  open,
  isRecalibration,
  onCancel,
  onConfirm,
}: ScaleCalibrationDialogProps) {
  const [preset, setPreset] = useState<string>(String(PRESET_SCALES[2]));
  const [customValue, setCustomValue] = useState('');

  const isCustom = preset === CUSTOM;
  const parsedCustom = Number(customValue.replace(',', '.'));
  const scale = isCustom ? parsedCustom : Number(preset);
  const valid = Number.isFinite(scale) && scale > 0;

  function reset() {
    setPreset(String(PRESET_SCALES[2]));
    setCustomValue('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onConfirm(scale);
    reset();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          reset();
          onCancel();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isRecalibration ? 'Rekalibrer skala' : 'Angi skala'}</DialogTitle>
            <DialogDescription>
              {isRecalibration
                ? 'Denne filen er allerede kalibrert. Alle eksisterende målinger oppdateres til den nye skalaen.'
                : 'Velg tegningens målestokk, f.eks. 1:100.'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2">
            <Label htmlFor="scale-select">Målestokk</Label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">1:</span>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger id="scale-select" className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRESET_SCALES.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s}
                    </SelectItem>
                  ))}
                  <SelectItem value={CUSTOM}>Egendefinert</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isCustom && (
              <Input
                autoFocus
                inputMode="decimal"
                placeholder="150"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
              />
            )}
          </div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={onCancel}>
              Avbryt
            </Button>
            <Button type="submit" disabled={!valid}>
              Bruk kalibrering
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
