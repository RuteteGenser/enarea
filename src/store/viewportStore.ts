import { create } from 'zustand';
import type { PdfLayer, ToolId, Unit } from '@/types';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

type ViewportStore = {
  tool: ToolId;
  zoom: number;
  fitZoom: number;
  unit: Unit;
  /** Unit for typing in the reference-line length only; the project units (`unit`) are unaffected. */
  calibrationUnit: Unit;
  showScaleBar: boolean;
  showCompass: boolean;
  showAnnotations: boolean;
  panelOpen: boolean;
  isSpaceDown: boolean;
  isShiftDown: boolean;
  openingsDialogOpen: boolean;
  wallsDialogOpen: boolean;
  placingOpeningId: string | null;
  drawingInProgress: boolean;
  magnifierScreenPos: { x: number; y: number } | null;
  pendingJumpId: string | null;
  pdfLayers: PdfLayer[];
  layersVisible: boolean;

  setTool: (tool: ToolId) => void;
  setZoom: (zoom: number) => void;
  setFitZoom: (fitZoom: number) => void;
  zoomBy: (factor: number, anchor?: { x: number; y: number }) => void;
  setUnit: (unit: Unit) => void;
  setCalibrationUnit: (unit: Unit) => void;
  toggleScaleBar: () => void;
  toggleCompass: () => void;
  toggleAnnotationsVisible: () => void;
  togglePanel: () => void;
  setSpaceDown: (down: boolean) => void;
  setShiftDown: (down: boolean) => void;
  setOpeningsDialogOpen: (open: boolean) => void;
  setWallsDialogOpen: (open: boolean) => void;
  setPlacingOpeningId: (id: string | null) => void;
  setDrawingInProgress: (active: boolean) => void;
  setMagnifierScreenPos: (pos: { x: number; y: number } | null) => void;
  requestJump: (id: string | null) => void;
  setPdfLayers: (layers: PdfLayer[]) => void;
  toggleLayersVisible: () => void;
  resetLayersVisible: () => void;
};

export const useViewportStore = create<ViewportStore>((set, get) => ({
  tool: 'select',
  zoom: 1,
  fitZoom: 1,
  unit: 'm',
  calibrationUnit: 'mm',
  showScaleBar: true,
  showCompass: true,
  showAnnotations: true,
  panelOpen: true,
  isSpaceDown: false,
  isShiftDown: false,
  openingsDialogOpen: false,
  wallsDialogOpen: false,
  placingOpeningId: null,
  drawingInProgress: false,
  magnifierScreenPos: null,
  pendingJumpId: null,
  pdfLayers: [],
  layersVisible: true,

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  setFitZoom: (fitZoom) => {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, fitZoom));
    set({ fitZoom: clamped, zoom: clamped });
  },
  zoomBy: (factor) => {
    const next = get().zoom * factor;
    set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)) });
  },
  setUnit: (unit) => set({ unit }),
  setCalibrationUnit: (calibrationUnit) => set({ calibrationUnit }),
  toggleScaleBar: () => set((s) => ({ showScaleBar: !s.showScaleBar })),
  toggleCompass: () => set((s) => ({ showCompass: !s.showCompass })),
  toggleAnnotationsVisible: () => set((s) => ({ showAnnotations: !s.showAnnotations })),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setSpaceDown: (down) => set({ isSpaceDown: down }),
  setShiftDown: (down) => set({ isShiftDown: down }),
  setOpeningsDialogOpen: (open) => set({ openingsDialogOpen: open }),
  setWallsDialogOpen: (open) => set({ wallsDialogOpen: open }),
  setPlacingOpeningId: (id) => set({ placingOpeningId: id }),
  setDrawingInProgress: (active) => set({ drawingInProgress: active }),
  setMagnifierScreenPos: (pos) => set({ magnifierScreenPos: pos }),
  requestJump: (id) => set({ pendingJumpId: id }),
  setPdfLayers: (layers) => set({ pdfLayers: layers }),
  toggleLayersVisible: () => set((s) => ({ layersVisible: !s.layersVisible })),
  resetLayersVisible: () => set({ layersVisible: true }),
}));
