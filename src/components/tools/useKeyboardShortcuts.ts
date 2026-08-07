import { useEffect } from 'react';
import { useViewportStore } from '@/store/viewportStore';
import { useAnnotationStore } from '@/store/annotationStore';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

// A focused <button> should get its own native Space/Enter activation instead
// of the app's pan-mode shortcut also firing — relevant for keyboard users who
// Tab to a button (mouse clicks no longer leave buttons focused, see Button's
// onMouseDown, but Tab-focus is intentionally left alone for accessibility).
function isButtonTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && target.tagName === 'BUTTON';
}

const TOOL_KEYS: Record<string, 'select' | 'line' | 'rectangle' | 'polygon' | 'pan' | 'detect' | 'wall' | 'material'> = {
  v: 'select',
  l: 'line',
  r: 'rectangle',
  p: 'polygon',
  h: 'pan',
  d: 'detect',
  w: 'wall',
  m: 'material',
};

export function useKeyboardShortcuts(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (isEditableTarget(e.target)) return;

      if (e.code === 'Space') {
        if (isButtonTarget(e.target)) return;
        e.preventDefault();
        useViewportStore.getState().setSpaceDown(true);
        return;
      }

      if (e.key === 'Shift') {
        useViewportStore.getState().setShiftDown(true);
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
        if (!isButtonTarget(e.target)) e.preventDefault();
        useViewportStore.getState().setSpaceDown(false);
      }
      if (e.key === 'Shift') {
        useViewportStore.getState().setShiftDown(false);
      }
    }

    function handleBlur() {
      // The window can lose focus while a modifier is physically held (e.g. alt-tab),
      // which means no keyup ever fires — reset so tools don't get stuck constrained/panning.
      useViewportStore.getState().setSpaceDown(false);
      useViewportStore.getState().setShiftDown(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
    };
  }, [enabled]);
}
