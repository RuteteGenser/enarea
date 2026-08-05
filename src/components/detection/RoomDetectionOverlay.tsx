import { useEffect, useState, type MouseEvent as ReactMouseEvent, type RefObject } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { detectRoomPolygon } from '@/lib/roomDetection';
import { createId } from '@/lib/id';
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

export default function RoomDetectionOverlay({ fileId, zoom, width, height, canvasRef }: RoomDetectionOverlayProps) {
  const addAnnotation = useAnnotationStore((s) => s.addAnnotation);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const [draftPoints, setDraftPoints] = useState<Point[] | null>(null);

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

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

    const result = detectRoomPolygon(imageData, seedX, seedY, pixelsPerPdfUnit);
    if (!result) {
      toast.error('Fant ikke et avgrenset rom her');
      setDraftPoints(null);
      return;
    }
    setDraftPoints(result);
  }

  function confirm() {
    if (!draftPoints) return;
    const now = Date.now();
    addAnnotation({
      id: createId(),
      fileId,
      type: 'polygon',
      points: draftPoints,
      edges: draftPoints.map(() => ({})),
      name: undefined,
      color: 'blue',
      locked: false,
      visible: true,
      createdAt: now,
      updatedAt: now,
    });
    setDraftPoints(null);
  }

  function discard() {
    setDraftPoints(null);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDraftPoints(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const screenPoints = draftPoints?.map((p) => ({ x: p.x * zoom, y: p.y * zoom })) ?? null;
  const centroid = screenPoints
    ? {
        x: screenPoints.reduce((sum, p) => sum + p.x, 0) / screenPoints.length,
        y: Math.min(...screenPoints.map((p) => p.y)),
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
        {screenPoints && (
          <polygon
            points={screenPoints.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="#f5a623"
            fillOpacity={0.2}
            stroke="#f5a623"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
      </svg>

      {centroid && (
        <div
          className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border border-border bg-card p-1 shadow-md"
          style={{ left: centroid.x, top: centroid.y - 10 }}
        >
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
