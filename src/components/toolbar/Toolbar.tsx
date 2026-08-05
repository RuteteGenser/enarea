import {
  MousePointer2,
  Hand,
  Slash,
  Square,
  Hexagon,
  Ruler,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Eye,
  Download,
} from 'lucide-react';
import ToolButton from '@/components/toolbar/ToolButton';
import UnitToggle from '@/components/toolbar/UnitToggle';
import ShortcutsHelp from '@/components/toolbar/ShortcutsHelp';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useViewportStore } from '@/store/viewportStore';
import { useAnnotationStore } from '@/store/annotationStore';
import type { PdfFile, ToolId } from '@/types';

type ToolbarProps = {
  file: PdfFile | undefined;
  onExport: () => void;
};

const DRAW_TOOLS: { id: ToolId; icon: typeof Slash; label: string; shortcut: string }[] = [
  { id: 'line', icon: Slash, label: 'Linje', shortcut: 'L' },
  { id: 'rectangle', icon: Square, label: 'Rektangel', shortcut: 'R' },
  { id: 'polygon', icon: Hexagon, label: 'Polygon', shortcut: 'P' },
];

export default function Toolbar({ file, onExport }: ToolbarProps) {
  const tool = useViewportStore((s) => s.tool);
  const setTool = useViewportStore((s) => s.setTool);
  const zoom = useViewportStore((s) => s.zoom);
  const zoomBy = useViewportStore((s) => s.zoomBy);
  const setZoom = useViewportStore((s) => s.setZoom);
  const showAnnotations = useViewportStore((s) => s.showAnnotations);
  const toggleAnnotationsVisible = useViewportStore((s) => s.toggleAnnotationsVisible);
  const showScaleBar = useViewportStore((s) => s.showScaleBar);
  const toggleScaleBar = useViewportStore((s) => s.toggleScaleBar);
  const panelOpen = useViewportStore((s) => s.panelOpen);
  const togglePanel = useViewportStore((s) => s.togglePanel);

  const undo = useAnnotationStore((s) => s.undo);
  const redo = useAnnotationStore((s) => s.redo);
  const canUndo = useAnnotationStore((s) => s.past.length > 0);
  const canRedo = useAnnotationStore((s) => s.future.length > 0);

  const calibrated = !!file?.calibration;

  return (
    <div className="h-12 shrink-0 overflow-x-auto overflow-y-hidden border-b border-border bg-toolbar no-scrollbar">
      <div className="flex h-12 w-max min-w-full items-center gap-1 px-2">
        <ToolButton
          icon={MousePointer2}
          label="Velg"
          shortcut="V"
          active={tool === 'select'}
          onClick={() => setTool('select')}
        />
        <ToolButton
          icon={Hand}
          label="Panorer"
          shortcut="H"
          active={tool === 'pan'}
          onClick={() => setTool('pan')}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        {DRAW_TOOLS.map((t) => (
          <ToolButton
            key={t.id}
            icon={t.icon}
            label={t.label}
            shortcut={t.shortcut}
            active={tool === t.id}
            disabled={!calibrated}
            disabledReason="Kalibrer PDF-en først"
            onClick={() => setTool(t.id)}
          />
        ))}

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolButton
          icon={Ruler}
          label="Kalibrer"
          active={tool === 'calibrate'}
          onClick={() => setTool('calibrate')}
        />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <ToolButton icon={Undo2} label="Angre" shortcut="Ctrl+Z" disabled={!canUndo} onClick={undo} />
        <ToolButton icon={Redo2} label="Gjør om" shortcut="Ctrl+Shift+Z" disabled={!canRedo} onClick={redo} />

        <div className="flex-1" />

        <UnitToggle />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <div className="flex items-center gap-0.5">
          <ToolButton icon={ZoomOut} label="Zoom ut" onClick={() => zoomBy(1 / 1.25)} />
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="w-12 rounded-md py-1 text-center text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            title="Tilbakestill zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <ToolButton icon={ZoomIn} label="Zoom inn" onClick={() => zoomBy(1.25)} />
        </div>

        <Separator orientation="vertical" className="mx-1 h-6" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <Eye />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuCheckboxItem checked={showAnnotations} onCheckedChange={toggleAnnotationsVisible}>
              Vis annotasjoner
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={showScaleBar} onCheckedChange={toggleScaleBar}>
              Vis målestokk
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem checked={panelOpen} onCheckedChange={togglePanel}>
              Vis målepanel
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ShortcutsHelp />

        <Separator orientation="vertical" className="mx-1 h-6" />

        <Button variant="outline" size="sm" onClick={onExport} disabled={!file}>
          <Download /> Eksporter
        </Button>
      </div>
    </div>
  );
}
