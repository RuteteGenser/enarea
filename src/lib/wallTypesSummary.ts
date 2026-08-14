import type { Annotation } from '@/types';

export function distinctWallTypeNames(annotation: Annotation): string[] {
  const names = new Set<string>();
  for (const edge of annotation.edges ?? []) {
    if (edge.buildingComponent) names.add(edge.buildingComponent.name);
  }
  return [...names].sort((a, b) => a.localeCompare(b));
}
