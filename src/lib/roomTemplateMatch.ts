import { toast } from 'sonner';
import { useAnnotationStore } from '@/store/annotationStore';
import { useRoomTemplateStore } from '@/store/roomTemplateStore';
import type { Annotation, RoomTemplate, RoomTemplateAssignment, RoomTemplateMatchType } from '@/types';

const MIN_FUZZY_KEYWORD_LENGTH = 3;

export function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function keywordsFor(template: RoomTemplate): string[] {
  return [template.name, ...(template.aliases ?? [])].map(normalize).filter(Boolean);
}

export type RoomTemplateMatch = { template: RoomTemplate; matchType: 'exact' | 'fuzzy' };

// Exact match (normalized name/alias equality) wins. Otherwise falls back to a substring
// match in either direction, preferring the longest matched keyword across all templates
// to reduce false positives from short/common words.
export function matchRoomTemplate(name: string, templates: RoomTemplate[]): RoomTemplateMatch | null {
  const normalized = normalize(name);
  if (!normalized) return null;

  for (const template of templates) {
    if (keywordsFor(template).includes(normalized)) {
      return { template, matchType: 'exact' };
    }
  }

  let best: { template: RoomTemplate; keyword: string } | null = null;
  for (const template of templates) {
    for (const keyword of keywordsFor(template)) {
      if (keyword.length < MIN_FUZZY_KEYWORD_LENGTH) continue;
      if (normalized.includes(keyword) || keyword.includes(normalized)) {
        if (!best || keyword.length > best.keyword.length) {
          best = { template, keyword };
        }
      }
    }
  }

  return best ? { template: best.template, matchType: 'fuzzy' } : null;
}

export function toRoomTemplateAssignment(template: RoomTemplate, matchType: RoomTemplateMatchType): RoomTemplateAssignment {
  return {
    templateId: template.id,
    name: template.name,
    ventilationRate: template.ventilationRate,
    ventilationUnit: template.ventilationUnit,
    perPersonRate: template.perPersonRate,
    note: template.note,
    matchType,
  };
}

// Sets an annotation's name and (re-)runs room-template matching against it. A previously
// confirmed manual assignment is never overwritten by auto-matching. Fires a toast when a
// fuzzy (unconfirmed) match is applied so the user can double-check it.
export function applyRoomNameAndMatch(annotationId: string, name: string, extra: Partial<Annotation> = {}): void {
  const { annotations, updateAnnotation } = useAnnotationStore.getState();
  const existing = annotations.find((a) => a.id === annotationId);
  const patch: Partial<Annotation> = { name, ...extra };

  if (existing?.roomTemplate?.matchType !== 'manual') {
    const result = matchRoomTemplate(name, useRoomTemplateStore.getState().templates);
    if (result) {
      patch.roomTemplate = toRoomTemplateAssignment(result.template, result.matchType);
      if (result.matchType === 'fuzzy') {
        toast.warning(`«${name}» ble automatisk koblet til malen «${result.template.name}» — dobbeltsjekk match.`);
      }
    } else {
      patch.roomTemplate = undefined;
    }
  }

  updateAnnotation(annotationId, patch);
}
