import { useEffect, useState } from 'react';
import { Plus, Ruler, Wind, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import ProjectInfoDialog from '@/components/project/ProjectInfoDialog';
import RenameDialog from '@/components/project/RenameDialog';
import ProjectCard from '@/components/project/ProjectCard';
import { useProjectStore } from '@/store/projectStore';
import { toast } from 'sonner';

export default function ProjectList() {
  const navigate = useNavigate();
  const { projects, loaded, loadProjects, createProject, renameProject, updateProjectInfo, deleteProject } = useProjectStore();
  const [newOpen, setNewOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [infoTarget, setInfoTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const renameProjectData = projects.find((p) => p.id === renameTarget);
  const infoProjectData = projects.find((p) => p.id === infoTarget);
  const deleteProjectData = projects.find((p) => p.id === deleteTarget);

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Ruler className="size-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-none text-foreground">Enarea</h1>
            <p className="mt-1 text-xs text-muted-foreground">Oppmålingsverktøy for energirådgivere</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate('/bygningsdeltyper')}>
            <Wrench /> Bygningsdeltyper
          </Button>
          <Button variant="outline" onClick={() => navigate('/romtyper')}>
            <Wind /> Romtyper
          </Button>
          <Button onClick={() => setNewOpen(true)}>
            <Plus /> Nytt prosjekt
          </Button>
        </div>
      </header>

      {loaded && projects.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-24 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
            <Ruler className="size-6" />
          </div>
          <h2 className="mt-4 text-sm font-medium text-foreground">Ingen prosjekter ennå</h2>
          <p className="mt-1 text-sm text-muted-foreground">Opprett et prosjekt for å komme i gang med oppmåling.</p>
          <Button className="mt-5" onClick={() => setNewOpen(true)}>
            <Plus /> Nytt prosjekt
          </Button>
        </div>
      )}

      {projects.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={() => setRenameTarget(project.id)}
              onEditInfo={() => setInfoTarget(project.id)}
              onDelete={() => setDeleteTarget(project.id)}
            />
          ))}
        </div>
      )}

      <ProjectInfoDialog
        open={newOpen}
        title="Nytt prosjekt"
        submitLabel="Opprett prosjekt"
        onOpenChange={setNewOpen}
        onSubmit={(info) => {
          void createProject(info);
        }}
      />

      <ProjectInfoDialog
        open={infoProjectData !== undefined}
        title="Rediger prosjektinfo"
        submitLabel="Lagre"
        initial={infoProjectData}
        onOpenChange={(open) => !open && setInfoTarget(null)}
        onSubmit={(info) => {
          if (infoProjectData) void updateProjectInfo(infoProjectData.id, info);
        }}
      />

      {renameProjectData && (
        <RenameDialog
          open={renameTarget !== null}
          title="Endre prosjektnavn"
          initialValue={renameProjectData.name}
          onOpenChange={(open) => !open && setRenameTarget(null)}
          onRename={(name) => {
            void renameProject(renameProjectData.id, name);
          }}
        />
      )}

      {deleteProjectData && (
        <ConfirmDialog
          open={deleteTarget !== null}
          title={`Slette «${deleteProjectData.name}»?`}
          description="Alle PDF-filer, kalibreringer og målinger i prosjektet slettes permanent. Dette kan ikke angres."
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => {
            void deleteProject(deleteProjectData.id);
            toast.success('Prosjekt slettet');
          }}
        />
      )}
    </div>
  );
}
