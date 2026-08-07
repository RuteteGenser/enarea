import type { PdfLayer } from '@/types';

export type LayerVisibilityUpdate = { id: string; visible: boolean };

/** Stable empty-array reference so selectors falling back to "no selection yet"
 *  don't create a new array identity every render (which would re-trigger
 *  effects/selectors that depend on it). */
export const EMPTY_LAYER_SELECTION: readonly string[] = [];

/**
 * Layers whose name IS in `selectedNames`: visible = `layersVisible`.
 * All other layers: always visible = true (untouched/default).
 */
export function computeLayerVisibilityUpdates(
  layers: PdfLayer[],
  selectedNames: readonly string[],
  layersVisible: boolean,
): LayerVisibilityUpdate[] {
  const selected = new Set(selectedNames);
  return layers.map((layer) => ({
    id: layer.id,
    visible: selected.has(layer.name) ? layersVisible : true,
  }));
}
