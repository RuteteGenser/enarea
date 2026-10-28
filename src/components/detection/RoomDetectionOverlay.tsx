import { useEffect, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { detectRoomPolygon, snapRegionToRegions } from '@/lib/roomDetection';
import { createId } from '@/lib/id';
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

// How close (in raster pixels) two areas' outlines must be to count as touching, e.g. across a door.
const JOIN_TOLERANCE_PX = 14;

export default function RoomDetectionOverlay({ fileId, zoom, width, height, canvasRef }: RoomDetectionOverlayProps) {
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const [pendingRegions, setPendingRegions] = useState<Point[][]>([]);

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

    const seedPdf = { x: seedX / pixelsPerPdfUnit, y: seedY / pixelsPerPdfUnit };
    const existingIndex = pendingRegions.findIndex((region) => isPointInPolygon(seedPdf, region));
    if (existingIndex !== -1) {
      setPendingRegions((prev) => prev.filter((_, i) => i !== existingIndex));
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = detectRoomPolygon(imageData, seedX, seedY, pixelsPerPdfUnit);
    if (!result) {
      toast.error('Fant ikke et avgrenset rom her');
      return;
    }
    setPendingRegions((prev) => [
      ...prev,
      snapRegionToRegions(result, prev, JOIN_TOLERANCE_PX / pixelsPerPdfUnit),
    ]);
  }

  function confirm() {
    if (pendingRegions.length === 0) return;
    const [primary, ...rest] = pendingRegions;
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

  const screenRegions = pendingRegions.map((region) => region.map((p) => ({ x: p.x * zoom, y: p.y * zoom })));
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
