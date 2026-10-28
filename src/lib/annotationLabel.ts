import type { Annotation } from '@/types';

export const TYPE_LABEL_NB: Record<Annotation['type'], string> = {
  line: 'Linje',
  rectangle: 'Rektangel',
  polygon: 'Polygon',
};

/** Fallback label for a non-line shape with no custom name and no assigned Bygningsdel type. */
export const UNCATEGORIZED_SHAPE_LABEL = '--';

/**
 * Display fallback for lists/exports when the user hasn't given the annotation a custom name.
 * Non-line shapes without a custom name fall back to their assigned Bygningsdel type's name, or
 * "Ukategorisert gulv/dekke" when nothing is assigned yet — geometry-type labels ("Polygon",
 * "Rektangel") are no longer used as the primary display name in that case.
 */
export function displayName(annotation: Pick<Annotation, 'name' | 'type' | 'buildingComponent'>): string {
  if (annotation.name?.trim()) return annotation.name.trim();
  if (annotation.type === 'line') return TYPE_LABEL_NB.line;
  return annotation.buildingComponent?.name ?? UNCATEGORIZED_SHAPE_LABEL;
}
