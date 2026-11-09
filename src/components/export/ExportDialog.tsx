import { useEffect, useState } from 'react';
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
import { annotationsRepo, buildingComponentTypesRepo } from '@/lib/db';
import { exportProjectPdf } from '@/lib/pdfExport';
import { exportProjectExcel } from '@/lib/excelExport';
import { displayName } from '@/lib/annotationLabel';
import { useViewportStore } from '@/store/viewportStore';
import { toast } from 'sonner';
import type { Annotation, PdfFile, Project } from '@/types';

type ExportDialogProps = {
  open: boolean;
  project: Project;
  files: PdfFile[];
  onOpenChange: (open: boolean) => void;
};

export default function ExportDialog({ open, project, files, onOpenChange }: ExportDialogProps) {
  const unit = useViewportStore((s) => s.unit);
  const [exporting, setExporting] = useState<'pdf' | 'excel' | null>(null);
  // The zones (rooms/areas) per file, and the ones ticked for the Excel export.
  const [zones, setZones] = useState<{ file: PdfFile; annotations: Annotation[] }[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void Promise.all(files.map(async (file) => ({ file, annotations: (await annotationsRepo.listByFile(file.id)).filter((a) => a.type !== 'line') }))).then((data) => {
      if (cancelled) return;
      setZones(data);
      setChecked(new Set(data.flatMap((d) => d.annotations.map((a) => a.id))));
    });
    return () => {
      cancelled = true;
    };
  }, [open, files]);

  const allIds = zones.flatMap((z) => z.annotations.map((a) => a.id));
  const allChecked = allIds.length > 0 && allIds.every((id) => checked.has(id));
  const noneChecked = allIds.every((id) => !checked.has(id));
  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

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
        download(await exportProjectPdf(project, filesData, unit, await buildingComponentTypesRepo.list()), 'pdf');
        toast.success('Rapport eksportert');
      } else {
        const selected = filesData.map((d) => ({ ...d, annotations: d.annotations.filter((a) => checked.has(a.id)) }));
        download(await exportProjectExcel(project, selected, await buildingComponentTypesRepo.list()), 'xlsx');
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
        {allIds.length > 0 && (
          <div className="rounded-md border border-border">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm">
              <label className="flex cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = !allChecked && !noneChecked;
                  }}
                  onChange={() => setChecked(allChecked ? new Set() : new Set(allIds))}
                />
                Velg alle / ingen
              </label>
              <span className="text-xs text-muted-foreground">
                Excel: {allIds.filter((id) => checked.has(id)).length} av {allIds.length} soner
              </span>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {zones.map(({ file, annotations }) =>
                annotations.length === 0 ? null : (
                  <div key={file.id}>
                    {zones.length > 1 && <div className="px-3 pt-1 text-xs font-semibold text-muted-foreground">{file.name}</div>}
                    {annotations.map((a) => (
                      <label key={a.id} className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm hover:bg-secondary/60">
                        <input type="checkbox" checked={checked.has(a.id)} onChange={() => toggle(a.id)} />
                        <span className="truncate">{[a.roomNumber, displayName(a)].filter(Boolean).join(' ')}</span>
                      </label>
                    ))}
                  </div>
                ),
              )}
            </div>
          </div>
        )}
        <DialogFooter className="mt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={exporting !== null}>
            Avbryt
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleExport('excel')}
            disabled={exporting !== null || fileCount === 0 || (allIds.length > 0 && noneChecked)}
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
