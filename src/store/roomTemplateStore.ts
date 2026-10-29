import { create } from 'zustand';
import { roomTemplatesRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import { DEFAULT_ROOM_TEMPLATES, LEGACY_ROOM_TEMPLATES } from '@/lib/defaultRoomTemplates';
import type { RoomTemplate, VentilationUnit } from '@/types';

// v2: the standard room types are "i bruk" / "ikke i bruk"; the earlier set is removed once.
const SEEDED_KEY = 'roomTemplatesSeeded.v2';

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

// Several components ask for the templates at once; share one load so the seeding only runs once.
let loading: Promise<void> | null = null;

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

  loadTemplates: () => {
    loading ??= (async () => {
      let templates = await roomTemplatesRepo.list();
      // Once: drop the earlier default room types and add the current standard ones (never re-added
      // after the user deletes them).
      if (!wasSeeded()) {
        const isLegacy = (t: RoomTemplate) =>
          LEGACY_ROOM_TEMPLATES.some((l) => l.name === t.name && l.rate === t.ventilationRate);
        for (const legacy of templates.filter(isLegacy)) await roomTemplatesRepo.remove(legacy.id);
        templates = templates.filter((t) => !isLegacy(t));

        const now = Date.now();
        const added = DEFAULT_ROOM_TEMPLATES.filter((d) => !templates.some((t) => t.name === d.name)).map(
          (t, i): RoomTemplate => ({
            id: createId(),
            name: t.name,
            ventilationRate: t.rate,
            ventilationUnit: t.unit,
            perPersonRate: t.perPerson,
            createdAt: now + i,
            updatedAt: now + i,
          }),
        );
        for (const template of added) await roomTemplatesRepo.put(template);
        templates = [...templates, ...added];
      }
      markSeeded();
      set({ templates, loaded: true });
    })().finally(() => {
      loading = null;
    });
    return loading;
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
