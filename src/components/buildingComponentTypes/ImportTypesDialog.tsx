import { useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { parseBuildingComponentImport } from '@/lib/buildingComponentImport';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';

type ImportTypesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function ImportTypesDialog({ open, onOpenChange }: ImportTypesDialogProps) {
  const importTypes = useBuildingComponentTypeStore((s) => s.importTypes);
  const [text, setText] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  function handleOpenChange(next: boolean) {
    if (!next) {
      setText('');
      setErrors([]);
    }
    onOpenChange(next);
  }

  async function handleImport() {
    const result = parseBuildingComponentImport(text);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    await importTypes(result.entries);
    toast.success(`${result.entries.length} bygningsdeltyper importert`);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Importer JSON</DialogTitle>
          <DialogDescription>
            Lim inn en JSON-liste med bygningsdeltyper. Bruk «Kopier AI-prompt» for å få hjelp til å lage listen.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          autoFocus
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setErrors([]);
          }}
          placeholder='[{ "category": "yttervegg", "name": "Yttervegg type 1", "uValue": 0.18, "wallThickness": 250 }]'
          className="min-h-48 font-mono text-xs"
        />
        {errors.length > 0 && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
            <ul className="list-inside list-disc space-y-0.5">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Avbryt
          </Button>
          <Button type="button" disabled={!text.trim()} onClick={() => void handleImport()}>
            Importer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
