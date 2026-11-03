import { describe, expect, it } from 'vitest';
import { parseBuildingComponentImport } from '@/lib/buildingComponentImport';

describe('parseBuildingComponentImport', () => {
  it('accepts a valid array with all fields', () => {
    const result = parseBuildingComponentImport(
      JSON.stringify([{ category: 'yttervegg', name: 'Yttervegg type 1', uValue: 0.18, wallThickness: 250 }]),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual([
        { category: 'yttervegg', name: 'Yttervegg type 1', uValue: 0.18, wallThickness: 250 },
      ]);
    }
  });

  it('accepts an entry with only category and name', () => {
    const result = parseBuildingComponentImport(JSON.stringify([{ category: 'gulv', name: 'Gulv mot grunn' }]));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toEqual([
        { category: 'gulv', name: 'Gulv mot grunn', uValue: undefined, wallThickness: undefined },
      ]);
    }
  });

  it('rejects invalid JSON', () => {
    const result = parseBuildingComponentImport('{ not valid json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Ugyldig JSON/);
  });

  it('rejects a JSON value that is not an array', () => {
    const result = parseBuildingComponentImport(JSON.stringify({ category: 'gulv', name: 'Gulv' }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/liste/);
  });

  it('rejects an empty array', () => {
    const result = parseBuildingComponentImport('[]');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/tom/);
  });

  it('rejects an entry with a missing category', () => {
    const result = parseBuildingComponentImport(JSON.stringify([{ name: 'Uten kategori' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Element 1.*kategori/);
  });

  it('rejects an entry with an invalid category value', () => {
    const result = parseBuildingComponentImport(JSON.stringify([{ category: 'veranda', name: 'Feil kategori' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Element 1.*kategori/);
  });

  it('rejects an entry with a missing name', () => {
    const result = parseBuildingComponentImport(JSON.stringify([{ category: 'gulv' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Element 1.*navn/);
  });

  it('rejects an entry with a blank name', () => {
    const result = parseBuildingComponentImport(JSON.stringify([{ category: 'gulv', name: '   ' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Element 1.*navn/);
  });

  it('rejects a non-positive uValue', () => {
    const result = parseBuildingComponentImport(JSON.stringify([{ category: 'gulv', name: 'Gulv', uValue: -1 }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Element 1.*uValue/);
  });

  it('rejects a non-numeric uValue', () => {
    const result = parseBuildingComponentImport(JSON.stringify([{ category: 'gulv', name: 'Gulv', uValue: 'high' }]));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Element 1.*uValue/);
  });

  it('rejects a non-positive wallThickness', () => {
    const result = parseBuildingComponentImport(
      JSON.stringify([{ category: 'yttervegg', name: 'Vegg', wallThickness: 0 }]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]).toMatch(/Element 1.*wallThickness/);
  });

  it('collects errors across multiple invalid entries, not just the first', () => {
    const result = parseBuildingComponentImport(
      JSON.stringify([
        { category: 'gulv', name: 'Gyldig' },
        { category: 'ugyldig', name: 'Feil kategori' },
        { category: 'gulv' },
      ]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toMatch(/Element 2/);
      expect(result.errors[1]).toMatch(/Element 3/);
    }
  });
});
