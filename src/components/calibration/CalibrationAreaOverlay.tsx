import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import AreaCalibrationDialog from '@/components/calibration/AreaCalibrationDialog';
import { useSnapCandidates, snapCursor } from '@/components/tools/useSnap';
import { calibrationFromArea } from '@/lib/calibration';
import { constrainAngle } from '@/lib/geometry';
import { cn } from '@/lib/utils';
import { useFilesStore } from '@/store/filesStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Point } from '@/types';

type CalibrationAreaOverlayProps = {
  fileId: string;
  zoom: number;
  width: number;
  height: number;
  calibrated: boolean;
};

export default function CalibrationAreaOverlay({
  fileId,
  zoom,
  width,
  height,
  calibrated,
}: CalibrationAreaOverlayProps) {
  const setCalibration = useFilesStore((s) => s.setCalibration);
  const setTool = useViewportStore((s) => s.setTool);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const snapCandidates = useSnapCandidates();

  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapped, setSnapped] = useState<Point | null>(null);
  const [pendingArea, setPendingArea] = useState<Point[] | null>(null);

  function toPdfPoint(e: ReactMouseEvent<SVGSVGElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };

    const referencePoint = points.length > 0 ? points[points.length - 1] : null;
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
    setCursor(toPdfPoint(e));
  }

  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (useViewportStore.getState().isSpaceDown) return;
    const point = toPdfPoint(e);
    setPoints([...points, point]);
  }

  function handleDoubleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (useViewportStore.getState().isSpaceDown) return;
    e.preventDefault();
    const finalPoints = points.slice(0, -1);
    if (finalPoints.length >= 3) {
      setPendingArea(finalPoints);
    }
    setPoints([]);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPoints([]);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isRecalibration = calibrated && !pendingArea;

  const previewPoints = cursor ? [...points, cursor] : points;
  const pathD = previewPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x * zoom} ${p.y * zoom}`).join(' ');

  return (
    <>
      <svg
        className={cn('absolute inset-0 outline-none', !isSpaceDown && 'cursor-crosshair')}
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {previewPoints.length >= 2 && (
          <path d={pathD} fill="none" stroke="#f5a623" strokeWidth={2} strokeDasharray="6 4" />
        )}
        {points.map((p, i) => (
          <circle key={i} cx={p.x * zoom} cy={p.y * zoom} r={4} className="fill-amber-500" />
        ))}
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

      <AreaCalibrationDialog
        open={pendingArea !== null}
        isRecalibration={isRecalibration}
        onCancel={() => setPendingArea(null)}
        onConfirm={(realSquareMeters) => {
          if (!pendingArea) return;
          const result = calibrationFromArea(pendingArea, realSquareMeters);
          if (result) void setCalibration(fileId, result);
          setPendingArea(null);
          setTool('select');
        }}
      />
    </>
  );
}
