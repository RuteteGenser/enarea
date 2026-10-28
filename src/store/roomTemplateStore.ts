import { create } from 'zustand';
import { roomTemplatesRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import { DEFAULT_ROOM_TEMPLATES } from '@/lib/defaultRoomTemplates';
import type { RoomTemplate, VentilationUnit } from '@/types';

const SEEDED_KEY = 'roomTemplatesSeeded';

function wasSeeded(): boolean {
  try {
    return localStorage.getItem(SEEDED_KEY) === '1';
  } catch {
    return true; // storage unavailable: don't seed on every load
  }
}

function markSeeded() {
  try {
    localStorage.setItem(SEEDED_KEY, '1');
  } catch {
    /* ignore */
  }
}

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
    let templates = await roomTemplatesRepo.list();
    // First use: add the standard room types once (never re-added after the user deletes them).
    if (templates.length === 0 && !wasSeeded()) {
      const now = Date.now();
      templates = DEFAULT_ROOM_TEMPLATES.map((t, i) => ({
        id: createId(),
        name: t.name,
        ventilationRate: t.rate,
        ventilationUnit: t.unit,
        createdAt: now + i,
        updatedAt: now + i,
      }));
      for (const template of templates) await roomTemplatesRepo.put(template);
    }
    markSeeded();
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
