import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDrawingInProgress } from '@/components/tools/useDrawingInProgress';
import { detectRoomPolygon, mergeRegions } from '@/lib/roomDetection';
import { createId } from '@/lib/id';
import { areaAtPoint } from '@/lib/personMarkers';
import { isPointInPolygon } from '@/lib/geometry';
import { cn } from '@/lib/utils';
import { useAnnotationStore } from '@/store/annotationStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Point } from '@/types';

type RoomDetectionOverlayProps = {
  fileId: string;
  zoom: number;
  width: number;
  height: number;
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

// Max gap (in PDF units, so independent of zoom) between two picked areas that still counts as the same room,
// e.g. the thin detail line of a door swing. Areas closer than this are merged into one outline.
const GAP_PDF_UNITS = 3;

export default function RoomDetectionOverlay({ fileId, zoom, width, height, canvasRef }: RoomDetectionOverlayProps) {
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const annotations = useAnnotationStore((s) => s.annotations);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const [pendingRegions, setPendingRegions] = useState<Point[][]>([]);
  useDrawingInProgress(pendingRegions.length > 0);
  const pixelsPerPdfUnitRef = useRef(1);
  // What is shown and confirmed: picked areas joined across thin gaps. `pendingRegions` stays the raw picks.
  const mergedRegions = useMemo(
    () => mergeRegions(pendingRegions, pixelsPerPdfUnitRef.current, GAP_PDF_UNITS),
    [pendingRegions],
  );

  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (useViewportStore.getState().isSpaceDown) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const ratioX = canvas.width / rect.width;
    const ratioY = canvas.height / rect.height;
    const seedX = (e.clientX - rect.left) * ratioX;
    const seedY = (e.clientY - rect.top) * ratioY;
    const pixelsPerPdfUnit = zoom * ratioX;
    pixelsPerPdfUnitRef.current = pixelsPerPdfUnit;

    const seedPdf = { x: seedX / pixelsPerPdfUnit, y: seedY / pixelsPerPdfUnit };
    const existingIndex = pendingRegions.findIndex((region) => isPointInPolygon(seedPdf, region));
    if (existingIndex !== -1) {
      setPendingRegions((prev) => prev.filter((_, i) => i !== existingIndex));
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    // Areas that are already marked (saved ones and picks waiting for approval) are walls for the detection,
    // so only what is not marked yet is found and no part of a room is counted twice.
    const taken = areaAtPoint(annotations, seedPdf);
    if (taken) {
      toast.warning(`Dette området er allerede markert${taken.name ? ` som «${taken.name}»` : ''}`);
      return;
    }
    const marked = [
      ...annotations.filter((a) => a.type !== 'line' && a.visible).flatMap((a) => [a.points, ...(a.regions ?? [])]),
      ...pendingRegions,
    ];
    const result = detectRoomPolygon(imageData, seedX, seedY, pixelsPerPdfUnit, marked);
    if (!result) {
      toast.error('Fant ikke et avgrenset rom her');
      return;
    }
    setPendingRegions((prev) => [...prev, result]);
  }

  function confirm() {
    if (mergedRegions.length === 0) return;
    const [primary, ...rest] = mergedRegions;
    const now = Date.now();
    addAnnotation({
      id: createId(),
      fileId,
      type: 'polygon',
      points: primary,
      regions: rest.length > 0 ? rest : undefined,
      edges: primary.map(() => ({})),
      name: undefined,
      color: 'blue',
      locked: false,
      visible: true,
      createdAt: now,
      updatedAt: now,
    });
    setPendingRegions([]);
  }

  function discard() {
    setPendingRegions([]);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPendingRegions([]);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const screenRegions = mergedRegions.map((region) => region.map((p) => ({ x: p.x * zoom, y: p.y * zoom })));
  const allScreenPoints = screenRegions.flat();
  const toolbarPos =
    allScreenPoints.length > 0
      ? {
          x: allScreenPoints.reduce((sum, p) => sum + p.x, 0) / allScreenPoints.length,
          y: Math.min(...allScreenPoints.map((p) => p.y)),
        }
      : null;

  return (
    <>
      <svg
        className={cn('absolute inset-0', !isSpaceDown && 'cursor-crosshair')}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onClick={handleClick}
      >
        {screenRegions.map((screenPoints, i) => (
          <polygon
            key={i}
            points={screenPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="#f5a623"
            fillOpacity={0.2}
            stroke="#f5a623"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        ))}
      </svg>

      {toolbarPos && (
        <div
          className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border border-border bg-card p-1 shadow-md"
          style={{ left: toolbarPos.x, top: toolbarPos.y - 10 }}
        >
          {pendingRegions.length > 1 && (
            <span className="px-1 text-xs font-medium text-muted-foreground">{pendingRegions.length}</span>
          )}
          <button
            type="button"
            onClick={confirm}
            className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90"
            title="Godkjenn rom"
          >
            <Check className="size-4" />
          </button>
          <button
            type="button"
            onClick={discard}
            className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary"
            title="Forkast"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </>
  );
}
