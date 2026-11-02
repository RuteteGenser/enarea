import { create } from 'zustand';
import { annotationsRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import { movePersonMarkers, trimPersonMarkers } from '@/lib/personMarkers';
import { useFilesStore } from '@/store/filesStore';
import type { Annotation, EdgeMeta, PlacedOpening } from '@/types';

const MAX_HISTORY = 50;

/**
 * Operations that renumber the sides of an area (splitting a wall, removing a corner) also move the placed
 * windows/doors. The placements that belong to a given list of annotations are remembered here (keyed by the
 * list itself), so Ctrl+Z / Ctrl+Shift+Z can put the windows back together with the geometry.
 */
const placementSnapshots = new WeakMap<Annotation[], PlacedOpening[]>();

export function rememberPlacements(annotations: Annotation[], placed: PlacedOpening[]): void {
  placementSnapshots.set(annotations, placed);
}

/**
 * Deleting areas takes the windows/doors placed on them along (they would otherwise stay in the file's data
 * without a wall, and still be counted). Ctrl+Z brings them back with the areas.
 */
function commitDeletion(commit: (next: Annotation[]) => void, current: Annotation[], fileId: string | null, doomed: Set<string>): void {
  const file = fileId ? useFilesStore.getState().getFile(fileId) : undefined;
  const placed = file?.placedOpenings;
  const hasPlacements = !!placed?.some((p) => doomed.has(p.annotationId));
  if (hasPlacements && placed) rememberCurrentPlacements(fileId, current);
  commit(current.filter((a) => !doomed.has(a.id)));
  if (hasPlacements && placed && file) {
    const remaining = placed.filter((p) => !doomed.has(p.annotationId));
    placementSnapshots.set(useAnnotationStore.getState().annotations, remaining);
    void useFilesStore.getState().setOpenings(file.id, file.openings ?? [], remaining);
  }
}

/** Before leaving a state, note where its windows/doors are — unless something remembered them already. */
function rememberCurrentPlacements(fileId: string | null, annotations: Annotation[]): void {
  const file = fileId ? useFilesStore.getState().getFile(fileId) : undefined;
  if (file?.placedOpenings && !placementSnapshots.has(annotations)) placementSnapshots.set(annotations, file.placedOpenings);
}

/** Puts the windows/doors back to what they were for this state of the annotations, if it was remembered. */
function restorePlacements(fileId: string | null, annotations: Annotation[]): void {
  const snapshot = placementSnapshots.get(annotations);
  const file = fileId ? useFilesStore.getState().getFile(fileId) : undefined;
  if (snapshot && file) void useFilesStore.getState().setOpenings(file.id, file.openings ?? [], snapshot);
}

/** While > 0, commits skip the undo history; `batch` pushes a single entry for the whole group. */
let batchDepth = 0;

type AnnotationStore = {
  fileId: string | null;
  annotations: Annotation[];
  past: Annotation[][];
  future: Annotation[][];
  /** The most recently selected element (null when nothing, or several via `selectedIds`). */
  selectedId: string | null;
  /** Everything selected; more than one with Shift+click or the box-select tool. */
  selectedIds: string[];
  clipboard: Annotation | null;

  loadForFile: (fileId: string) => Promise<void>;
  commit: (next: Annotation[]) => void;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, patch: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  setSelected: (id: string | null) => void;
  /** Shift+click: adds the element to the selection, or removes it if it was already selected. */
  toggleSelected: (id: string) => void;
  setSelectedMany: (ids: string[]) => void;
  deleteSelected: () => void;
  /** Runs several edits as one undo step. */
  batch: (fn: () => void) => void;
  toggleLock: (id: string) => void;
  toggleVisible: (id: string) => void;
  setEdgeMeta: (id: string, edgeIndex: number, meta: EdgeMeta) => void;
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
  selectedIds: [],
  clipboard: null,

  loadForFile: async (fileId: string) => {
    const annotations = await annotationsRepo.listByFile(fileId);
    set({ fileId, annotations, past: [], future: [], selectedId: null, selectedIds: [] });
  },

  commit: (next: Annotation[]) => {
    const { annotations, past, fileId } = get();
    if (!fileId) return;
    if (batchDepth > 0) {
      set({ annotations: next });
    } else {
      const trimmedPast = [...past, annotations].slice(-MAX_HISTORY);
      set({ annotations: next, past: trimmedPast, future: [] });
    }
    void annotationsRepo.replaceAllForFile(fileId, next);
  },

  addAnnotation: (annotation: Annotation) => {
    get().commit([...get().annotations, annotation]);
    set({ selectedId: annotation.id, selectedIds: [annotation.id] });
  },

  updateAnnotation: (id: string, patch: Partial<Annotation>) => {
    // Lowering the number of people (e.g. in Målinger) also removes the surplus person icons from the drawing.
    if ('people' in patch && !('personMarkers' in patch)) {
      const markers = get().annotations.find((a) => a.id === id)?.personMarkers;
      if (markers && markers.length > (patch.people ?? 0)) {
        patch = { ...patch, personMarkers: trimPersonMarkers(markers, patch.people ?? 0) };
      }
    }
    const next = get().annotations.map((a) => (a.id === id ? { ...a, ...patch, updatedAt: Date.now() } : a));
    get().commit(next);
  },

  deleteAnnotation: (id: string) => {
    commitDeletion(get().commit, get().annotations, get().fileId, new Set([id]));
    const selectedIds = get().selectedIds.filter((s) => s !== id);
    set({ selectedIds, selectedId: selectedIds.length === 1 ? selectedIds[0] : get().selectedId === id ? null : get().selectedId });
  },

  setSelected: (id: string | null) => set({ selectedId: id, selectedIds: id ? [id] : [] }),

  toggleSelected: (id: string) => {
    const { selectedIds } = get();
    const next = selectedIds.includes(id) ? selectedIds.filter((s) => s !== id) : [...selectedIds, id];
    set({ selectedIds: next, selectedId: next.length === 1 ? next[0] : null });
  },

  setSelectedMany: (ids: string[]) => set({ selectedIds: ids, selectedId: ids.length === 1 ? ids[0] : null }),

  batch: (fn) => {
    const before = get().annotations;
    batchDepth++;
    try {
      fn();
    } finally {
      batchDepth--;
    }
    if (batchDepth === 0 && get().annotations !== before) {
      set({ past: [...get().past, before].slice(-MAX_HISTORY), future: [] });
    }
  },

  deleteSelected: () => {
    const { annotations, selectedIds } = get();
    const doomed = new Set(annotations.filter((a) => selectedIds.includes(a.id) && !a.locked).map((a) => a.id));
    if (doomed.size === 0) return;
    commitDeletion(get().commit, annotations, get().fileId, doomed);
    const left = selectedIds.filter((id) => !doomed.has(id));
    set({ selectedIds: left, selectedId: left.length === 1 ? left[0] : null });
  },

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
      regions: clipboard.regions?.map((region) => region.map((p) => ({ x: p.x + offset, y: p.y + offset }))),
      personMarkers: movePersonMarkers(clipboard.personMarkers, offset, offset, createId),
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
    rememberCurrentPlacements(fileId, annotations);
    restorePlacements(fileId, previous);
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
    rememberCurrentPlacements(fileId, annotations);
    restorePlacements(fileId, next);
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
