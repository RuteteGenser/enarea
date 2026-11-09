import { displayName } from '@/lib/annotationLabel';
import { distinctWallTypeNames } from '@/lib/wallTypesSummary';
import type { Annotation, EdgeMeta } from '@/types';

export type MissingFilter = 'alle' | 'romnr' | 'romnavn' | 'romtype' | 'gulvdekke' | 'veggtype' | 'vegghoyde' | 'luftmengde';

export const MISSING_FILTERS: { value: MissingFilter; label: string }[] = [
  { value: 'alle', label: 'Alle rom' },
  { value: 'romnr', label: 'Mangler romnr' },
  { value: 'romnavn', label: 'Mangler romnavn' },
  { value: 'romtype', label: 'Mangler romtype' },
  { value: 'gulvdekke', label: 'Mangler gulv/dekke' },
  { value: 'veggtype', label: 'Mangler veggtype' },
  { value: 'vegghoyde', label: 'Mangler vegghøyde' },
  { value: 'luftmengde', label: 'Mangler luftmengde' },
];

const isWall = (edge: EdgeMeta) => edge.wallType === 'external' || edge.wallType === 'partition';

export function isMissing(annotation: Annotation, filter: MissingFilter): boolean {
  if (filter === 'romnr') return !annotation.roomNumber?.trim();
  if (filter === 'romnavn') return !annotation.name?.trim();
  if (filter === 'romtype') return !annotation.roomTemplate;
  if (filter === 'gulvdekke') return !annotation.buildingComponent;
  if (filter === 'veggtype') return distinctWallTypeNames(annotation).length === 0;
  // a marked outer wall or skillekonstruksjon without a height
  if (filter === 'vegghoyde') return (annotation.edges ?? []).some((e) => isWall(e) && !e.heightMeters);
  if (filter === 'luftmengde') return !annotation.roomTemplate;
  return true;
}

/** True when the room passes the search text and the "mangler …" filter of Målinger. */
export function roomMatches(annotation: Annotation, search: string, filter: MissingFilter): boolean {
  if (filter !== 'alle' && !isMissing(annotation, filter)) return false;
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return displayName(annotation).toLowerCase().includes(query) || (annotation.roomNumber ?? '').toLowerCase().includes(query);
}

/**
 * True when a single wall should be listed under the filter: it must be in a matching room, and with the
 * "mangler vegghøyde" / "mangler veggtype" filters the wall itself must be the one that lacks it.
 */
export function wallMatches(annotation: Annotation, edge: EdgeMeta, search: string, filter: MissingFilter): boolean {
  if (!roomMatches(annotation, search, filter)) return false;
  if (filter === 'vegghoyde') return !edge.heightMeters;
  if (filter === 'veggtype') return !edge.buildingComponent;
  return true;
}

export const filterIsActive = (search: string, filter: MissingFilter) => filter !== 'alle' || search.trim() !== '';
