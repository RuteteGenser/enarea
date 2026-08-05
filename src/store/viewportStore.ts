import { create } from 'zustand';
import type { ToolId, Unit } from '@/types';

const MIN_ZOOM = 0.2;
const MAX_ZOOM = 8;

type ViewportStore = {
  tool: ToolId;
  zoom: number;
  unit: Unit;
  showScaleBar: boolean;
  showAnnotations: boolean;
  panelOpen: boolean;
  isSpaceDown: boolean;

  setTool: (tool: ToolId) => void;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number, anchor?: { x: number; y: number }) => void;
  setUnit: (unit: Unit) => void;
  toggleScaleBar: () => void;
  toggleAnnotationsVisible: () => void;
  togglePanel: () => void;
  setSpaceDown: (down: boolean) => void;
};

export const useViewportStore = create<ViewportStore>((set, get) => ({
  tool: 'select',
  zoom: 1,
  unit: 'm',
  showScaleBar: true,
  showAnnotations: true,
  panelOpen: true,
  isSpaceDown: false,

  setTool: (tool) => set({ tool }),
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  zoomBy: (factor) => {
    const next = get().zoom * factor;
    set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next)) });
  },
  setUnit: (unit) => set({ unit }),
  toggleScaleBar: () => set((s) => ({ showScaleBar: !s.showScaleBar })),
  toggleAnnotationsVisible: () => set((s) => ({ showAnnotations: !s.showAnnotations })),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
  setSpaceDown: (down) => set({ isSpaceDown: down }),
}));
