import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import CalibrationDialog from '@/components/calibration/CalibrationDialog';
import { useDrawingInProgress } from '@/components/tools/useDrawingInProgress';
import { useSnapCandidates, snapCursor } from '@/components/tools/useSnap';
import { MIN_DRAG_PDF_UNITS } from '@/components/tools/useDrawTool';
import { constrainAngle, distance } from '@/lib/geometry';
import { cn } from '@/lib/utils';
import { useFilesStore } from '@/store/filesStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Point } from '@/types';

type CalibrationOverlayProps = {
  fileId: string;
  zoom: number;
  width: number;
  height: number;
  calibrated: boolean;
};

export default function CalibrationOverlay({ fileId, zoom, width, height, calibrated }: CalibrationOverlayProps) {
  const setCalibration = useFilesStore((s) => s.setCalibration);
  const setTool = useViewportStore((s) => s.setTool);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const snapCandidates = useSnapCandidates();

  const [dragStart, setDragStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapped, setSnapped] = useState<Point | null>(null);
  const [pendingLine, setPendingLine] = useState<[Point, Point] | null>(null);
  useDrawingInProgress(dragStart !== null);

  function toPdfPoint(e: ReactMouseEvent<SVGSVGElement>, referencePoint: Point | null = null): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };

    if (referencePoint && useViewportStore.getState().isShiftDown) {
      setSnapped(null);
      return constrainAngle(referencePoint, raw);
    }

    const { point, snappedTo } = snapCursor(raw, snapCandidates, zoom);
    setSnapped(snappedTo);
    return point;
  }

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (useViewportStore.getState().isSpaceDown) return;
    setCursor(toPdfPoint(e, dragStart));
  }

  // Two separate clicks: the first sets the start point, the second the end point.
  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (useViewportStore.getState().isSpaceDown) return;
    if (!dragStart) {
      setDragStart(toPdfPoint(e));
      return;
    }
    const point = toPdfPoint(e, dragStart);
    if (distance(dragStart, point) >= MIN_DRAG_PDF_UNITS) {
      setPendingLine([dragStart, point]);
      setDragStart(null);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setDragStart(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isRecalibration = calibrated && !pendingLine;

  return (
    <>
      <svg
        className={cn('absolute inset-0 outline-none', !isSpaceDown && 'cursor-crosshair')}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        {dragStart && cursor && (
          <line
            x1={dragStart.x * zoom}
            y1={dragStart.y * zoom}
            x2={cursor.x * zoom}
            y2={cursor.y * zoom}
            stroke="#f5a623"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
        )}
        {dragStart && <circle cx={dragStart.x * zoom} cy={dragStart.y * zoom} r={4} className="fill-amber-500" />}
        {snapped && (
          <circle
            cx={snapped.x * zoom}
            cy={snapped.y * zoom}
            r={7}
            fill="none"
            stroke="#f5a623"
            strokeWidth={1.5}
          />
        )}
      </svg>

      <CalibrationDialog
        open={pendingLine !== null}
        isRecalibration={isRecalibration}
        onCancel={() => setPendingLine(null)}
        onConfirm={(realMeters) => {
          if (!pendingLine) return;
          void setCalibration(fileId, { pointA: pendingLine[0], pointB: pendingLine[1], realMeters });
          setPendingLine(null);
          setTool('select');
        }}
      />
    </>
  );
}
