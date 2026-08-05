import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Settings, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FileTabs from '@/components/project/FileTabs';
import ProjectSettingsDialog from '@/components/project/ProjectSettingsDialog';
import ExportDialog from '@/components/export/ExportDialog';
import Toolbar from '@/components/toolbar/Toolbar';
import PdfCanvas from '@/components/viewer/PdfCanvas';
import MeasurementPanel from '@/components/panel/MeasurementPanel';
import { useProjectStore } from '@/store/projectStore';
import { useFilesStore } from '@/store/filesStore';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import { useKeyboardShortcuts } from '@/components/tools/useKeyboardShortcuts';

export default function Workspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { projects, loaded, loadProjects } = useProjectStore();
  const { filesByProject, loadFiles, activeFileId, setActiveFile, getFile } = useFilesStore();
  const loadAnnotationsForFile = useAnnotationStore((s) => s.loadForFile);
  const panelOpen = useViewportStore((s) => s.panelOpen);

  const project = projects.find((p) => p.id === projectId);
  const files = projectId ? (filesByProject[projectId] ?? []) : [];
  const activeFile = activeFileId ? getFile(activeFileId) : undefined;
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useKeyboardShortcuts(true);

  useEffect(() => {
    if (!loaded) void loadProjects();
  }, [loaded, loadProjects]);

  useEffect(() => {
    if (projectId) void loadFiles(projectId);
  }, [projectId, loadFiles]);

  useEffect(() => {
    if (!activeFileId && files.length > 0) setActiveFile(files[0].id);
  }, [activeFileId, files, setActiveFile]);

  useEffect(() => {
    if (activeFileId) void loadAnnotationsForFile(activeFileId);
  }, [activeFileId, loadAnnotationsForFile]);

  if (loaded && !project) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Fant ikke prosjektet.</p>
        <Button onClick={() => navigate('/')}>Til prosjektliste</Button>
      </div>
    );
  }

  return (
    <div className="flex h-svh flex-col overflow-hidden bg-background">
      <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-toolbar px-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')} title="Til prosjektliste">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="truncate text-sm font-medium text-foreground">{project?.name}</span>
        <div className="flex-1" />
        {project && (
          <Button variant="ghost" size="icon-sm" onClick={() => setSettingsOpen(true)} title="Prosjektinnstillinger">
            <Settings className="size-4" />
          </Button>
        )}
      </div>

      {project && (
        <ProjectSettingsDialog open={settingsOpen} project={project} onOpenChange={setSettingsOpen} />
      )}
      {project && (
        <ExportDialog open={exportOpen} project={project} files={files} onOpenChange={setExportOpen} />
      )}

      {projectId && (
        <FileTabs projectId={projectId} files={files} activeFileId={activeFileId} onSelect={setActiveFile} />
      )}

      {activeFile && <Toolbar file={activeFile} onExport={() => setExportOpen(true)} />}

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeFile ? (
          <PdfCanvas key={activeFile.id} file={activeFile} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Upload className="size-6" />
            Last opp en PDF for å komme i gang
          </div>
        )}

        {activeFile && panelOpen && (
          <div className="h-44 shrink-0 border-t border-border bg-panel">
            <MeasurementPanel calibration={activeFile.calibration} />
          </div>
        )}
      </div>
    </div>
  );
}
