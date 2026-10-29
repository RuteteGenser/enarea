import type { VentilationUnit } from '@/types';

/** How the total was made up, e.g. "2,5 m³/h × 40 m² + 26 m³/h × 3 personer" (for a tooltip). */
export function ventilationBreakdown(
  rate: number | undefined,
  unit: VentilationUnit | undefined,
  squareMeters: number | null,
  people: number | undefined,
  perPersonRate?: number,
): string | null {
  if (rate === undefined) return null;
  const nb = (n: number) => n.toLocaleString('nb-NO', { maximumFractionDigits: 2 });
  const parts: string[] = [];
  switch (unit ?? 'm3h_per_m2') {
    case 'm3h_per_m2':
      if (squareMeters !== null) parts.push(`${nb(rate)} m³/h × ${nb(squareMeters)} m²`);
      break;
    case 'm3h_per_person':
      if (people) parts.push(`${nb(rate)} m³/h × ${people} personer`);
      break;
    case 'm3h_total':
      parts.push(`${nb(rate)} m³/h`);
      break;
    default:
      return null;
  }
  if (perPersonRate && people) parts.push(`${nb(perPersonRate)} m³/h × ${people} ${people === 1 ? 'person' : 'personer'}`);
  return parts.length > 0 ? parts.join(' + ') : null;
}

/** Air volume in m³/h when it can be derived from the room's area/people (otherwise null). */
export function ventilationTotal(
  rate: number | undefined,
  unit: VentilationUnit | undefined,
  squareMeters: number | null,
  people: number | undefined,
  perPersonRate?: number,
): number | null {
  if (rate === undefined) return null;
  let base: number | null;
  switch (unit ?? 'm3h_per_m2') {
    case 'm3h_per_m2':
      base = squareMeters === null ? null : rate * squareMeters;
      break;
    case 'm3h_per_person':
      base = people ? rate * people : null;
      break;
    case 'm3h_total':
      base = rate;
      break;
    default:
      return null; // per dusj / per toalettstol: the count isn't recorded
  }
  if (base === null) return null;
  // Rooms in use: the air for the people (e.g. 26 m³/h each) comes on top of the area part.
  return base + (perPersonRate && people ? perPersonRate * people : 0);
}
