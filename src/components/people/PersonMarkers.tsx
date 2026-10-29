import { useEffect, useState } from 'react';
import PersonIcon from '@/components/people/PersonIcon';
import { withPersonRemoved } from '@/lib/personMarkers';
import { useAnnotationStore } from '@/store/annotationStore';
import type { Annotation } from '@/types';

type PersonMarkersProps = {
  annotations: Annotation[];
  zoom: number;
  /** In the Velg tool a person can be clicked: it is marked with a red × and the × deletes it. */
  interactive?: boolean;
};

type Armed = { annotationId: string; markerId: string };

/** The person icons placed in the areas. */
export default function PersonMarkers({ annotations, zoom, interactive = false }: PersonMarkersProps) {
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const [armed, setArmed] = useState<Armed | null>(null);

  function remove(target: Armed) {
    const area = useAnnotationStore.getState().annotations.find((a) => a.id === target.annotationId);
    if (area) updateAnnotation(area.id, withPersonRemoved(area, target.markerId));
    setArmed(null);
  }

  // Marked person: × (or the Delete key) removes it; clicking elsewhere or Esc un-marks it.
  useEffect(() => {
    if (!armed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setArmed(null);
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        e.stopImmediatePropagation(); // don't also delete the selected area
        remove(armed);
      }
    };
    const onDown = (e: MouseEvent) => {
      if ((e.target as Element | null)?.closest?.('[data-person-x]')) return;
      setArmed(null);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remove() reads fresh state from the store
  }, [armed]);

  return (
    <g>
      {annotations.map((annotation) =>
        annotation.visible
          ? (annotation.personMarkers ?? []).map((marker) => {
              const x = marker.x * zoom;
              const y = marker.y * zoom;
              const isArmed = armed?.markerId === marker.id;
              return (
                <g key={marker.id}>
                  <g
                    pointerEvents={interactive ? 'all' : 'none'}
                    className={interactive ? 'cursor-pointer' : undefined}
                    onClick={(e) => {
                      if (!interactive) return;
                      e.stopPropagation();
                      setArmed({ annotationId: annotation.id, markerId: marker.id });
                    }}
                  >
                    {/* generous hit area around the small icon */}
                    <circle cx={x} cy={y} r={12} fill="transparent" />
                    <PersonIcon x={x} y={y} highlight={isArmed} />
                  </g>
                  {isArmed && (
                    <g
                      data-person-x
                      transform={`translate(${x + 13}, ${y - 13})`}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        remove({ annotationId: annotation.id, markerId: marker.id });
                      }}
                    >
                      <circle r={8} fill="white" stroke="#dc2626" strokeWidth={1.5} />
                      <line x1={-3.2} y1={-3.2} x2={3.2} y2={3.2} stroke="#dc2626" strokeWidth={2.2} strokeLinecap="round" />
                      <line x1={-3.2} y1={3.2} x2={3.2} y2={-3.2} stroke="#dc2626" strokeWidth={2.2} strokeLinecap="round" />
                      <title>Slett person</title>
                    </g>
                  )}
                </g>
              );
            })
          : null,
      )}
    </g>
  );
}
