import type { BuildingComponentCategory } from '@/types';

const VALID_CATEGORIES: BuildingComponentCategory[] = ['yttervegg', 'vindu', 'ytterdor', 'tak', 'gulv', 'dekke'];

export type BuildingComponentImportEntry = {
  category: BuildingComponentCategory;
  name: string;
  uValue?: number;
  wallThickness?: number;
};

export type BuildingComponentImportResult =
  | { ok: true; entries: BuildingComponentImportEntry[] }
  | { ok: false; errors: string[] };

function isValidCategory(value: unknown): value is BuildingComponentCategory {
  return typeof value === 'string' && (VALID_CATEGORIES as string[]).includes(value);
}

export function parseBuildingComponentImport(jsonText: string): BuildingComponentImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (e) {
    return { ok: false, errors: [`Ugyldig JSON: ${e instanceof Error ? e.message : String(e)}`] };
  }

  if (!Array.isArray(parsed)) {
    return { ok: false, errors: ['JSON må være en liste (array) av bygningsdeltyper.'] };
  }

  if (parsed.length === 0) {
    return { ok: false, errors: ['Listen er tom.'] };
  }

  const errors: string[] = [];
  const entries: BuildingComponentImportEntry[] = [];

  parsed.forEach((item, index) => {
    const label = `Element ${index + 1}`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      errors.push(`${label}: må være et objekt.`);
      return;
    }
    const obj = item as Record<string, unknown>;

    if (!isValidCategory(obj.category)) {
      errors.push(`${label}: ugyldig kategori "${String(obj.category)}" (må være en av: ${VALID_CATEGORIES.join(', ')}).`);
      return;
    }

    if (typeof obj.name !== 'string' || !obj.name.trim()) {
      errors.push(`${label}: mangler navn.`);
      return;
    }

    let uValue: number | undefined;
    if (obj.uValue !== undefined && obj.uValue !== null) {
      if (typeof obj.uValue !== 'number' || !Number.isFinite(obj.uValue) || obj.uValue <= 0) {
        errors.push(`${label}: uValue må være et positivt tall.`);
        return;
      }
      uValue = obj.uValue;
    }

    let wallThickness: number | undefined;
    if (obj.wallThickness !== undefined && obj.wallThickness !== null) {
      if (typeof obj.wallThickness !== 'number' || !Number.isFinite(obj.wallThickness) || obj.wallThickness <= 0) {
        errors.push(`${label}: wallThickness må være et positivt tall.`);
        return;
      }
      wallThickness = obj.wallThickness;
    }

    entries.push({ category: obj.category, name: obj.name.trim(), uValue, wallThickness });
  });

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, entries };
}
