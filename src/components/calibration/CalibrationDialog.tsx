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

type CalibrationDialogProps = {
  open: boolean;
  isRecalibration: boolean;
  onCancel: () => void;
  onConfirm: (realMeters: number) => void;
};

export default function CalibrationDialog({ open, isRecalibration, onCancel, onConfirm }: CalibrationDialogProps) {
  const [value, setValue] = useState('');
  const parsed = Number(value.replace(',', '.'));
  const valid = value.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onConfirm(parsed);
    setValue('');
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setValue('');
          onCancel();
        }
      }}
    >
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isRecalibration ? 'Rekalibrer skala' : 'Kalibrer skala'}</DialogTitle>
            <DialogDescription>
              {isRecalibration
                ? 'Denne filen er allerede kalibrert. Alle eksisterende målinger oppdateres til den nye skalaen.'
                : 'Hva er den faktiske lengden på linjen du tegnet?'}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 grid gap-2">
            <Label htmlFor="real-length">Faktisk lengde (meter)</Label>
            <Input
              id="real-length"
              autoFocus
              inputMode="decimal"
              placeholder="8.0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
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
