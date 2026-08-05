import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { annotationsRepo } from '@/lib/db';
import { exportProjectPdf } from '@/lib/pdfExport';
import { useViewportStore } from '@/store/viewportStore';
import { toast } from 'sonner';
import type { PdfFile, Project } from '@/types';

type ExportDialogProps = {
  open: boolean;
  project: Project;
  files: PdfFile[];
  onOpenChange: (open: boolean) => void;
};

export default function ExportDialog({ open, project, files, onOpenChange }: ExportDialogProps) {
  const unit = useViewportStore((s) => s.unit);
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    setExporting(true);
    try {
      const filesData = await Promise.all(
        files.map(async (file) => ({ file, annotations: await annotationsRepo.listByFile(file.id) })),
      );
      const blob = await exportProjectPdf(project, filesData, unit);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${project.name.replace(/[^\w\-æøåÆØÅ ]/g, '')}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Rapport eksportert');
      onOpenChange(false);
    } catch (err) {
      console.error('Eksport feilet', err);
      toast.error('Eksport feilet. Prøv igjen.');
    } finally {
      setExporting(false);
    }
  }

  const fileCount = files.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eksporter rapport</DialogTitle>
          <DialogDescription>
            Genererer en PDF med forside, målingssammendrag og alle {fileCount} {fileCount === 1 ? 'fil' : 'filer'} med
            annotasjoner påtegnet.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={exporting}>
            Avbryt
          </Button>
          <Button type="button" onClick={handleExport} disabled={exporting || fileCount === 0}>
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {exporting ? 'Eksporterer …' : 'Eksporter PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
