import { useEffect } from 'react';
import { useViewportStore } from '@/store/viewportStore';

/**
 * Tells the global Escape handler that a tool has something half-finished, so the
 * first Escape cancels that (the tool does it itself) and only the next one leaves the tool.
 */
export function useDrawingInProgress(active: boolean) {
  const setDrawingInProgress = useViewportStore((s) => s.setDrawingInProgress);
  useEffect(() => {
    setDrawingInProgress(active);
    return () => setDrawingInProgress(false);
  }, [active, setDrawingInProgress]);
}
