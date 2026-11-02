import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { Check, X } from 'lucide-react';
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
  // The measured wall waits for confirmation; its end points can be dragged to correct it.
  const [wall, setWall] = useState<[Point, Point] | null>(null);
  const [dragEnd, setDragEnd] = useState<0 | 1 | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  useDrawingInProgress(start !== null || wall !== null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setStart(null);
        setWall(null);
      }
      if (e.key === 'Enter') confirmRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (dragEnd === null) return;
    function onMove(e: MouseEvent) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const p = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
      setWall((w) => (w ? (dragEnd === 0 ? [p, w[1]] : [w[0], p]) : w));
    }
    const onUp = () => setDragEnd(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragEnd, zoom]);

  function confirm() {
    const screenshotBearing = useViewportStore.getState().northScreenshotBearing;
    if (!wall || screenshotBearing === null || !projectId) return;
    const north = northFromWall(bearingBetween(wall[0], wall[1]), screenshotBearing);
    void updateNorthDirection(projectId, north);
    toast.success(`Nord er satt til ${Math.round(north)}°`);
    setWall(null);
    setTool('select');
  }
  const confirmRef = useRef(confirm);
  confirmRef.current = confirm;

  function toPdf(e: ReactMouseEvent<SVGSVGElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
  }

  function handleClick(e: ReactMouseEvent<SVGSVGElement>) {
    if (useViewportStore.getState().isSpaceDown) return;
    const point = toPdf(e);
    if (wall) return;
    if (!start) {
      setStart(point);
      return;
    }
    if (Math.hypot(point.x - start.x, point.y - start.y) < MIN_LENGTH_PDF_UNITS) return;
    setWall([start, point]);
    setStart(null);
  }

  const mid = wall ? { x: ((wall[0].x + wall[1].x) / 2) * zoom, y: ((wall[0].y + wall[1].y) / 2) * zoom } : null;

  return (
    <>
    <svg
      ref={svgRef}
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
      {wall && (
        <>
          <line x1={wall[0].x * zoom} y1={wall[0].y * zoom} x2={wall[1].x * zoom} y2={wall[1].y * zoom} stroke="#0091ff" strokeWidth={2} />
          {wall.map((p, i) => (
            <g
              key={i}
              className="cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragEnd(i as 0 | 1);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <circle cx={p.x * zoom} cy={p.y * zoom} r={10} fill="transparent" />
              <circle cx={p.x * zoom} cy={p.y * zoom} r={5} fill={i === 0 ? '#f5a623' : '#0091ff'} stroke="white" strokeWidth={1.5} />
            </g>
          ))}
        </>
      )}
    </svg>
    {mid && (
      <div
        className="absolute z-10 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-md border border-border bg-card p-1 shadow-md"
        style={{ left: mid.x, top: mid.y - 14 }}
      >
        <button type="button" onClick={confirm} title="Bruk veggen (Enter)" className="flex size-7 items-center justify-center rounded bg-primary text-primary-foreground hover:bg-primary/90">
          <Check className="size-4" />
        </button>
        <button type="button" onClick={() => setWall(null)} title="Mål på nytt" className="flex size-7 items-center justify-center rounded text-muted-foreground hover:bg-secondary">
          <X className="size-4" />
        </button>
      </div>
    )}
    </>
  );
}
