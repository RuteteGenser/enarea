import { useEffect } from 'react';
import { useViewportStore } from '@/store/viewportStore';
import { useAnnotationStore } from '@/store/annotationStore';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

const TOOL_KEYS: Record<string, 'select' | 'line' | 'rectangle' | 'polygon' | 'pan'> = {
  v: 'select',
  l: 'line',
  r: 'rectangle',
  p: 'polygon',
  h: 'pan',
};

export function useKeyboardShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        useViewportStore.getState().setSpaceDown(true);
        return;
      }

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          useAnnotationStore.getState().redo();
        } else {
          useAnnotationStore.getState().undo();
        }
        return;
      }

      if (mod && e.key.toLowerCase() === 'c') {
        useAnnotationStore.getState().copySelected();
        return;
      }

      if (mod && e.key.toLowerCase() === 'v') {
        useAnnotationStore.getState().pasteClipboard();
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !mod) {
        const { selectedId, deleteAnnotation, annotations } = useAnnotationStore.getState();
        if (!selectedId) return;
        const annotation = annotations.find((a) => a.id === selectedId);
        if (annotation?.locked) return;
        e.preventDefault();
        deleteAnnotation(selectedId);
        return;
      }

      if (e.key === 'Escape') {
        useAnnotationStore.getState().setSelected(null);
        return;
      }

      const toolKey = TOOL_KEYS[e.key.toLowerCase()];
      if (toolKey && !mod) {
        useViewportStore.getState().setTool(toolKey);
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') {
        useViewportStore.getState().setSpaceDown(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [enabled]);
}
