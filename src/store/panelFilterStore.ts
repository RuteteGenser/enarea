import { create } from 'zustand';
import type { MissingFilter } from '@/lib/panelFilter';

/** The search text and the "mangler …" filter at the top of Målinger; they narrow every table in the panel. */
type PanelFilterStore = {
  search: string;
  missing: MissingFilter;
  setSearch: (search: string) => void;
  setMissing: (missing: MissingFilter) => void;
};

export const usePanelFilterStore = create<PanelFilterStore>((set) => ({
  search: '',
  missing: 'alle',
  setSearch: (search) => set({ search }),
  setMissing: (missing) => set({ missing }),
}));
