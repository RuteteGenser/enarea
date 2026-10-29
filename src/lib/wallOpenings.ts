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

export function formatOpeningArea(area: number): string {
  return `${area.toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²`;
}
