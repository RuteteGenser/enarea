import { create } from 'zustand';
import { filesRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import type { Calibration, OpeningItem, PdfFile } from '@/types';

type FilesStore = {
  filesByProject: Record<string, PdfFile[]>;
  filesLoaded: Record<string, boolean>;
  activeFileId: string | null;
  loadFiles: (projectId: string) => Promise<PdfFile[]>;
  addFile: (projectId: string, name: string, blob: Blob) => Promise<PdfFile>;
  renameFile: (fileId: string, name: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  setCalibration: (fileId: string, calibration: Calibration) => Promise<void>;
  setOpenings: (fileId: string, openings: OpeningItem[]) => Promise<void>;
  setActiveFile: (fileId: string | null) => void;
  getFile: (fileId: string) => PdfFile | undefined;
};

export const useFilesStore = create<FilesStore>((set, get) => ({
  filesByProject: {},
  filesLoaded: {},
  activeFileId: null,

  loadFiles: async (projectId: string) => {
    const files = await filesRepo.listByProject(projectId);
    set((state) => ({
      filesByProject: { ...state.filesByProject, [projectId]: files },
      filesLoaded: { ...state.filesLoaded, [projectId]: true },
    }));
    return files;
  },

  addFile: async (projectId: string, name: string, blob: Blob) => {
    const existing = get().filesByProject[projectId] ?? [];
    const file: PdfFile = {
      id: createId(),
      projectId,
      name,
      order: existing.length,
      pdfBlob: blob,
      calibration: null,
      createdAt: Date.now(),
    };
    await filesRepo.put(file);
    set((state) => ({
      filesByProject: { ...state.filesByProject, [projectId]: [...existing, file] },
    }));
    return file;
  },

  renameFile: async (fileId: string, name: string) => {
    const file = get().getFile(fileId);
    if (!file) return;
    const updated: PdfFile = { ...file, name: name.trim() || file.name };
    await filesRepo.put(updated);
    set((state) => ({
      filesByProject: {
        ...state.filesByProject,
        [file.projectId]: state.filesByProject[file.projectId].map((f) => (f.id === fileId ? updated : f)),
      },
    }));
  },

  deleteFile: async (fileId: string) => {
    const file = get().getFile(fileId);
    if (!file) return;
    await filesRepo.remove(fileId);
    set((state) => ({
      filesByProject: {
        ...state.filesByProject,
        [file.projectId]: state.filesByProject[file.projectId].filter((f) => f.id !== fileId),
      },
      activeFileId: state.activeFileId === fileId ? null : state.activeFileId,
    }));
  },

  setOpenings: async (fileId: string, openings: OpeningItem[]) => {
    const file = get().getFile(fileId);
    if (!file) return;
    const updated: PdfFile = { ...file, openings };
    await filesRepo.put(updated);
    set((state) => ({
      filesByProject: {
        ...state.filesByProject,
        [file.projectId]: state.filesByProject[file.projectId].map((f) => (f.id === fileId ? updated : f)),
      },
    }));
  },

  setCalibration: async (fileId: string, calibration: Calibration) => {
    const file = get().getFile(fileId);
    if (!file) return;
    const updated: PdfFile = { ...file, calibration };
    await filesRepo.put(updated);
    set((state) => ({
      filesByProject: {
        ...state.filesByProject,
        [file.projectId]: state.filesByProject[file.projectId].map((f) => (f.id === fileId ? updated : f)),
      },
    }));
  },

  setActiveFile: (fileId: string | null) => set({ activeFileId: fileId }),

  getFile: (fileId: string) => {
    for (const files of Object.values(get().filesByProject)) {
      const found = files.find((f) => f.id === fileId);
      if (found) return found;
    }
    return undefined;
  },
}));
