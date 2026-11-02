import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useDrawingInProgress } from '@/components/tools/useDrawingInProgress';
import { bearingBetween, northFromWall } from '@/lib/north';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/store/projectStore';
import { useViewportStore } from '@/store/viewportStore';
import type { Point } from '@/types';

type NorthCalibrationOverlayProps = { zoom: number; width: number; height: number };

const MIN_LENGTH_PDF_UNITS = 5;

/**
 * Second half of the compass calibration: the same wall that was measured on the screenshot is marked on the
 * drawing (two clicks, from the same end), and north follows from the difference of the two angles.
 */
export default function NorthCalibrationOverlay({ zoom, width, height }: NorthCalibrationOverlayProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const updateNorthDirection = useProjectStore((s) => s.updateNorthDirection);
  const setTool = useViewportStore((s) => s.setTool);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const [start, setStart] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point | null>(null);
  useDrawingInProgress(start !== null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setStart(null);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function toPdf(e: ReactMouseEvent<SVGSVGElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (useViewportStore.getState().isSpaceDown) return;
    const point = toPdf(e);
    if (!start) {
      setStart(point);
      return;
    }
    if (Math.hypot(point.x - start.x, point.y - start.y) < MIN_LENGTH_PDF_UNITS) return;
    const screenshotBearing = useViewportStore.getState().northScreenshotBearing;
    if (screenshotBearing === null || !projectId) return;
    const north = northFromWall(bearingBetween(start, point), screenshotBearing);
    void updateNorthDirection(projectId, north);
    toast.success(`Nord er satt til ${Math.round(north)}°`);
    setStart(null);
    setTool('select');
  }

  return (
    <svg
      className={cn('absolute inset-0', !isSpaceDown && 'cursor-crosshair')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={(e) => !useViewportStore.getState().isSpaceDown && setCursor(toPdf(e))}
      onClick={handleClick}
    >
      {start && cursor && (
        <line x1={start.x * zoom} y1={start.y * zoom} x2={cursor.x * zoom} y2={cursor.y * zoom} stroke="#0091ff" strokeWidth={2} strokeDasharray="6 4" />
      )}
      {start && <circle cx={start.x * zoom} cy={start.y * zoom} r={4} fill="#0091ff" />}
    </svg>
  );
}
