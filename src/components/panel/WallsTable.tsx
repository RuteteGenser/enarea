import { BrickWall } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { displayName } from '@/lib/annotationLabel';
import { formatLength, metersPerUnit } from '@/lib/calibration';
import { distance } from '@/lib/geometry';
import { compassPoint, ORIENTATION_NAMES, wallBearing } from '@/lib/wallOrientation';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, Calibration, Unit } from '@/types';

type WallsTableProps = {
  annotations: Annotation[];
  unit: Unit;
  calibration: Calibration;
  onSelectAndJump: (id: string) => void;
};

/** The outer walls of the file in Målinger, with the compass direction each one faces (the same walls as in Excel). */
export default function WallsTable({ annotations, unit, calibration, onSelectAndJump }: WallsTableProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const north = useProjectStore((s) => (projectId ? s.getProject(projectId)?.northDirection : undefined)) ?? 0;
  const mpu = metersPerUnit(calibration);
  const highlighted = useViewportStore((s) => s.highlightedWall);

  const walls = annotations.flatMap((annotation) =>
    annotation.type === 'line'
      ? []
      : annotation.points.flatMap((a, i) => {
          const edge = annotation.edges?.[i];
          if (edge?.wallType !== 'external') return [];
          const b = annotation.points[(i + 1) % annotation.points.length];
          const bearing = wallBearing(annotation, i, north) ?? 0;
          return [{ annotation, edgeIndex: i, edge, length: distance(a, b) * mpu, bearing }];
        }),
  );
  if (walls.length === 0) return null;

  const totalLength = walls.reduce((sum, w) => sum + w.length, 0);

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-2 py-0.5">
        <h3 className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <BrickWall className="size-3" /> Yttervegger ({walls.length})
        </h3>
        <span className="text-[10px] font-medium text-foreground">Totalt {formatLength(totalLength, unit)}</span>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Rom', 'Vegg', 'Lengde', 'Himmelretning', 'Veggtype', 'U-verdi'].map((title) => (
              <th key={title} className="whitespace-nowrap px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {walls.map(({ annotation, edgeIndex, edge, length, bearing }) => (
            <tr
              key={`${annotation.id}:${edgeIndex}`}
              onClick={() => {
                useViewportStore.getState().setHighlightedWall({ annotationId: annotation.id, edgeIndex });
                onSelectAndJump(annotation.id);
              }}
              className={cn(
                'cursor-pointer border-b border-border/50 transition-colors',
                highlighted?.annotationId === annotation.id && highlighted.edgeIndex === edgeIndex
                  ? 'bg-accent'
                  : 'hover:bg-secondary/60',
              )}
            >
              <td className="px-2 py-1 text-foreground">{[annotation.roomNumber, displayName(annotation)].filter(Boolean).join(' ')}</td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">{edgeIndex + 1}</td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">{formatLength(length, unit)}</td>
              <td className="whitespace-nowrap px-2 py-1 text-foreground">
                {ORIENTATION_NAMES[compassPoint(bearing)]} <span className="tabular-nums text-muted-foreground">({bearing}°)</span>
              </td>
              <td className="px-2 py-1 text-muted-foreground">{edge.buildingComponent?.name ?? '--'}</td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">
                {edge.buildingComponent?.uValue !== undefined ? `${edge.buildingComponent.uValue} W/m²K` : '--'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
