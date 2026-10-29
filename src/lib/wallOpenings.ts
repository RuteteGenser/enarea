import { openingArea } from '@/lib/openings';
import type { Annotation, EdgeMeta, OpeningItem } from '@/types';

/** Parses an area typed by the user ("2,4" or "2.4"); undefined unless it is a number > 0. */
export function parseArea(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function totalOpeningArea(edge: EdgeMeta): number {
  return (edge.openings ?? []).reduce((sum, o) => sum + o.area, 0);
}

/**
 * Count and combined area (m²) of all windows/doors on an annotation's walls: those added in the
 * material picker plus the placed Vindu/Dør items of the file (`items`).
 */
export function openingsSummary(
  annotation: Pick<Annotation, 'edges'> & { id?: string },
  items: OpeningItem[] = [],
): { count: number; area: number } {
  let count = 0;
  let area = 0;
  for (const edge of annotation.edges ?? []) {
    count += edge.openings?.length ?? 0;
    area += totalOpeningArea(edge);
  }
  for (const item of items) {
    if (!annotation.id || item.placement?.annotationId !== annotation.id) continue;
    count += 1;
    area += openingArea(item) ?? 0;
  }
  return { count, area };
}

export type KindTotals = { count: number; area: number };

/** Windows and doors counted separately (material-picker openings by category, placed items by kind). */
export function openingTotals(
  edges: EdgeMeta[] | undefined,
  items: OpeningItem[],
): { vindu: KindTotals; dor: KindTotals } {
  const totals = { vindu: { count: 0, area: 0 }, dor: { count: 0, area: 0 } };
  for (const edge of edges ?? []) {
    for (const o of edge.openings ?? []) {
      const kind = o.component.category === 'vindu' ? 'vindu' : 'dor';
      totals[kind].count += 1;
      totals[kind].area += o.area;
    }
  }
  for (const item of items) {
    totals[item.kind].count += 1;
    totals[item.kind].area += openingArea(item) ?? 0;
  }
  return totals;
}

export function formatOpeningArea(area: number): string {
  return `${area.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²`;
}
