import type { Annotation } from '@/types';

export const TYPE_LABEL_NB: Record<Annotation['type'], string> = {
  line: 'Linje',
  rectangle: 'Rektangel',
  polygon: 'Polygon',
};

/** Display fallback for lists/exports when the user hasn't given the annotation a custom name. */
export function displayName(annotation: Pick<Annotation, 'name' | 'type'>): string {
  return annotation.name?.trim() || TYPE_LABEL_NB[annotation.type];
}
