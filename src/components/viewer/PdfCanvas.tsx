import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';
import { detectPdfLayers, loadPdfDocument, type PdfOptionalContentConfig, type PdfPageProxy } from '@/lib/pdf';
import { computeLayerVisibilityUpdates, EMPTY_LAYER_SELECTION } from '@/lib/layers';
import { useProjectStore } from '@/store/projectStore';
import { usePanZoom, type Pan } from '@/components/tools/usePanZoom';
import AnnotationLayer from '@/components/viewer/AnnotationLayer';
import ScaleBar from '@/components/viewer/ScaleBar';
import CompassWidget from '@/components/viewer/CompassWidget';
import OpeningPlaceOverlay from '@/components/openings/OpeningPlaceOverlay';
import OpeningPlaceBar from '@/components/openings/OpeningPlaceBar';
import { useSlowCursor } from '@/components/tools/useSlowCursor';
import MeasureOverlay from '@/components/measure/MeasureOverlay';
import RoomNameOverlay from '@/components/roomName/RoomNameOverlay';
import PeopleToolOverlay from '@/components/people/PeopleToolOverlay';
import MagnifierLoupe from '@/components/viewer/MagnifierLoupe';
import CalibrationOverlay from '@/components/calibration/CalibrationOverlay';
import CalibrationAreaOverlay from '@/components/calibration/CalibrationAreaOverlay';
import RoomDetectionOverlay from '@/components/detection/RoomDetectionOverlay';
import BoxSelectOverlay from '@/components/select/BoxSelectOverlay';
import WallToolOverlay from '@/components/wall/WallToolOverlay';
import WallAutoOverlay from '@/components/wall/WallAutoOverlay';
import MaterialPickerOverlay from '@/components/material/MaterialPickerOverlay';
import { useViewportStore } from '@/store/viewportStore';
import { useAnnotationStore } from '@/store/annotationStore';
import { cn } from '@/lib/utils';
import type { PdfFile } from '@/types';

// Kept short so the sharp re-render lands as soon as possible after the last
// zoom tick — a long debounce leaves the blurry CSS-stretched canvas visible
// noticeably after the user stops scrolling, which reads as a "snap" once the
// sharp frame finally swaps in. PDF.js cancels superseded render tasks
// cheaply (renderTaskRef.current?.cancel() below), so this stays responsive
// even during continuous fast scrolling.
const RENDER_DEBOUNCE_MS = 32;

// Margin reserved on each side for the fit-to-view calculation — small, so the
// fitted page fills most of the viewport with just a touch of breathing room.
const FIT_MARGIN = 48;

// How long the "jump to selected annotation" transition takes. Applied as a
// CSS transition only for that jump — wheel-zoom and drag-pan never get it,
// so they stay instant.
const JUMP_TRANSITION_MS = 250;

// Extra pixel density rendered at/around the default fit view so small
// drawing text and thin lines stay legible without zooming in — see the
// comment in renderAtZoom for why this doesn't affect memory use at high zoom.
const FIT_SUPERSAMPLE = 2;

type Status = 'loading' | 'ready' | 'error';

type PdfCanvasProps = {
  file: PdfFile;
  onFirstRender?: () => void;
};

export default function PdfCanvas({ file, onFirstRender }: PdfCanvasProps) {
  const zoom = useViewportStore((s) => s.zoom);
  const fitZoom = useViewportStore((s) => s.fitZoom);
  const setFitZoom = useViewportStore((s) => s.setFitZoom);
  const tool = useViewportStore((s) => s.tool);
  const showAnnotations = useViewportStore((s) => s.showAnnotations);
  const showScaleBar = useViewportStore((s) => s.showScaleBar);
  const showCompass = useViewportStore((s) => s.showCompass);
  const unit = useViewportStore((s) => s.unit);
  const pdfLayers = useViewportStore((s) => s.pdfLayers);
  const setPdfLayers = useViewportStore((s) => s.setPdfLayers);
  const layersVisible = useViewportStore((s) => s.layersVisible);
  const layerSelection =
    useProjectStore((s) => s.projects.find((p) => p.id === file.projectId)?.layerVisibilitySelection) ??
    EMPTY_LAYER_SELECTION;

  const [status, setStatus] = useState<Status>('loading');
  const [page, setPage] = useState<PdfPageProxy | null>(null);
  const [firstPaintDone, setFirstPaintDone] = useState(false);
  const [baseWidth, setBaseWidth] = useState(0);
  const [baseHeight, setBaseHeight] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<ReturnType<PdfPageProxy['render']> | null>(null);
  const debounceRef = useRef<number | null>(null);
  const pendingCenterRef = useRef(false);
  const panRef = useRef<Pan>({ x: 0, y: 0 });
  const lastMouseRef = useRef<{ x: number; y: number } | null>(null);
  const ocgConfigRef = useRef<PdfOptionalContentConfig | null>(null);

  const { handleWheel, handleMouseDown, handleMouseMove, handleMouseUp, isPanMode, isPanningActive } = usePanZoom(
    pageRef,
    panRef,
  );

  // Pressing/releasing F shows/hides the loupe right away at the last known cursor
  // position, instead of waiting for the next mouse move.
  useEffect(
    () =>
      useViewportStore.subscribe((state, prev) => {
        if (state.isMagnifierKeyDown === prev.isMagnifierKeyDown) return;
        state.setMagnifierScreenPos(state.isMagnifierKeyDown ? lastMouseRef.current : null);
      }),
    [],
  );

  useSlowCursor(containerRef);

  const renderAtZoom = useCallback(async (targetPage: PdfPageProxy, zoomValue: number, canvas: HTMLCanvasElement) => {
    renderTaskRef.current?.cancel();
    const dpr = window.devicePixelRatio || 1;
    // Supersample around the default fit view so small drawing text/lines stay
    // legible without zooming in — at exactly fitZoom (1 device pixel per CSS
    // pixel) there's no margin at all for anti-aliasing fine detail, which is
    // what makes it look soft even in the "whole page" default view. The floor
    // is FIT_SUPERSAMPLE times sharper than that; once the user actually zooms
    // in past that point, rendering just tracks their requested zoom directly
    // (no multiplier), so canvas size stays bounded at high zoom instead of
    // compounding into an enormous, memory-hungry bitmap.
    const renderScale = Math.max(zoomValue, fitZoom * FIT_SUPERSAMPLE) * dpr;
    const viewport = targetPage.getViewport({ scale: renderScale });

    // Render into an offscreen canvas and blit it onto the visible one only once
    // fully painted. Resizing the visible canvas directly clears its pixels
    // immediately, leaving it blank for the duration of the (async) render — this
    // avoids that flash by keeping the previous frame on screen until the next one
    // is ready to swap in atomically.
    const offscreen = document.createElement('canvas');
    offscreen.width = viewport.width;
    offscreen.height = viewport.height;
    const offscreenCtx = offscreen.getContext('2d');
    if (!offscreenCtx) return;
    const task = targetPage.render({
      canvasContext: offscreenCtx,
      viewport,
      canvas: offscreen,
      ...(ocgConfigRef.current ? { optionalContentConfigPromise: Promise.resolve(ocgConfigRef.current) } : {}),
    });
    renderTaskRef.current = task;
    try {
      await task.promise;
    } catch (err) {
      if (!(err instanceof Error) || err.name !== 'RenderingCancelledException') {
        console.error('PDF render failed', err);
      }
      return;
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(offscreen, 0, 0);
    setFirstPaintDone(true);
  }, [fitZoom]);

  // Load document + first page when the file changes.
  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setPage(null);
    setFirstPaintDone(false);
    setPdfLayers([]);
    ocgConfigRef.current = null;

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

        const detected = await detectPdfLayers(doc);
        if (cancelled) return;
        if (detected) {
          ocgConfigRef.current = detected.config;
          setPdfLayers(detected.layers);
        }
      } catch (err) {
        console.error('Kunne ikke laste PDF', err);
        if (!cancelled) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [file.id, file.pdfBlob, setPdfLayers]);

  // Tell the parent once the PDF is actually visible — either the first paint
  // landed, or loading failed (so a load failure doesn't leave a caller stuck
  // waiting forever for a render that will never happen).
  useEffect(() => {
    if (firstPaintDone || status === 'error') onFirstRender?.();
  }, [firstPaintDone, status, onFirstRender]);

  // Once the page's native size and the container's on-screen size are both
  // known, compute the scale that shows the whole page with no scrolling and
  // make that the default view — displayed as "100%" in the toolbar. The
  // actual pan centering happens in the layout effect below, once the
  // resulting zoom change has actually reached the DOM.
  useEffect(() => {
    const container = containerRef.current;
    if (status !== 'ready' || !container || !baseWidth || !baseHeight) return;
    const availableWidth = container.clientWidth - 2 * FIT_MARGIN;
    const availableHeight = container.clientHeight - 2 * FIT_MARGIN;
    const fit = Math.min(availableWidth / baseWidth, availableHeight / baseHeight);
    pendingCenterRef.current = true;
    setFitZoom(fit);
  }, [status, baseWidth, baseHeight, file.id, setFitZoom]);

  // Fires right after the zoom-driven page size actually lands in the DOM
  // (useLayoutEffect runs synchronously post-commit, pre-paint) — centers the
  // pan position, but only for the fit-to-view change above, not on every
  // zoom change (which would fight the user's own panning/zooming).
  useLayoutEffect(() => {
    if (!pendingCenterRef.current) return;
    pendingCenterRef.current = false;
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;
    const pageWidth = zoom * baseWidth;
    const pageHeight = zoom * baseHeight;
    const pan = { x: (container.clientWidth - pageWidth) / 2, y: (container.clientHeight - pageHeight) / 2 };
    panRef.current = pan;
    page.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
  }, [zoom, baseWidth, baseHeight]);

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

  // Apply layer visibility (toggle + persisted selection) and re-render immediately —
  // deliberately not debounced like the zoom effect above, since a checkbox click is a
  // discrete action rather than a continuous drag and should feel instant.
  useEffect(() => {
    const config = ocgConfigRef.current;
    if (!config || pdfLayers.length === 0) return;

    const updates = computeLayerVisibilityUpdates(pdfLayers, layerSelection, layersVisible);
    const changed = updates.some(({ id, visible }) => {
      const group = config.getGroup(id) as { visible: boolean } | null;
      return !!group && group.visible !== visible;
    });
    if (!changed) return;

    for (const { id, visible } of updates) config.setVisibility(id, visible);

    const canvas = canvasRef.current;
    if (canvas && page) void renderAtZoom(page, zoom, canvas);
  }, [layersVisible, layerSelection, pdfLayers, page, zoom, renderAtZoom]);

  // Pan the annotation into view — but only on an explicit jump request (e.g.
  // clicked in the measurement panel), never as a side effect of selection
  // itself. Newly created/detected annotations get auto-selected (for
  // highlighting/delete) without requesting a jump, so the camera stays put.
  const pendingJumpId = useViewportStore((s) => s.pendingJumpId);
  const requestJump = useViewportStore((s) => s.requestJump);
  useEffect(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!pendingJumpId || !container || !page) return;
    const annotation = useAnnotationStore.getState().annotations.find((a) => a.id === pendingJumpId);
    if (!annotation) {
      requestJump(null);
      return;
    }
    const allPoints = [annotation.points, ...(annotation.regions ?? [])].flat();
    const xs = allPoints.map((p) => p.x);
    const ys = allPoints.map((p) => p.y);
    const centerX = (Math.min(...xs) + Math.max(...xs)) / 2;
    const centerY = (Math.min(...ys) + Math.max(...ys)) / 2;

    // Read zoom fresh rather than depending on it (see deps below) — this
    // jump should only happen once, right when a new jump is requested,
    // using whatever zoom is current at that moment. Depending on `zoom`
    // here would re-run this on every subsequent wheel-zoom tick too, fighting
    // the cursor-anchored zoom and re-centering on the selection instead —
    // exactly the "screen jumps around while zooming" bug this fixes.
    const currentZoom = useViewportStore.getState().zoom;
    const pan = {
      x: container.clientWidth / 2 - centerX * currentZoom,
      y: container.clientHeight / 2 - centerY * currentZoom,
    };
    panRef.current = pan;

    // Animate just this jump — wheel-zoom and drag-pan never add this class,
    // so they stay instant.
    page.style.transition = `transform ${JUMP_TRANSITION_MS}ms ease`;
    page.style.transform = `translate(${pan.x}px, ${pan.y}px)`;
    requestJump(null);
    // Not cleared in an effect cleanup: requestJump(null) above changes pendingJumpId, which
    // re-runs this effect and would cancel the timer, leaving the transition on forever
    // (every later pan/zoom then animated).
    window.setTimeout(() => {
      page.style.transition = '';
    }, JUMP_TRANSITION_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- zoom read fresh, intentionally not a trigger (see comment above)
  }, [pendingJumpId]);

  const pageWidth = zoom * baseWidth;
  const pageHeight = zoom * baseHeight;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        data-pdf-container
        className={cn(
          'relative h-full overflow-hidden bg-canvas',
          isPanMode && (isPanningActive ? 'cursor-grabbing' : 'cursor-grab'),
          isPanningActive && 'select-none',
        )}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={(e) => {
          handleMouseMove(e);
          lastMouseRef.current = { x: e.clientX, y: e.clientY };
          // Holding F shows the loupe in every tool (draw/select set it themselves; this covers pan etc.).
          useViewportStore.getState().setMagnifierScreenPos(
            useViewportStore.getState().isMagnifierKeyDown ? lastMouseRef.current : null,
          );
        }}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          lastMouseRef.current = null;
          handleMouseUp();
          useViewportStore.getState().setMagnifierScreenPos(null);
        }}
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

        {/* Positioned via an imperative `transform: translate()` (set by
            usePanZoom / the layout effects above), never via React state —
            wheel-zoom and drag-pan mutate panRef + this element's style
            directly so they stay instant with no re-render in the loop.
            `transform` is intentionally absent from this `style` prop so
            React reconciliation never stomps those imperative updates. */}
        {status === 'ready' && (
          <div ref={pageRef} className="absolute shadow-lg" style={{ width: pageWidth, height: pageHeight }}>
            <canvas ref={canvasRef} className="absolute inset-0" />
            {!firstPaintDone && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-canvas text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Laster PDF …
              </div>
            )}
            {showAnnotations && firstPaintDone && (
              <AnnotationLayer
                fileId={file.id}
                zoom={zoom}
                width={pageWidth}
                height={pageHeight}
                calibration={file.calibration}
                unit={unit}
                openings={file.openings}
                placedOpenings={file.placedOpenings}
              />
            )}
            {tool === 'box-select' && <BoxSelectOverlay zoom={zoom} width={pageWidth} height={pageHeight} />}
            {tool === 'calibrate' && (
              <CalibrationOverlay
                fileId={file.id}
                zoom={zoom}
                width={pageWidth}
                height={pageHeight}
                calibrated={!!file.calibration}
              />
            )}
            {tool === 'calibrate-area' && (
              <CalibrationAreaOverlay
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
            {tool === 'wall-auto' && (
              <WallAutoOverlay zoom={zoom} width={pageWidth} height={pageHeight} calibration={file.calibration} />
            )}
            {tool === 'wall' && <WallToolOverlay zoom={zoom} width={pageWidth} height={pageHeight} />}
            {tool === 'opening' && (
              <OpeningPlaceOverlay file={file} zoom={zoom} width={pageWidth} height={pageHeight} />
            )}
            {tool === 'measure' && (
              <MeasureOverlay zoom={zoom} width={pageWidth} height={pageHeight} calibration={file.calibration} />
            )}
            {tool === 'room-name' && <RoomNameOverlay page={page} zoom={zoom} width={pageWidth} height={pageHeight} />}
            {tool === 'people' && <PeopleToolOverlay zoom={zoom} width={pageWidth} height={pageHeight} />}
            {tool === 'material' && <MaterialPickerOverlay zoom={zoom} width={pageWidth} height={pageHeight} />}
          </div>
        )}
      </div>

      {status === 'ready' && (showCompass || showScaleBar) && (
        <div className="absolute bottom-4 left-4 flex flex-col items-start gap-2">
          {showCompass && <CompassWidget />}
          {showScaleBar && <ScaleBar zoom={zoom} calibration={file.calibration} />}
        </div>
      )}
      {status === 'ready' && tool === 'opening' && <OpeningPlaceBar file={file} />}
      {status === 'ready' && <MagnifierLoupe canvasRef={canvasRef} />}
    </div>
  );
}
