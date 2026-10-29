import { useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { metersPerUnit } from '@/lib/calibration';
import { createId } from '@/lib/id';
import {
  DEFAULT_OPENING_WIDTH_MM,
  nearestEdge,
  OPENING_DEPTH_METERS,
  openingRect,
  placementTemplates,
  placeOpening,
} from '@/lib/openings';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useFilesStore } from '@/store/filesStore';
import { useViewportStore } from '@/store/viewportStore';
import type { PdfFile, Point } from '@/types';

const SNAP_SCREEN_PX = 16;

type OpeningPlaceOverlayProps = { file: PdfFile; zoom: number; width: number; height: number };

/** Tool: click on a wall to place the chosen window/door there as a rectangle. */
export default function OpeningPlaceOverlay({ file, zoom, width, height }: OpeningPlaceOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const setOpenings = useFilesStore((s) => s.setOpenings);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const placingId = useViewportStore((s) => s.placingOpeningId);
  const setPlacingId = useViewportStore((s) => s.setPlacingOpeningId);
  const svgRef = useRef<SVGSVGElement>(null);
  const [cursor, setCursor] = useState<Point | null>(null);

  const items = file.openings ?? [];
  const templates = placementTemplates(items);
  const item = items.find((i) => i.id === placingId) ?? templates.find((i) => !i.placement) ?? templates[0];
  const mpu = metersPerUnit(file.calibration);
  const rooms = annotations.filter((a) => a.type !== 'line' && a.visible);
  const widthUnits = ((item?.widthMm ?? DEFAULT_OPENING_WIDTH_MM) / 1000) / mpu;

  function toPdf(e: ReactMouseEvent): Point {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  const hit = cursor && item ? nearestEdge(cursor, rooms, SNAP_SCREEN_PX / zoom, widthUnits) : null;
  const preview = (() => {
    if (!hit) return null;
    const room = rooms.find((r) => r.id === hit.annotationId);
    const a = room?.points[hit.edgeIndex];
    const b = room?.points[(hit.edgeIndex + 1) % (room?.points.length ?? 1)];
    return a && b ? openingRect(a, b, hit.t, widthUnits, OPENING_DEPTH_METERS / mpu) : null;
  })();

  function handleClick(e: ReactMouseEvent) {
    if (isSpaceDown || e.button !== 0 || !item) return;
    const target = nearestEdge(toPdf(e), rooms, SNAP_SCREEN_PX / zoom, widthUnits);
    if (!target) return;
    // Stays on this window/door type: each click places another one until a different type is chosen.
    const placement = { annotationId: target.annotationId, edgeIndex: target.edgeIndex, t: target.t };
    void setOpenings(file.id, placeOpening(items, item.id, placement, createId()));
    setPlacingId(item.id);
  }

  return (
    <svg
      ref={svgRef}
      className={cn('absolute inset-0', !isSpaceDown && 'cursor-crosshair')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={(e) => !isSpaceDown && setCursor(toPdf(e))}
      onMouseLeave={() => setCursor(null)}
      onClick={handleClick}
    >
      {preview && (
        <polygon
          points={preview.corners.map((p) => `${p.x * zoom},${p.y * zoom}`).join(' ')}
          fill="#0091ff"
          fillOpacity={0.25}
          stroke="#0091ff"
          strokeWidth={2}
          strokeDasharray="5 3"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}
