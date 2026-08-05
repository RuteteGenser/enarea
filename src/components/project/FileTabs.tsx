import { useRef, useState } from 'react';
import { FileText, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import RenameDialog from '@/components/project/RenameDialog';
import { cn } from '@/lib/utils';
import { useFilesStore } from '@/store/filesStore';
import { toast } from 'sonner';
import type { PdfFile } from '@/types';

type FileTabsProps = {
  projectId: string;
  files: PdfFile[];
  activeFileId: string | null;
  onSelect: (fileId: string) => void;
};

export default function FileTabs({ projectId, files, activeFileId, onSelect }: FileTabsProps) {
  const { addFile, renameFile, deleteFile } = useFilesStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [renameTarget, setRenameTarget] = useState<PdfFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PdfFile | null>(null);

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    for (const file of Array.from(fileList)) {
      if (file.type !== 'application/pdf') {
        toast.error(`${file.name} er ikke en PDF-fil`);
        continue;
      }
      const created = await addFile(projectId, file.name.replace(/\.pdf$/i, ''), file);
      onSelect(created.id);
    }
  }

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b border-border bg-toolbar px-2">
      <div className="flex flex-1 items-center gap-1 overflow-x-auto no-scrollbar">
        {files.map((file) => (
          <div
            key={file.id}
            className={cn(
              'group flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-sm transition-colors',
              file.id === activeFileId
                ? 'bg-secondary text-foreground'
                : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground',
            )}
          >
            <button
              type="button"
              className="flex items-center gap-1.5"
              onClick={() => onSelect(file.id)}
            >
              <FileText className="size-3.5" />
              <span className="max-w-40 truncate">{file.name}</span>
              {!file.calibration && (
                <span
                  className="size-1.5 shrink-0 rounded-full bg-amber-500"
                  title="Ikke kalibrert"
                />
              )}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex size-4 items-center justify-center rounded opacity-0 hover:bg-black/10 group-hover:opacity-100 dark:hover:bg-white/10"
                >
                  <MoreVertical className="size-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onSelect={() => setRenameTarget(file)}>
                  <Pencil /> Endre navn
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setDeleteTarget(file)}>
                  <Trash2 /> Slett fil
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="icon-sm" onClick={() => inputRef.current?.click()} title="Last opp PDF">
        <Plus className="size-4" />
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          void handleFilesSelected(e.target.files);
          e.target.value = '';
        }}
      />

      {renameTarget && (
        <RenameDialog
          open={renameTarget !== null}
          title="Endre filnavn"
          initialValue={renameTarget.name}
          onOpenChange={(open) => !open && setRenameTarget(null)}
          onRename={(name) => void renameFile(renameTarget.id, name)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={deleteTarget !== null}
          title={`Slette «${deleteTarget.name}»?`}
          description="PDF-en og alle målinger på denne filen slettes permanent."
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => {
            void deleteFile(deleteTarget.id);
            toast.success('Fil slettet');
          }}
        />
      )}
    </div>
  );
}
