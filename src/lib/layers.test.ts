import { describe, expect, it } from 'vitest';
import { computeLayerVisibilityUpdates } from '@/lib/layers';
import type { PdfLayer } from '@/types';

const layers: PdfLayer[] = [
  { id: '10R', name: '838- Annen tekst', visible: true },
  { id: '17R', name: 'A-WALL-____-OTLN.IFC', visible: true },
];

describe('computeLayerVisibilityUpdates', () => {
  it('hides selected layers when layersVisible is false', () => {
    const updates = computeLayerVisibilityUpdates(layers, ['838- Annen tekst'], false);
    expect(updates).toEqual([
      { id: '10R', visible: false },
      { id: '17R', visible: true },
    ]);
  });

  it('keeps non-selected layers visible regardless of the toggle', () => {
    const updates = computeLayerVisibilityUpdates(layers, ['A-WALL-____-OTLN.IFC'], false);
    expect(updates.find((u) => u.id === '10R')).toEqual({ id: '10R', visible: true });
  });

  it('shows every layer when layersVisible is true, regardless of selection', () => {
    const updates = computeLayerVisibilityUpdates(layers, ['838- Annen tekst', 'A-WALL-____-OTLN.IFC'], true);
    expect(updates).toEqual([
      { id: '10R', visible: true },
      { id: '17R', visible: true },
    ]);
  });

  it('shows every layer when the selection is empty, even with layersVisible false', () => {
    const updates = computeLayerVisibilityUpdates(layers, [], false);
    expect(updates).toEqual([
      { id: '10R', visible: true },
      { id: '17R', visible: true },
    ]);
  });
});
