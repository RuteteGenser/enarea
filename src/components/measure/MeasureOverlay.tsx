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
 * Measure tool (a temporary tape measure): click points one after another to chain measurements — each leg gets
 * its length and the running total is shown. A first press-and-drag also measures a leg. Double-click or Enter
 * finishes the chain (the next click starts a new one); Esc clears. Nothing is saved to the model: the line
 * disappears with the next measurement, Esc or switching tool.
 */
export default function MeasureOverlay({ zoom, width, height, calibration }: MeasureOverlayProps) {
  const unit = useViewportStore((s) => s.unit);
  const isSpaceDown = useViewportStore((s) => s.isSpaceDown);
  const snapCandidates = useSnapCandidates();
  const svgRef = useRef<SVGSVGElement>(null);

  const [points, setPoints] = useState<Point[]>([]);
  const [finished, setFinished] = useState(false);
  const [cursor, setCursor] = useState<Point | null>(null);
  const [snapped, setSnapped] = useState<Point | null>(null);
  // The press that starts a chain can be a drag (start → end in one gesture) or a plain click.
  const dragFrom = useRef<Point | null>(null);

  useDrawingInProgress(points.length > 0 && !finished);

  const clear = () => {
    setPoints([]);
    setFinished(false);
    setCursor(null);
    setSnapped(null);
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') clear();
      if (e.key === 'Enter') setFinished(true);
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const mpu = metersPerUnit(calibration);
  const last = points[points.length - 1] ?? null;
  const live = last && !finished ? last : null;

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
    setCursor(resolve(e, live));
  }

  function handleMouseDown(e: ReactMouseEvent<SVGSVGElement>) {
    if (isSpaceDown || e.button !== 0) return;
    // Pressing starts a new chain unless one is still going.
    if (points.length === 0 || finished) {
      const p = resolve(e, null);
      setPoints([p]);
      setFinished(false);
      dragFrom.current = p;
    } else {
      dragFrom.current = null;
    }
  }

  function handleMouseUp(e: ReactMouseEvent<SVGSVGElement>) {
    if (isSpaceDown || e.button !== 0 || !last || finished) return;
    const p = resolve(e, last);
    if (dragFrom.current) {
      // First press-release: a real drag measures the first leg, a click just sets the start point.
      if (distance(dragFrom.current, p) * zoom > 4) setPoints([dragFrom.current, p]);
      dragFrom.current = null;
      return;
    }
    if (distance(last, p) * zoom > 2) setPoints((current) => [...current, p]);
  }

  const shown = live && cursor ? [...points, cursor] : points;
  const legs = shown.slice(1).map((to, i) => ({ from: shown[i], to, meters: distance(shown[i], to) * mpu }));
  const total = legs.reduce((sum, leg) => sum + leg.meters, 0);
  const screen = (p: Point) => ({ x: p.x * zoom, y: p.y * zoom });
  const tag = (text: string) => ({ text, width: text.length * 6.5 + 14 });

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
      onDoubleClick={() => points.length > 1 && setFinished(true)}
      onMouseLeave={() => setCursor(null)}
    >
      <g pointerEvents="none">
        {legs.map((leg, i) => {
          const a = screen(leg.from);
          const b = screen(leg.to);
          const isLive = !finished && i === legs.length - 1 && live !== null && cursor !== null;
          const { text, width: w } = tag(formatLength(leg.meters, unit));
          return (
            <g key={i}>
              <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#0091ff" strokeWidth={2} strokeDasharray={isLive ? '6 4' : undefined} />
              <g transform={`translate(${(a.x + b.x) / 2}, ${(a.y + b.y) / 2 - 14})`}>
                <rect x={-w / 2} y={-10} width={w} height={20} rx={4} className="fill-card stroke-primary" strokeWidth={1} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} className="select-none fill-foreground">
                  {text}
                </text>
              </g>
            </g>
          );
        })}
        {shown.map((p, i) => (
          <circle key={i} cx={p.x * zoom} cy={p.y * zoom} r={4} fill="#0091ff" />
        ))}
        {legs.length > 1 &&
          (() => {
            const end = screen(shown[shown.length - 1]);
            const { text, width: w } = tag(`Totalt ${formatLength(total, unit)}`);
            return (
              <g transform={`translate(${end.x + w / 2 + 12}, ${end.y + 22})`}>
                <rect x={-w / 2} y={-10} width={w} height={20} rx={4} className="fill-primary" />
                <text textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={600} className="select-none fill-primary-foreground">
                  {text}
                </text>
              </g>
            );
          })()}
        {snapped && <circle cx={snapped.x * zoom} cy={snapped.y * zoom} r={7} fill="none" stroke="#0091ff" strokeWidth={1.5} />}
      </g>
    </svg>
  );
}
