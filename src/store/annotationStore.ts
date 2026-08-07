import { create } from 'zustand';
import { annotationsRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import type { Annotation, EdgeMeta } from '@/types';

const MAX_HISTORY = 50;

type AnnotationStore = {
  fileId: string | null;
  annotations: Annotation[];
  past: Annotation[][];
  future: Annotation[][];
  selectedId: string | null;
  clipboard: Annotation | null;

  loadForFile: (fileId: string) => Promise<void>;
  commit: (next: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelected: (id: string | null) => void;
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;
  setEdgeMeta: (id: string, edgeIndex: number, meta: EdgeMeta) => void;
  bulkUpdateBuildingComponent: (typeId: string, patch: { uValue?: number; wallThickness?: number }) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
};

export const useAnnotationStore = create<AnnotationStore>((set, get) => ({
  fileId: null,
  annotations: [],
  past: [],
  future: [],
  selectedId: null,
  clipboard: null,

  loadForFile: async (fileId: string) => {
    const annotations = await annotationsRepo.listByFile(fileId);
    set({ fileId, annotations, past: [], future: [], selectedId: null });
  },

  commit: (next: Annotation[]) => {
    const { annotations, past, fileId } = get();
    if (!fileId) return;
    const trimmedPast = [...past, annotations].slice(-MAX_HISTORY);
    set({ annotations: next, past: trimmedPast, future: [] });
    void annotationsRepo.replaceAllForFile(fileId, next);
  },

  addAnnotation: (annotation: Annotation) => {
    get().commit([...get().annotations, annotation]);
    set({ selectedId: annotation.id });
  },

  updateAnnotation: (id: string, patch: Partial<Annotation>) => {
    const next = get().annotations.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a));
    get().commit(next);
  },

  deleteAnnotation: (id: string) => {
    const next = get().annotations.filter((a) => a.id !== id);
    get().commit(next);
    if (get().selectedId === id) set({ selectedId: null });
  },

  setSelected: (id: string | null) => set({ selectedId: id }),

  toggleLock: (id: string) => {
    const annotation = get().annotations.find((a) => a.id === id);
    if (!annotation) return;
    get().updateAnnotation(id, { locked: !annotation.locked });
  },

  toggleVisible: (id: string) => {
    const annotation = get().annotations.find((a) => a.id === id);
    if (!annotation) return;
    get().updateAnnotation(id, { visible: !annotation.visible });
  },

  setEdgeMeta: (id: string, edgeIndex: number, meta: EdgeMeta) => {
    const annotation = get().annotations.find((a) => a.id === id);
    if (!annotation) return;
    const edges = [...(annotation.edges ?? annotation.points.map(() => ({})))];
    edges[edgeIndex] = { ...edges[edgeIndex], ...meta };
    get().updateAnnotation(id, { edges });
  },

  bulkUpdateBuildingComponent: (typeId: string, patch: { uValue?: number; wallThickness?: number }) => {
    const now = Date.now();
    const next = get().annotations.map((annotation) => {
      const matchesShape = annotation.buildingComponent?.typeId === typeId;
      const edges = annotation.edges?.map((edge) =>
        edge.buildingComponent?.typeId === typeId
          ? { ...edge, buildingComponent: { ...edge.buildingComponent, ...patch } }
          : edge,
      );
      const edgesChanged = edges && edges.some((edge, i) => edge !== annotation.edges?.[i]);
      if (!matchesShape && !edgesChanged) return annotation;
      return {
        ...annotation,
        ...(matchesShape && { buildingComponent: { ...annotation.buildingComponent!, ...patch } }),
        ...(edgesChanged && { edges }),
        updatedAt: now,
      };
    });
    get().commit(next);
  },

  copySelected: () => {
    const { selectedId, annotations } = get();
    const annotation = annotations.find((a) => a.id === selectedId);
    if (!annotation) return;
    set({ clipboard: annotation });
  },

  pasteClipboard: () => {
    const { clipboard, fileId } = get();
    if (!clipboard || !fileId) return;
    const offset = 12;
    const pasted: Annotation = {
      ...clipboard,
      id: createId(),
      fileId,
      name: clipboard.name ? `${clipboard.name} kopi` : undefined,
      points: clipboard.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
      locked: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    get().addAnnotation(pasted);
  },

  undo: () => {
    const { past, annotations, future, fileId } = get();
    if (past.length === 0 || !fileId) return;
    const previous = past[past.length - 1];
    set({
      annotations: previous,
      past: past.slice(0, -1),
      future: [annotations, ...future],
    });
    void annotationsRepo.replaceAllForFile(fileId, previous);
  },

  redo: () => {
    const { future, annotations, past, fileId } = get();
    if (future.length === 0 || !fileId) return;
    const next = future[0];
    set({
      annotations: next,
      past: [...past, annotations],
      future: future.slice(1),
    });
    void annotationsRepo.replaceAllForFile(fileId, next);
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
