import { nanoid } from 'nanoid';
import type { Annotation, AnnotationType } from '@/types';

export function createId(): string {
  return nanoid();
}

const TYPE_LABEL: Record<AnnotationType, string> = {
  rectangle: 'Rektangel',
  polygon: 'Polygon',
  line: 'Vegglinje',
};

/** Generates the next default name for a type, based on how many of that type already exist. Called once at creation time and stored permanently, so names stay stable as other objects are deleted later. */
export function defaultAnnotationName(type: AnnotationType, existing: Annotation[]): string {
  const countOfType = existing.filter((a) => a.type === type).length;
  return `${TYPE_LABEL[type]} ${countOfType + 1}`;
}
