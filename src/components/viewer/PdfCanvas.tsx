import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { loadPdfDocument, type PdfPageProxy } from '@/lib/pdf';
import { usePanZoom } from '@/components/tools/usePanZoom';
import AnnotationLayer from '@/components/viewer/AnnotationLayer';
import ScaleBar from '@/components/viewer/ScaleBar';
import CalibrationOverlay from '@/components/calibration/CalibrationOverlay';
import RoomDetectionOverlay from '@/components/detection/RoomDetectionOverlay';
import { useViewportStore } from '@/store/viewportStore';
import { useAnnotationStore } from '@/store/annotationStore';
import { cn } from '@/lib/utils';
import type { PdfFile } from '@/types';

const RENDER_DEBOUNCE_MS = 120;
const PAGE_PADDING = 64;

type Status = 'loading' | 'ready' | 'error';

type PdfCanvasProps = {
  file: PdfFile;
};

export default function PdfCanvas({ file }: PdfCanvasProps) {
  const zoom = useViewportStore((s) => s.zoom);
  const tool = useViewportStore((s) => s.tool);
  const showAnnotations = useViewportStore((s) => s.showAnnotations);
  const showScaleBar = useViewportStore((s) => s.showScaleBar);
  const unit = useViewportStore((s) => s.unit);

  const [status, setStatus] = useState<Status>('loading');
  const [page, setPage] = useState<PdfPageProxy | null>(null);
  const [baseWidth, setBaseWidth] = useState(0);
  const [baseHeight, setBaseHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<ReturnType<PdfPageProxy['render']> | null>(null);
  const debounceRef = useRef<number | null>(null);

  const { handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, isPanMode, isPanningActive } =
    usePanZoom(containerRef);

  const renderAtZoom = useCallback(async (targetPage: PdfPageProxy, zoomValue: number, canvas: HTMLCanvasElement) => {
    renderTaskRef.current?.cancel();
    const dpr = window.devicePixelRatio || 1;
    const viewport = targetPage.getViewport({ scale: zoomValue * dpr });
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const task = targetPage.render({ canvasContext: ctx, viewport, canvas });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'RenderingCancelledException') {
        console.error('PDF render failed', err);
      }
    }
  }, []);

  // Load document + first page when the file changes.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPage(null);

    (async () => {
      try {
        const doc = await loadPdfDocument(file.pdfBlob);
        if (cancelled) return;
        const loadedPage = await doc.getPage(1);
        if (cancelled) return;
        const viewport = loadedPage.getViewport({ scale: 1 });
        setBaseWidth(viewport.width);
        setBaseHeight(viewport.height);
        setPage(loadedPage);
        setStatus('ready');
      } catch (err) {
        console.error('Kunne ikke laste PDF', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [file.id, file.pdfBlob]);

  // Re-render (debounced) whenever zoom or the page changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !page) return;

    canvas.style.width = `${zoom * baseWidth}px`;
    canvas.style.height = `${zoom * baseHeight}px`;

    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      void renderAtZoom(page, zoom, canvas);
    }, RENDER_DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [zoom, page, baseWidth, baseHeight, renderAtZoom]);

  // Scroll the selected annotation into view (e.g. when clicked in the measurement panel).
  const selectedId = useAnnotationStore((s) => s.selectedId);
  useEffect(() => {
    const container = containerRef.current;
    if (!selectedId || !container) return;
    const annotation = useAnnotationStore.getState().annotations.find((a) => a.id === selectedId);
    if (!annotation) return;
    const xs = annotation.points.map((p) => p.x);
    const ys = annotation.points.map((p) => p.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;
    const targetLeft = PAGE_PADDING + centerX * zoom - container.clientWidth / 2;
    const targetTop = PAGE_PADDING + centerY * zoom - container.clientHeight / 2;
    container.scrollTo({ left: Math.max(0, targetLeft), top: Math.max(0, targetTop), behavior: 'smooth' });
  }, [selectedId, zoom]);

  const pageWidth = zoom * baseWidth;
  const pageHeight = zoom * baseHeight;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className={cn(
          'relative h-full overflow-auto bg-canvas',
          isPanMode && (isPanningActive ? 'cursor-grabbing' : 'cursor-grab'),
          isPanningActive && 'select-none',
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {status === 'loading' && (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Laster PDF …
          </div>
        )}

        {status === 'error' && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-6 text-destructive" />
            Kunne ikke åpne PDF-filen. Filen kan være skadet.
          </div>
        )}

        {status === 'ready' && (
          <div className="flex min-h-full min-w-full items-center justify-center p-16">
            <div className="relative shrink-0 shadow-lg" style={{ width: pageWidth, height: pageHeight }}>
              <canvas ref={canvasRef} className="absolute inset-0" />
              {showAnnotations && (
                <AnnotationLayer
                  fileId={file.id}
                  zoom={zoom}
                  width={pageWidth}
                  height={pageHeight}
                  calibration={file.calibration}
                  unit={unit}
                />
              )}
              {tool === 'calibrate' && (
                <CalibrationOverlay
                  fileId={file.id}
                  zoom={zoom}
                  width={pageWidth}
                  height={pageHeight}
                  calibrated={!!file.calibration}
                />
              )}
              {tool === 'detect' && (
                <RoomDetectionOverlay
                  fileId={file.id}
                  zoom={zoom}
                  width={pageWidth}
                  height={pageHeight}
                  canvasRef={canvasRef}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {status === 'ready' && showScaleBar && <ScaleBar zoom={zoom} calibration={file.calibration} />}
    </div>
  );
}
