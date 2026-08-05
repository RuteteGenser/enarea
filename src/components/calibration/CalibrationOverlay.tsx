import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import CalibrationDialog from '@/components/calibration/CalibrationDialog';
import { useSnapCandidates, snapCursor } from '@/components/tools/useSnap';
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
  const snapCandidates = useSnapCandidates();

  const [points, setPoints] = useState<Point[]>([]);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapped, setSnapped] = useState<Point | null>(null);
  const [pendingLine, setPendingLine] = useState<[Point, Point] | null>(null);

  function toPdfPoint(e: ReactMouseEvent<SVGSVGElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    const { point, snappedTo } = snapCursor(raw, snapCandidates, zoom);
    setSnapped(snappedTo);
    return point;
  }

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    setCursor(toPdfPoint(e));
  }

  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    const point = toPdfPoint(e);
    if (points.length === 0) {
      setPoints([point]);
    } else {
      setPendingLine([points[0], point]);
      setPoints([]);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPoints([]);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const isRecalibration = calibrated && !pendingLine;

  return (
    <>
      <svg
        className="absolute inset-0 cursor-crosshair outline-none"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      >
        {points.length === 1 && cursor && (
          <line
            x1={points[0].x * zoom}
            y1={points[0].y * zoom}
            x2={cursor.x * zoom}
            y2={cursor.y * zoom}
            stroke="#f5a623"
            strokeWidth={2}
            strokeDasharray="6 4"
          />
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
