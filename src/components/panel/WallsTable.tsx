import { useEffect, useRef, useState } from 'react';
import { BrickWall, SquareSplitHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useParams } from 'react-router-dom';
import { displayName } from '@/lib/annotationLabel';
import { formatLength, metersPerUnit } from '@/lib/calibration';
import { distance } from '@/lib/geometry';
import { compassPoint, ORIENTATION_NAMES, wallBearing } from '@/lib/wallOrientation';
import { cn } from '@/lib/utils';
import BuildingComponentPicker from '@/components/material/BuildingComponentPicker';
import { nextSelection } from '@/lib/rowSelection';
import { scrollRowIntoView } from '@/lib/scrollRow';
import { useAnnotationStore } from '@/store/annotationStore';
import { useProjectStore } from '@/store/projectStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, BuildingComponentAssignment, BuildingComponentCategory, Calibration, EdgeMeta, Unit } from '@/types';

/** Parses a height typed in meters ("2,5" or "2.5"); undefined for empty or invalid input. */
function parseHeight(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Like parseHeight, but zero and negative values are fine (temperatures). */
function parseNumber(text: string): number | undefined {
  const value = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(value) ? value : undefined;
}

const formatHeight = (height: number | undefined) => (height === undefined ? '' : String(height).replace('.', ','));

/** A height field that commits on Enter/blur and follows changes made elsewhere (undo, the "all walls" field). */
function HeightInput({ value, onCommit, placeholder, className, allowNegative }: { value: number | undefined; onCommit: (height: number | undefined) => void; placeholder?: string; className?: string; allowNegative?: boolean }) {
  const [draft, setDraft] = useState(formatHeight(value));
  useEffect(() => setDraft(formatHeight(value)), [value]);
  const commit = () => {
    const parsed = allowNegative ? parseNumber(draft) : parseHeight(draft);
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
  /** 'external' (default) lists the outer walls; 'partition' lists the skillekonstruksjoner (no compass direction). */
  kind?: 'external' | 'partition';
};

const wallKey = (annotationId: string, edgeIndex: number) => `${annotationId}:${edgeIndex}`;

/** The cell that picks a wall type; applies to every selected wall when this wall is one of several selected. */
function TypeCell({ edge, category, onPick }: { edge: EdgeMeta; category: BuildingComponentCategory; onPick: (next: BuildingComponentAssignment | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <BuildingComponentPicker categories={[category]} current={edge.buildingComponent} open={open} onOpenChange={setOpen} onSelect={onPick}>
      <button type="button" className={cn('truncate text-left hover:underline', edge.buildingComponent ? 'text-foreground' : 'text-muted-foreground')}>
        {edge.buildingComponent?.name ?? '--'}
      </button>
    </BuildingComponentPicker>
  );
}

/**
 * The outer walls of the file in Målinger (the same walls as in Excel) with the compass direction each one faces.
 * Rows are selected like in Windows (click, Ctrl+click, Shift+click); editing the height or the type of a selected
 * row changes every selected wall, and the selected walls are marked on the drawing.
 */
export default function WallsTable({ annotations, unit, calibration, onSelectAndJump, kind = 'external' }: WallsTableProps) {
  const partition = kind === 'partition';
  const category: BuildingComponentCategory = partition ? 'skillekonstruksjon' : 'yttervegg';
  const { projectId } = useParams<{ projectId: string }>();
  const north = useProjectStore((s) => (projectId ? s.getProject(projectId)?.northDirection : undefined)) ?? 0;
  const mpu = metersPerUnit(calibration);
  const highlighted = useViewportStore((s) => s.highlightedWalls);
  const anchor = useRef<string | null>(null);

  // A wall clicked on the drawing is highlighted here, and its line is scrolled into view.
  useEffect(() => {
    if (highlighted.length > 0) {
      scrollRowIntoView(`tr[data-wall-row="${highlighted[0].annotationId}:${highlighted[0].edgeIndex}"]`);
    }
  }, [highlighted]);

  const walls = annotations.flatMap((annotation) =>
    annotation.type === 'line'
      ? []
      : annotation.points.flatMap((a, i) => {
          const edge = annotation.edges?.[i];
          if (edge?.wallType !== kind) return [];
          const b = annotation.points[(i + 1) % annotation.points.length];
          const bearing = wallBearing(annotation, i, north) ?? 0;
          return [{ annotation, edgeIndex: i, edge, length: distance(a, b) * mpu, bearing }];
        }),
  );
  if (walls.length === 0) return null;

  const order = walls.map((w) => wallKey(w.annotation.id, w.edgeIndex));
  // only the walls of this table (the outer walls and the partitions share the highlighted walls)
  const selectedKeys = highlighted.map((w) => wallKey(w.annotationId, w.edgeIndex)).filter((k) => order.includes(k));

  const totalLength = walls.reduce((sum, w) => sum + w.length, 0);
  const totalArea = walls.reduce((sum, w) => sum + (w.edge.heightMeters ? w.length * w.edge.heightMeters : 0), 0);

  function selectWall(annotationId: string, edgeIndex: number, e: React.MouseEvent) {
    const key = wallKey(annotationId, edgeIndex);
    const inControl = e.target instanceof Element && e.target.closest('input, button, select, [role="combobox"]');
    // Clicking a field inside a selected row (to edit all selected) keeps the selection.
    if (inControl && selectedKeys.length > 1 && selectedKeys.includes(key)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    const next = nextSelection(order, { selected: selectedKeys, anchor: anchor.current }, key, { shift: e.shiftKey, ctrl });
    anchor.current = next.anchor;
    const refs = next.selected.flatMap((k) => {
      const wall = walls.find((w) => wallKey(w.annotation.id, w.edgeIndex) === k);
      return wall ? [{ annotationId: wall.annotation.id, edgeIndex: wall.edgeIndex }] : [];
    });
    useViewportStore.getState().setHighlightedWalls(refs);
    const roomIds = [...new Set(refs.map((r) => r.annotationId))];
    if (refs.length === 1 && !inControl) onSelectAndJump(annotationId);
    else useAnnotationStore.getState().setSelectedMany(roomIds);
  }

  /** The walls an edit made in this row applies to: all selected ones if this row is one of them, else just this one. */
  function targetsOf(annotationId: string, edgeIndex: number) {
    const key = wallKey(annotationId, edgeIndex);
    return selectedKeys.length > 1 && selectedKeys.includes(key) ? highlighted.filter((w) => order.includes(wallKey(w.annotationId, w.edgeIndex))) : [{ annotationId, edgeIndex }];
  }
  const editWalls = (targets: { annotationId: string; edgeIndex: number }[], meta: Partial<EdgeMeta>) =>
    useAnnotationStore.getState().batch(() => targets.forEach((t) => useAnnotationStore.getState().setEdgeMeta(t.annotationId, t.edgeIndex, meta)));
  /** One height for every wall in the list, as a single undo step. */
  const setAllHeights = (height: number | undefined) =>
    editWalls(walls.map((w) => ({ annotationId: w.annotation.id, edgeIndex: w.edgeIndex })), { heightMeters: height });
  const commonHeight = walls.every((w) => w.edge.heightMeters === walls[0].edge.heightMeters) ? walls[0].edge.heightMeters : undefined;

  return (
    <div className="border-t border-border">
      <div className="flex items-center justify-between px-2 py-0.5">
        <h3 className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {partition ? <SquareSplitHorizontal className="size-3" /> : <BrickWall className="size-3" />} {partition ? 'Skillekonstruksjoner' : 'Yttervegger'} ({walls.length}
          {selectedKeys.length > 1 && `, ${selectedKeys.length} valgt`})
        </h3>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title={`Sett samme vegghøyde på alle ${partition ? 'skillekonstruksjoner' : 'yttervegger'}`}>
            Vegghøyde alle (m)
            <HeightInput value={commonHeight} onCommit={setAllHeights} placeholder="—" className="h-5 w-14 px-1 py-0 text-xs tabular-nums" />
          </label>
          <span className="text-[10px] font-medium text-foreground">
            Totalt {formatLength(totalLength, unit)}
            {totalArea > 0 && ` · ${totalArea.toLocaleString('nb-NO', { maximumFractionDigits: 1 })} m² vegg`}
          </span>
        </div>
      </div>
      <table className="w-full select-none border-collapse text-sm">
        <thead>
          <tr className="border-b border-border">
            {['Rom', 'Vegg', 'Lengde', 'Høyde (m)', 'Veggareal', ...(partition ? [] : ['Himmelretning']), 'Veggtype', 'U-verdi', ...(partition ? ['Temperatur (°C)'] : [])].map((title) => (
              <th key={title} className="sticky top-0 z-10 bg-panel shadow-[0_1px_0_0_var(--border)] whitespace-nowrap px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {walls.map(({ annotation, edgeIndex, edge, length, bearing }) => (
            <tr
              key={wallKey(annotation.id, edgeIndex)}
              data-wall-row={wallKey(annotation.id, edgeIndex)}
              onClick={(e) => selectWall(annotation.id, edgeIndex, e)}
              className={cn(
                'scroll-mt-8 cursor-pointer border-b border-border/50 transition-colors',
                selectedKeys.includes(wallKey(annotation.id, edgeIndex)) ? 'bg-accent' : 'hover:bg-secondary/60',
              )}
            >
              <td className="px-2 py-1 text-foreground">{[annotation.roomNumber, displayName(annotation)].filter(Boolean).join(' ')}</td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">{edgeIndex + 1}</td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">{formatLength(length, unit)}</td>
              <td className="px-2 py-1">
                <HeightInput value={edge.heightMeters} onCommit={(h) => editWalls(targetsOf(annotation.id, edgeIndex), { heightMeters: h })} />
              </td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">
                {edge.heightMeters ? `${(length * edge.heightMeters).toLocaleString('nb-NO', { maximumFractionDigits: 2 })} m²` : '--'}
              </td>
              {!partition && (
                <td className="whitespace-nowrap px-2 py-1 text-foreground">
                  {ORIENTATION_NAMES[compassPoint(bearing)]} <span className="tabular-nums text-muted-foreground">({bearing}°)</span>
                </td>
              )}
              <td className="px-2 py-1">
                <TypeCell edge={edge} category={category} onPick={(next) => editWalls(targetsOf(annotation.id, edgeIndex), { buildingComponent: next ?? undefined })} />
              </td>
              <td className="px-2 py-1 tabular-nums text-muted-foreground">
                {edge.buildingComponent?.uValue !== undefined ? `${edge.buildingComponent.uValue} W/m²K` : '--'}
              </td>
              {partition && (
                <td className="px-2 py-1">
                  <HeightInput allowNegative value={edge.temperature} onCommit={(t) => editWalls(targetsOf(annotation.id, edgeIndex), { temperature: t })} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
