import { useEffect, useState } from 'react';
import { BrickWall } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useParams } from 'react-router-dom';
import { displayName } from '@/lib/annotationLabel';
import { formatLength, metersPerUnit } from '@/lib/calibration';
import { distance } from '@/lib/geometry';
import { compassPoint, ORIENTATION_NAMES, wallBearing } from '@/lib/wallOrientation';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useProjectStore } from '@/store/projectStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, Calibration, Unit } from '@/types';

/** Parses a height typed in meters ("2,5" or "2.5"); undefined for empty or invalid input. */
function parseHeight(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

const formatHeight = (height: number | undefined) => (height === undefined ? '' : String(height).replace('.', ','));

/** A height field that commits on Enter/blur and follows changes made elsewhere (undo, the "all walls" field). */
function HeightInput({ value, onCommit, placeholder, className }: { value: number | undefined; onCommit: (height: number | undefined) => void; placeholder?: string; className?: string }) {
  const [draft, setDraft] = useState(formatHeight(value));
  useEffect(() => setDraft(formatHeight(value)), [value]);
  const commit = () => {
    const parsed = parseHeight(draft);
    setDraft(formatHeight(parsed));
    if (parsed !== value) onCommit(parsed);
  };
  return (
    <Input
      inputMode="decimal"
      value={draft}
      placeholder={placeholder ?? '—'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setDraft(formatHeight(value));
          e.currentTarget.blur();
        }
      }}
      onClick={(e) => e.stopPropagation()}
      className={className ?? 'h-6 w-16 px-1.5 py-0 text-sm tabular-nums'}
    />
  );
}

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
  const totalArea = walls.reduce((sum, w) => sum + (w.edge.heightMeters ? w.length * w.edge.heightMeters : 0), 0);

  const setEdgeMeta = useAnnotationStore.getState().setEdgeMeta;
  const setHeight = (annotationId: string, edgeIndex: number, height: number | undefined) =>
    setEdgeMeta(annotationId, edgeIndex, { heightMeters: height });
  /** One height for every wall in the list, as a single undo step. */
  const setAllHeights = (height: number | undefined) =>
    useAnnotationStore.getState().batch(() => walls.forEach((w) => setHeight(w.annotation.id, w.edgeIndex, height)));
  const commonHeight = walls.every((w) => w.edge.heightMeters === walls[0].edge.heightMeters) ? walls[0].edge.heightMeters : undefined;

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-2 py-0.5">
        <h3 className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          <BrickWall className="size-3" /> Yttervegger ({walls.length})
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Sett samme vegghøyde på alle yttervegger">
            Vegghøyde alle (m)
            <HeightInput value={commonHeight} onCommit={setAllHeights} placeholder="—" className="h-5 w-14 px-1 py-0 text-xs tabular-nums" />
          </label>
          <span className="text-[10px] font-medium text-foreground">
            Totalt {formatLength(totalLength, unit)}
            {totalArea > 0 && ` · ${totalArea.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} m² vegg`}
          </span>
        </div>
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Rom', 'Vegg', 'Lengde', 'Høyde (m)', 'Veggareal', 'Himmelretning', 'Veggtype', 'U-verdi'].map((title) => (
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
              <td className="px-2 py-1">
                <HeightInput value={edge.heightMeters} onCommit={(h) => setHeight(annotation.id, edgeIndex, h)} />
              </td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">
                {edge.heightMeters ? `${(length * edge.heightMeters).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²` : '--'}
              </td>
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
