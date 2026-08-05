import { Ruler } from 'lucide-react';
import MeasurementRow from '@/components/panel/MeasurementRow';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import { formatArea, metersPerUnit } from '@/lib/calibration';
import { polygonArea } from '@/lib/geometry';
import type { Calibration } from '@/types';

type MeasurementPanelProps = {
  calibration: Calibration;
};

export default function MeasurementPanel({ calibration }: MeasurementPanelProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const selectedId = useAnnotationStore((s) => s.selectedId);
  const setSelected = useAnnotationStore((s) => s.setSelected);
  const deleteAnnotation = useAnnotationStore((s) => s.deleteAnnotation);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const toggleLock = useAnnotationStore((s) => s.toggleLock);
  const toggleVisible = useAnnotationStore((s) => s.toggleVisible);
  const unit = useViewportStore((s) => s.unit);

  const mpu = metersPerUnit(calibration);
  const totalArea = annotations
    .filter((a) => a.type !== 'line')
    .reduce((sum, a) => sum + polygonArea(a.points) * mpu * mpu, 0);

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Målinger {annotations.length > 0 && `(${annotations.length})`}
        </h2>
        {totalArea > 0 && (
          <span className="text-xs font-medium text-foreground">Totalt {formatArea(totalArea, unit)}</span>
        )}
      </div>

      {annotations.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <Ruler className="size-5" />
          Ingen målinger ennå. Velg et verktøy i toolbaren for å starte.
        </div>
      ) : (
        <div className="flex-1 space-y-0.5 overflow-y-auto p-1.5">
          {annotations.map((annotation) => (
            <MeasurementRow
              key={annotation.id}
              annotation={annotation}
              selected={annotation.id === selectedId}
              unit={unit}
              calibration={calibration}
              onSelect={() => setSelected(annotation.id)}
              onDelete={() => deleteAnnotation(annotation.id)}
              onRename={(name) => updateAnnotation(annotation.id, { name })}
              onColorChange={(color) => updateAnnotation(annotation.id, { color })}
              onToggleLock={() => toggleLock(annotation.id)}
              onToggleVisible={() => toggleVisible(annotation.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
