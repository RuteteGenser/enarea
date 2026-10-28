import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, MoreVertical, Pencil, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { useFilesStore } from '@/store/filesStore';
import { BUILDING_CATEGORY_LABELS } from '@/types';
import type { Project } from '@/types';

type ProjectCardProps = {
  project: Project;
  onRename: () => void;
  onEditInfo: () => void;
  onDelete: () => void;
};

// Long names shrink so they still fit on the card instead of being cut off.
function nameSize(name: string) {
  if (name.length > 36) return 'text-[10px]';
  if (name.length > 28) return 'text-[11px]';
  if (name.length > 20) return 'text-xs';
  return 'text-sm';
}

export default function ProjectCard({ project, onRename, onEditInfo, onDelete }: ProjectCardProps) {
  const navigate = useNavigate();
  const loadFiles = useFilesStore((s) => s.loadFiles);
  const files = useFilesStore((s) => s.filesByProject[project.id]);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    void loadFiles(project.id);
  }, [project.id, loadFiles]);

  const date = new Date(project.updatedAt).toLocaleDateString('nb-NO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/project/${project.id}`)}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/project/${project.id}`)}
      className="group relative flex cursor-pointer flex-col gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:shadow-sm"
    >
      <div className="flex items-start justify-between">
        <div className="flex size-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <FileText className="size-5" />
        </div>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className="opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={onRename}>
              <Pencil /> Endre navn
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onEditInfo}>
              <FileText /> Rediger prosjektinfo
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onSelect={onDelete}>
              <Trash2 /> Slett prosjekt
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div>
        <h3 className={`truncate font-semibold text-foreground ${nameSize(project.name)}`} title={project.name}>
          {project.name}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {project.buildingCategory ? `${BUILDING_CATEGORY_LABELS[project.buildingCategory]} · ` : ''}
          {files ? `${files.length} ${files.length === 1 ? 'fil' : 'filer'}` : '…'} · Sist endret {date}
        </p>
      </div>
    </div>
  );
}
