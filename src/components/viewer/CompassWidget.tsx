import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useProjectStore } from '@/store/projectStore';

// Converts a mouse position (relative to the dial's center) to a compass
// bearing in degrees, where 0° = up/north and it increases clockwise — the
// same convention the project-settings dialog's rotate(deg) preview uses.
function bearingFromPoint(dx: number, dy: number) {
  const raw = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return ((raw % 360) + 360) % 360;
}

export default function CompassWidget() {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => (projectId ? s.getProject(projectId) : undefined));
  const updateNorthDirection = useProjectStore((s) => s.updateNorthDirection);

  const dialRef = useRef<HTMLDivElement>(null);
  const [dragAngle, setDragAngle] = useState<number | null>(null);
  const isDragging = dragAngle !== null;

  const angle = dragAngle ?? project?.northDirection ?? 0;

  const [inputValue, setInputValue] = useState(String(Math.round(angle)));
  const inputFocusedRef = useRef(false);
  useEffect(() => {
    if (!inputFocusedRef.current) setInputValue(String(Math.round(angle)));
  }, [angle]);

  const commitInput = useCallback(
    (raw: string) => {
      const parsed = Number(raw);
      if (!projectId || !Number.isFinite(parsed)) return;
      void updateNorthDirection(projectId, parsed);
    },
    [projectId, updateNorthDirection],
  );

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const dial = dialRef.current;
    if (!dial) return;
    const rect = dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    setDragAngle(bearingFromPoint(e.clientX - cx, e.clientY - cy));
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const dial = dialRef.current;
    if (!dial) return;
    const rect = dial.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    const handleMove = (e: MouseEvent) => {
      setDragAngle(bearingFromPoint(e.clientX - cx, e.clientY - cy));
    };
    const handleUp = (e: MouseEvent) => {
      if (projectId) {
        void updateNorthDirection(projectId, bearingFromPoint(e.clientX - cx, e.clientY - cy));
      }
      setDragAngle(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    // Re-bind fresh on every drag start so the dial's center is measured once
    // per gesture (it doesn't move mid-drag) rather than on every mousemove.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, projectId, updateNorthDirection]);

  if (!project) return null;

  return (
    <div className="absolute top-4 right-4 flex flex-col items-center gap-2 rounded-md bg-card/90 px-3 py-2.5 shadow-sm ring-1 ring-border">
      <div
        ref={dialRef}
        onMouseDown={handleMouseDown}
        className="relative flex size-24 shrink-0 cursor-grab items-center justify-center rounded-full border border-border bg-background/50 active:cursor-grabbing"
        title="Dra for å sette nordretning"
      >
        <ArrowUp
          className="pointer-events-none size-14 text-red-500 drop-shadow-sm"
          strokeWidth={2.5}
          style={{ transform: `rotate(${angle}deg)` }}
        />
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={0}
          max={360}
          value={inputValue}
          onFocus={() => {
            inputFocusedRef.current = true;
          }}
          onChange={(e) => setInputValue(e.target.value)}
          onBlur={(e) => {
            inputFocusedRef.current = false;
            commitInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="h-7 w-16 px-2 text-center text-xs tabular-nums"
        />
        <span className="text-xs font-medium text-muted-foreground">°</span>
      </div>
    </div>
  );
}
