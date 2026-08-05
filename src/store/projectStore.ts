import { create } from 'zustand';
import { projectsRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import type { Project } from '@/types';

type ProjectStore = {
  projects: Project[];
  loaded: boolean;
  loadProjects: () => Promise<void>;
  createProject: (name: string) => Promise<Project>;
  renameProject: (id: string, name: string) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  updateNorthDirection: (id: string, degrees: number) => Promise<void>;
  getProject: (id: string) => Project | undefined;
};

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  loaded: false,

  loadProjects: async () => {
    const projects = await projectsRepo.list();
    set({ projects, loaded: true });
  },

  createProject: async (name: string) => {
    const now = Date.now();
    const project: Project = {
      id: createId(),
      name: name.trim() || 'Uten navn',
      northDirection: 0,
      createdAt: now,
      updatedAt: now,
    };
    await projectsRepo.put(project);
    set((state) => ({ projects: [project, ...state.projects] }));
    return project;
  },

  renameProject: async (id: string, name: string) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    const updated: Project = { ...project, name: name.trim() || project.name, updatedAt: Date.now() };
    await projectsRepo.put(updated);
    set((state) => ({ projects: state.projects.map((p) => (p.id === id ? updated : p)) }));
  },

  deleteProject: async (id: string) => {
    await projectsRepo.remove(id);
    set((state) => ({ projects: state.projects.filter((p) => p.id !== id) }));
  },

  updateNorthDirection: async (id: string, degrees: number) => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) return;
    const normalized = ((degrees % 360) + 360) % 360;
    const updated: Project = { ...project, northDirection: normalized, updatedAt: Date.now() };
    await projectsRepo.put(updated);
    set((state) => ({ projects: state.projects.map((p) => (p.id === id ? updated : p)) }));
  },

  getProject: (id: string) => get().projects.find((p) => p.id === id),
}));
