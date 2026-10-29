import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FileTabs from '@/components/project/FileTabs';
import ExportDialog from '@/components/export/ExportDialog';
import Toolbar from '@/components/toolbar/Toolbar';
import PdfCanvas from '@/components/viewer/PdfCanvas';
import OpeningsDialog from '@/components/openings/OpeningsDialog';
import WallsDialog from '@/components/wall/WallsDialog';
import MeasurementPanel, { MeasurementHeader } from '@/components/panel/MeasurementPanel';
import { useProjectStore } from '@/store/projectStore';
import { useFilesStore } from '@/store/filesStore';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import { useRoomTemplateStore } from '@/store/roomTemplateStore';
import { useKeyboardShortcuts } from '@/components/tools/useKeyboardShortcuts';

export default function Workspace() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const { projects, loaded, loadProjects } = useProjectStore();
  const { filesByProject, filesLoaded: filesLoadedByProject, loadFiles, activeFileId, setActiveFile } =
    useFilesStore();
  const loadAnnotationsForFile = useAnnotationStore((s) => s.loadForFile);
  const panelOpen = useViewportStore((s) => s.panelOpen);
  const togglePanel = useViewportStore((s) => s.togglePanel);
  const resetLayersVisible = useViewportStore((s) => s.resetLayersVisible);
  const roomTemplatesLoaded = useRoomTemplateStore((s) => s.loaded);
  const loadRoomTemplates = useRoomTemplateStore((s) => s.loadTemplates);

  const project = projects.find((p) => p.id === projectId);
  const files = projectId ? (filesByProject[projectId] ?? []) : [];
  const filesLoaded = projectId ? !!filesLoadedByProject[projectId] : false;
  // Only a file of *this* project can be active: the active id is global and would otherwise keep
  // showing the last PDF from another project when opening a new one.
  const activeFile = activeFileId ? files.find((f) => f.id === activeFileId) : undefined;
  const [exportOpen, setExportOpen] = useState(false);
  const [initialPdfReady, setInitialPdfReady] = useState(false);

  useKeyboardShortcuts(true);

  useEffect(() => {
    setInitialPdfReady(false);
  }, [projectId]);

  useEffect(() => {
    if (!loaded) void loadProjects();
  }, [loaded, loadProjects]);

  useEffect(() => {
    if (projectId) void loadFiles(projectId);
  }, [projectId, loadFiles]);

  useEffect(() => {
    resetLayersVisible();
  }, [projectId, resetLayersVisible]);

  useEffect(() => {
    if (!filesLoaded) return;
    const belongsHere = activeFileId !== null && files.some((f) => f.id === activeFileId);
    if (belongsHere) return;
    const next = files[0]?.id ?? null;
    if (next !== activeFileId) setActiveFile(next);
  }, [filesLoaded, activeFileId, files, setActiveFile]);

  useEffect(() => {
    if (activeFileId) void loadAnnotationsForFile(activeFileId);
  }, [activeFileId, loadAnnotationsForFile]);

  useEffect(() => {
    if (!roomTemplatesLoaded) void loadRoomTemplates();
  }, [roomTemplatesLoaded, loadRoomTemplates]);

  if (loaded && !project) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">Fant ikke prosjektet.</p>
        <Button onClick={() => navigate('/')}>Til prosjektliste</Button>
      </div>
    );
  }

  const showSpinner =
    !loaded || (!!project && !filesLoaded) || (!!project && filesLoaded && files.length > 0 && !initialPdfReady);

  return (
    <div className="relative flex h-svh flex-col overflow-hidden bg-background">
      {showSpinner && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}

      <div className="on-chrome flex h-11 shrink-0 items-center gap-3 border-b border-border bg-toolbar px-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')} title="Til prosjektliste">
          <ArrowLeft className="size-4" />
        </Button>
        <span className="truncate text-sm font-medium text-foreground">{project?.name}</span>
        <div className="flex-1" />
      </div>

      {project && (
        <ExportDialog open={exportOpen} project={project} files={files} onOpenChange={setExportOpen} />
      )}

      {projectId && (
        <FileTabs projectId={projectId} files={files} activeFileId={activeFileId} onSelect={setActiveFile} />
      )}

      {activeFile && <Toolbar file={activeFile} onExport={() => setExportOpen(true)} />}
      {activeFile && <OpeningsDialog file={activeFile} />}
      {activeFile && <WallsDialog file={activeFile} />}

      <div className="flex flex-1 flex-col overflow-hidden">
        {activeFile ? (
          <PdfCanvas key={activeFile.id} file={activeFile} onFirstRender={() => setInitialPdfReady(true)} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <Upload className="size-6" />
            Last opp en PDF for å komme i gang
          </div>
        )}

        {activeFile && (
          <>
            <MeasurementHeader calibration={activeFile.calibration} open={panelOpen} onToggle={togglePanel} />
            <div
              className={`on-chrome shrink-0 overflow-hidden bg-panel transition-[height] duration-300 ease-in-out motion-reduce:transition-none ${panelOpen ? 'h-40' : 'h-0'}`}
              aria-hidden={!panelOpen}
            >
              <div className="h-40">
                <MeasurementPanel calibration={activeFile.calibration} openings={activeFile.openings} />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
