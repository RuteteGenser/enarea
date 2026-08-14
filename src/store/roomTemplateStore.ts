import { create } from 'zustand';
import { roomTemplatesRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import type { RoomTemplate, VentilationUnit } from '@/types';

type RoomTemplateStore = {
  templates: RoomTemplate[];
  loaded: boolean;
  loadTemplates: () => Promise<void>;
  createTemplate: (
    name: string,
    ventilationRate?: number,
    ventilationUnit?: VentilationUnit,
    note?: string,
    aliases?: string[],
  ) => Promise<RoomTemplate>;
  updateTemplate: (
    id: string,
    patch: Partial<Pick<RoomTemplate, 'name' | 'aliases' | 'ventilationRate' | 'ventilationUnit' | 'note'>>,
  ) => Promise<void>;
  deleteTemplate: (id: string) => Promise<void>;
};

export const useRoomTemplateStore = create<RoomTemplateStore>((set, get) => ({
  templates: [],
  loaded: false,

  loadTemplates: async () => {
    const templates = await roomTemplatesRepo.list();
    set({ templates, loaded: true });
  },

  createTemplate: async (name, ventilationRate, ventilationUnit, note, aliases) => {
    const now = Date.now();
    const template: RoomTemplate = {
      id: createId(),
      name: name.trim() || 'Uten navn',
      aliases,
      ventilationRate,
      ventilationUnit,
      note,
      createdAt: now,
      updatedAt: now,
    };
    await roomTemplatesRepo.put(template);
    set((state) => ({ templates: [...state.templates, template] }));
    return template;
  },

  updateTemplate: async (id, patch) => {
    const template = get().templates.find((t) => t.id === id);
    if (!template) return;
    const updated: RoomTemplate = { ...template, ...patch, updatedAt: Date.now() };
    await roomTemplatesRepo.put(updated);
    set((state) => ({ templates: state.templates.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteTemplate: async (id) => {
    await roomTemplatesRepo.remove(id);
    set((state) => ({ templates: state.templates.filter((t) => t.id !== id) }));
  },
}));
