import { create } from 'zustand';
import { buildingComponentTypesRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import type { BuildingComponentCategory, BuildingComponentType } from '@/types';

type BuildingComponentTypeStore = {
  types: BuildingComponentType[];
  loaded: boolean;
  loadTypes: () => Promise<void>;
  createType: (category: BuildingComponentCategory, name: string, uValue: number, wallThickness?: number) => Promise<BuildingComponentType>;
  updateType: (id: string, patch: Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>) => Promise<void>;
  deleteType: (id: string) => Promise<void>;
};

export const useBuildingComponentTypeStore = create<BuildingComponentTypeStore>((set, get) => ({
  types: [],
  loaded: false,

  loadTypes: async () => {
    const types = await buildingComponentTypesRepo.list();
    set({ types, loaded: true });
  },

  createType: async (category, name, uValue, wallThickness) => {
    const now = Date.now();
    const type: BuildingComponentType = {
      id: createId(),
      category,
      name: name.trim() || 'Uten navn',
      uValue,
      wallThickness,
      createdAt: now,
      updatedAt: now,
    };
    await buildingComponentTypesRepo.put(type);
    set((state) => ({ types: [...state.types, type] }));
    return type;
  },

  updateType: async (id, patch) => {
    const type = get().types.find((t) => t.id === id);
    if (!type) return;
    const updated: BuildingComponentType = { ...type, ...patch, updatedAt: Date.now() };
    await buildingComponentTypesRepo.put(updated);
    set((state) => ({ types: state.types.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteType: async (id) => {
    await buildingComponentTypesRepo.remove(id);
    set((state) => ({ types: state.types.filter((t) => t.id !== id) }));
  },
}));
