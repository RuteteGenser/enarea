import { describe, expect, it } from 'vitest';
import { distinctWallTypeNames } from '@/lib/wallTypesSummary';
import type { Annotation } from '@/types';

function annotation(overrides: Partial<Annotation> = {}): Annotation {
  return {
    id: 'a1',
    fileId: 'f1',
    type: 'polygon',
    points: [],
    color: 'red',
    locked: false,
    visible: true,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

const wallAssignment = (name: string) => ({
  typeId: name,
  category: 'yttervegg' as const,
  name,
});

describe('distinctWallTypeNames', () => {
  it('returns an empty array when there are no edges', () => {
    expect(distinctWallTypeNames(annotation())).toEqual([]);
  });

  it('returns an empty array when no edges have an assigned type', () => {
    const a = annotation({ edges: [{}, {}, {}] });
    expect(distinctWallTypeNames(a)).toEqual([]);
  });

  it('collects distinct wall type names, sorted alphabetically', () => {
    const a = annotation({
      edges: [
        { buildingComponent: wallAssignment('Betong 200mm') },
        { buildingComponent: wallAssignment('Bindingsverk 200mm') },
        {},
      ],
    });
    expect(distinctWallTypeNames(a)).toEqual(['Betong 200mm', 'Bindingsverk 200mm']);
  });

  it('deduplicates repeated wall type names', () => {
    const a = annotation({
      edges: [
        { buildingComponent: wallAssignment('Bindingsverk 200mm') },
        { buildingComponent: wallAssignment('Bindingsverk 200mm') },
      ],
    });
    expect(distinctWallTypeNames(a)).toEqual(['Bindingsverk 200mm']);
  });
});
