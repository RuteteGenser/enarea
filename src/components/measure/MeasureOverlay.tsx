import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { formatLength, metersPerUnit } from '@/lib/calibration';
import { constrainAngle, distance } from '@/lib/geometry';
import { cn } from '@/lib/utils';
import { snapCursor, useSnapCandidates } from '@/components/tools/useSnap';
import { useDrawingInProgress } from '@/components/tools/useDrawingInProgress';
import { useViewportStore } from '@/store/viewportStore';
import type { Calibration, Point } from '@/types';

type MeasureOverlayProps = { zoom: number; width: number; height: number; calibration: Calibration };

/**
 * Measure tool: click the start and end point (or drag) to read a distance. The line is only a
 * temporary readout — it is never saved to the model and disappears with the next measurement,
 * Esc or switching tool.
 */
export default function MeasureOverlay({ zoom, width, height, calibration }: MeasureOverlayProps) {
  const unit = useViewportStore((s) => s.unit);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const snapCandidates = useSnapCandidates();
  const svgRef = useRef<SVGSVGElement>(null);

  const [start, setStart] = useState<Point | null>(null);
  const [end, setEnd] = useState<Point | null>(null); // set once the measurement is finished
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapped, setSnapped] = useState<Point | null>(null);
  // A plain click (no drag) sets the start point; the next click finishes. A drag does both at once.
  const dragFrom = useRef<Point | null>(null);

  useDrawingInProgress(start !== null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setStart(null);
        setEnd(null);
        setCursor(null);
        setSnapped(null);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const mpu = metersPerUnit(calibration);

  function resolve(e: ReactMouseEvent<SVGSVGElement>, reference: Point | null): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = { x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom };
    if (reference && useViewportStore.getState().isShiftDown) {
      setSnapped(null);
      return constrainAngle(reference, raw);
    }
    const { point, snappedTo } = snapCursor(raw, snapCandidates, zoom);
    setSnapped(snappedTo);
    return point;
  }

  function handleMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (isSpaceDown) return;
    setCursor(resolve(e, start && !end ? start : null));
  }

  function handleMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    if (isSpaceDown || e.button !== 0) return;
    // Pressing starts a new measurement unless one is waiting for its end point.
    if (!start || end) {
      const p = resolve(e, null);
      setStart(p);
      setEnd(null);
      dragFrom.current = p;
    } else {
      dragFrom.current = null;
    }
  }

  function handleMouseUp(e: ReactMouseEvent<SVGSVGElement>) {
    if (isSpaceDown || e.button !== 0 || !start) return;
    const p = resolve(e, start);
    if (dragFrom.current) {
      // First press-release: a real drag finishes right away, a click just sets the start point.
      if (distance(dragFrom.current, p) * zoom > 4) setEnd(p);
      dragFrom.current = null;
      return;
    }
    if (!end) setEnd(p); // second click finishes
  }

  const to = end ?? (start && cursor ? cursor : null);
  const meters = start && to ? distance(start, to) * mpu : null;
  const a = start ? { x: start.x * zoom, y: start.y * zoom } : null;
  const b = to ? { x: to.x * zoom, y: to.y * zoom } : null;
  const label = meters === null ? '' : formatLength(meters, unit);
  const labelWidth = label.length * 6.5 + 14;

  return (
    <svg
      ref={svgRef}
      className={cn('absolute inset-0', !isSpaceDown && 'cursor-crosshair')}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      onMouseMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setCursor(null)}
    >
      {a && b && (
        <g pointerEvents="none">
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0091ff" strokeWidth={2} strokeDasharray={end ? undefined : '6 4'} />
          <circle cx={a.x} cy={a.y} r={4} fill="#0091ff" />
          <circle cx={b.x} cy={b.y} r={4} fill="#0091ff" />
          <g transform={`translate(${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 - 14})`}>
            <rect x={-labelWidth / 2} y={-10} width={labelWidth} height={20} rx={4} className="fill-card stroke-primary" strokeWidth={1} />
            <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} className="select-none fill-foreground">
              {label}
            </text>
          </g>
        </g>
      )}
      {a && !b && <circle cx={a.x} cy={a.y} r={4} fill="#0091ff" pointerEvents="none" />}
      {snapped && <circle cx={snapped.x * zoom} cy={snapped.y * zoom} r={7} fill="none" stroke="#0091ff" strokeWidth={1.5} pointerEvents="none" />}
    </svg>
  );
}
