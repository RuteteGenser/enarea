import { Ruler } from 'lucide-react';
import MeasurementRow from '@/components/panel/MeasurementRow';
import RoomTable from '@/components/panel/RoomTable';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import { formatArea, metersPerUnit } from '@/lib/calibration';
import { annotationArea } from '@/lib/geometry';
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
  const requestJump = useViewportStore((s) => s.requestJump);

  function selectAndJump(id: string) {
    setSelected(id);
    requestJump(id);
  }

  const mpu = metersPerUnit(calibration);
  const roomAnnotations = annotations.filter((a) => a.type !== 'line');
  const lineAnnotations = annotations.filter((a) => a.type === 'line');
  const totalArea = roomAnnotations.reduce((sum, a) => sum + annotationArea(a) * mpu * mpu, 0);

  const hasAnyContent = annotations.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Målinger {annotations.length > 0 && `(${annotations.length})`}
        </h2>
        {totalArea > 0 && <span className="text-xs font-medium text-foreground">Totalt {formatArea(totalArea, unit)}</span>}
      </div>

      {!hasAnyContent ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 text-center text-sm text-muted-foreground">
          <Ruler className="size-5" />
          Ingen målinger ennå. Velg et verktøy i toolbaren for å starte.
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          <RoomTable
            annotations={roomAnnotations}
            selectedId={selectedId}
            unit={unit}
            calibration={calibration}
            onSelectAndJump={selectAndJump}
          />

          {lineAnnotations.length > 0 && (
            <div className="p-1.5">
              <h3 className="mb-1 px-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Linjer</h3>
              <div className="space-y-0.5">
                {lineAnnotations.map((annotation) => (
                  <MeasurementRow
                    key={annotation.id}
                    annotation={annotation}
                    selected={annotation.id === selectedId}
                    unit={unit}
                    calibration={calibration}
                    onSelect={() => selectAndJump(annotation.id)}
                    onDelete={() => deleteAnnotation(annotation.id)}
                    onRename={(name) => updateAnnotation(annotation.id, { name })}
                    onColorChange={(color) => updateAnnotation(annotation.id, { color })}
                    onToggleLock={() => toggleLock(annotation.id)}
                    onToggleVisible={() => toggleVisible(annotation.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
