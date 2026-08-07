import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const AI_IMPORT_PROMPT = `Jeg trenger en JSON-fil med bygningsdeltyper til et oppmålingsverktøy. Svar KUN med en gyldig JSON-array, ingen forklaringstekst eller markdown-formatering.

Hvert element i arrayen skal ha disse feltene:
- "category": en av følgende nøyaktige verdier: "yttervegg", "vindu", "ytterdor", "tak", "gulv", "dekke"
- "name": et beskrivende navn på typen (tekst), f.eks. "Yttervegg type 1"
- "uValue": U-verdi i W/m²K (tall, valgfritt)
- "wallThickness": veggtykkelse i mm (tall, valgfritt, kun relevant for kategorien "yttervegg")

Eksempel:
[
  { "category": "yttervegg", "name": "Yttervegg type 1", "uValue": 0.18, "wallThickness": 250 },
  { "category": "gulv", "name": "Gulv mot grunn", "uValue": 0.15 },
  { "category": "vindu", "name": "Vindu type A", "uValue": 0.8 }
]

Lag bygningsdeltyper for følgende: [BESKRIV BYGNINGEN/KOMPONENTENE DINE HER]`;

type AiPromptDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export default function AiPromptDialog({ open, onOpenChange }: AiPromptDialogProps) {
  async function handleCopy() {
    await navigator.clipboard.writeText(AI_IMPORT_PROMPT);
    toast.success('Prompt kopiert til utklippstavlen');
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>AI-prompt</DialogTitle>
          <DialogDescription>
            Kopier denne teksten inn i en AI-chat (f.eks. ChatGPT eller Claude), beskriv bygningen din til slutt, og
            lim JSON-svaret inn i «Importer JSON».
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-md border border-border bg-secondary/40 p-3 text-xs text-foreground">
          {AI_IMPORT_PROMPT}
        </pre>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Lukk
          </Button>
          <Button type="button" onClick={() => void handleCopy()}>
            <Copy /> Kopier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
