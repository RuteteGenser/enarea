import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ annotationsRepo: { replaceAllForFile: vi.fn(), listByFile: vi.fn() } }));

import { useAnnotationStore } from '@/store/annotationStore';
import type { Annotation } from '@/types';

function room(id: string, locked = false): Annotation {
  return {
    id,
    fileId: 'f',
    type: 'rectangle',
    points: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    visible: true,
    locked,
    createdAt: 0,
    updatedAt: 0,
  } as Annotation;
}

describe('multi-selection', () => {
  beforeEach(() => {
    useAnnotationStore.setState({
      fileId: 'f',
      annotations: [room('a'), room('b'), room('c', true)],
      past: [],
      future: [],
      selectedId: null,
      selectedIds: [],
    });
  });

  it('toggleSelected adds and removes elements', () => {
    const s = useAnnotationStore.getState();
    s.setSelected('a');
    s.toggleSelected('b');
    expect(useAnnotationStore.getState().selectedIds).toEqual(['a', 'b']);
    s.toggleSelected('a');
    expect(useAnnotationStore.getState().selectedIds).toEqual(['b']);
    expect(useAnnotationStore.getState().selectedId).toBe('b');
  });

  it('deleteSelected removes all unlocked selected elements in one step', () => {
    const s = useAnnotationStore.getState();
    s.setSelectedMany(['a', 'b', 'c']);
    s.deleteSelected();
    expect(useAnnotationStore.getState().annotations.map((a) => a.id)).toEqual(['c']);
    expect(useAnnotationStore.getState().past.length).toBe(1);
  });
});
