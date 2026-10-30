import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import BuildingComponentPicker from '@/components/material/BuildingComponentPicker';
import { annotationArea } from '@/lib/geometry';
import { cn } from '@/lib/utils';
import { formatOpeningArea, totalOpeningArea } from '@/lib/wallOpenings';
import { useAnnotationStore } from '@/store/annotationStore';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Annotation, EdgeMeta, Point } from '@/types';

type MaterialPickerOverlayProps = {
  zoom: number;
  width: number;
  height: number;
};

function toScreen(p: Point, zoom: number) {
  return { x: p.x * zoom, y: p.y * zoom };
}

type OpenTarget =
  | { kind: 'area'; annotationId: string }
  | { kind: 'edge'; annotationId: string; edgeIndex: number };

export default function MaterialPickerOverlay({ zoom, width, height }: MaterialPickerOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const setEdgeMeta = useAnnotationStore((s) => s.setEdgeMeta);

  const loaded = useBuildingComponentTypeStore((s) => s.loaded);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);

  const [openTarget, setOpenTarget] = useState<OpenTarget | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [clickPos, setClickPos] = useState<Point | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  function resolveClickPoint(e: ReactMouseEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  useEffect(() => {
    if (!loaded) void loadTypes();
  }, [loaded, loadTypes]);

  // Invisible point where the user clicked: the popup opens next to the mouse, not centred on the object.
  const clickAnchor = clickPos ? <circle cx={clickPos.x * zoom} cy={clickPos.y * zoom} r={1} fill="none" pointerEvents="none" /> : undefined;

  const eligible = annotations.filter((a) => a.type !== 'line' && a.visible && !a.locked);
  const sortedByAreaDesc: Annotation[] = [...eligible].sort((a, b) => annotationArea(b) - annotationArea(a));

  function isOpen(target: OpenTarget): boolean {
    if (!openTarget || openTarget.kind !== target.kind || openTarget.annotationId !== target.annotationId) {
      return false;
    }
    if (openTarget.kind === 'edge' && target.kind === 'edge') return openTarget.edgeIndex === target.edgeIndex;
    return true;
  }

  return (
    <svg
      ref={svgRef}
      className={cn('absolute inset-0', !isSpaceDown && 'cursor-pointer')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {sortedByAreaDesc.map((annotation) => {
        const rings = [annotation.points, ...(annotation.regions ?? [])];
        const screenPoints = annotation.points.map((p) => toScreen(p, zoom));
        const areaTarget: OpenTarget = { kind: 'area', annotationId: annotation.id };
        const centroid = {
          x: screenPoints.reduce((sum, p) => sum + p.x, 0) / screenPoints.length,
          y: screenPoints.reduce((sum, p) => sum + p.y, 0) / screenPoints.length,
        };
        const areaHoverKey = `area:${annotation.id}`;

        return (
          <g key={`area:${annotation.id}`}>
            <BuildingComponentPicker
              categories={['gulv', 'dekke']}
              current={annotation.buildingComponent}
              open={isOpen(areaTarget)}
              onOpenChange={(open) => setOpenTarget(open ? areaTarget : null)}
              anchor={isOpen(areaTarget) ? clickAnchor : undefined}
              onSelect={(assignment) =>
                updateAnnotation(annotation.id, {
                  buildingComponent: assignment ?? undefined,
                  ...(assignment && clickPos ? { labelPos: clickPos } : {}),
                })
              }
            >
              <g
                pointerEvents={isSpaceDown ? 'none' : 'all'}
                onClick={(e) => setClickPos(resolveClickPoint(e))}
                onMouseEnter={() => setHoveredKey(areaHoverKey)}
                onMouseLeave={() => setHoveredKey((k) => (k === areaHoverKey ? null : k))}
              >
                {rings.map((ring, ringIndex) => (
                  <polygon
                    key={ringIndex}
                    points={ring.map((p) => toScreen(p, zoom)).map((p) => `${p.x},${p.y}`).join(' ')}
                    fill="transparent"
                  />
                ))}
              </g>
            </BuildingComponentPicker>

            {(hoveredKey === areaHoverKey || isOpen(areaTarget)) &&
              rings.map((ring, ringIndex) => (
                <polygon
                  key={`hover-${ringIndex}`}
                  points={ring.map((p) => toScreen(p, zoom)).map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="#0091ff"
                  fillOpacity={0.12}
                  stroke="#0091ff"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  pointerEvents="none"
                />
              ))}

            {hoveredKey === areaHoverKey && (
              <g transform={`translate(${centroid.x}, ${centroid.y})`} pointerEvents="none">
                <rect x={-50} y={-10} width={100} height={20} rx={4} className="fill-card/90 stroke-border" strokeWidth={1} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={10} className="fill-foreground select-none">
                  {annotation.buildingComponent?.name ?? 'Ingen type'}
                </text>
              </g>
            )}
          </g>
        );
      })}

      {eligible.map((annotation) =>
        annotation.points.map((point, i) => {
          const next = annotation.points[(i + 1) % annotation.points.length];
          const a = toScreen(point, zoom);
          const b = toScreen(next, zoom);
          const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
          const edgeTarget: OpenTarget = { kind: 'edge', annotationId: annotation.id, edgeIndex: i };
          const edge: EdgeMeta = annotation.edges?.[i] ?? {};
          const edgeHoverKey = `edge:${annotation.id}:${i}`;

          return (
            <g key={`edge:${annotation.id}:${i}`}>
              <BuildingComponentPicker
                categories={['yttervegg']}
                current={edge.buildingComponent}
                open={isOpen(edgeTarget)}
                onOpenChange={(open) => setOpenTarget(open ? edgeTarget : null)}
                anchor={isOpen(edgeTarget) ? clickAnchor : undefined}
                onSelect={(assignment) => setEdgeMeta(annotation.id, i, { buildingComponent: assignment ?? undefined })}
              >
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={14}
                  pointerEvents={isSpaceDown ? 'none' : 'all'}
                  onClick={(e) => setClickPos(resolveClickPoint(e))}
                  onMouseEnter={() => setHoveredKey(edgeHoverKey)}
                  onMouseLeave={() => setHoveredKey((k) => (k === edgeHoverKey ? null : k))}
                />
              </BuildingComponentPicker>

              {(hoveredKey === edgeHoverKey || isOpen(edgeTarget)) && (
                <line
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="#0091ff"
                  strokeWidth={5}
                  strokeLinecap="round"
                  opacity={0.85}
                  pointerEvents="none"
                />
              )}

              {hoveredKey === edgeHoverKey && (
                <g transform={`translate(${mid.x}, ${mid.y})`} pointerEvents="none">
                  <rect
                    x={-60}
                    y={edge.openings?.length ? -31 : -19}
                    width={120}
                    height={edge.openings?.length ? 30 : 18}
                    rx={4}
                    className="fill-card/90 stroke-amber-500"
                    strokeWidth={1}
                  />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={10} y={edge.openings?.length ? -16 : -10} className="fill-amber-700 select-none">
                    {edge.buildingComponent?.name ?? 'Ingen type'}
                  </text>
                  {!!edge.openings?.length && (
                    <text textAnchor="middle" dominantBaseline="central" fontSize={10} y={-4} className="fill-muted-foreground select-none">
                      {`${edge.openings.length} vindu/dør · ${formatOpeningArea(totalOpeningArea(edge))}`}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        }),
      )}
    </svg>
  );
}
