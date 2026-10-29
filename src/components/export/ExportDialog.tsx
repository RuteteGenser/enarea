import { useState } from 'react';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
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
import { exportProjectExcel } from '@/lib/excelExport';
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
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);

  function download(blob: Blob, extension: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/[^\w\-æøåÆØÅ ]/g, '')}.${extension}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleExport(kind: 'pdf' | 'excel') {
    setExporting(kind);
    try {
      const filesData = await Promise.all(
        files.map(async (file) => ({ file, annotations: await annotationsRepo.listByFile(file.id) })),
      );
      if (kind === 'pdf') {
        download(await exportProjectPdf(project, filesData, unit), 'pdf');
        toast.success('Rapport eksportert');
      } else {
        download(await exportProjectExcel(project, filesData), 'xlsx');
        toast.success('Excel-fil eksportert');
      }
      onOpenChange(false);
    } catch (err) {
      console.error('Eksport feilet', err);
      toast.error('Eksport feilet. Prøv igjen.');
    } finally {
      setExporting(null);
    }
  }

  const fileCount = files.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eksporter</DialogTitle>
          <DialogDescription>
            PDF: forside, målingssammendrag og alle {fileCount} {fileCount === 1 ? 'fil' : 'filer'} med annotasjoner
            påtegnet. Excel: ark med prosjektinfo, rom, vegger, vinduer/dører og linjer, med titler øverst.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={exporting !== null}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport('excel')}
            disabled={exporting !== null || fileCount === 0}
          >
            {exporting === 'excel' ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
            {exporting === 'excel' ? 'Eksporterer …' : 'Eksporter Excel'}
          </Button>
          <Button type="button" onClick={() => void handleExport('pdf')} disabled={exporting !== null || fileCount === 0}>
            {exporting === 'pdf' ? <Loader2 className="animate-spin" /> : <Download />}
            {exporting === 'pdf' ? 'Eksporterer …' : 'Eksporter PDF'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
