import { useEffect, type RefObject } from 'react';
import { useViewportStore } from '@/store/viewportStore';

/** Fraction of the real mouse movement the crosshair follows while F is held. */
const SLOW = 0.3;
const CROSS_SIZE = 18;

/**
 * Precise cursor: press F and the pointer over the drawing becomes a crosshair that follows only a fraction
 * of the mouse movement while F is held. A page cannot move or slow the real cursor, so the crosshair stays
 * the pointer after F is released too — normal speed again, continuing from where the slow part ended — until
 * the real cursor leaves the drawing, where the normal pointer is back. The real cursor is hidden meanwhile,
 * and mouse events are re-dispatched at the crosshair so every tool just sees normal events. No pointer lock.
 */
export function useSlowCursor(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const el: HTMLElement = container;

    let last: { x: number; y: number } | null = null; // last known real position over the drawing
    let real = { x: 0, y: 0 };
    const virtual = { x: 0, y: 0 };
    let active = false;
    let cross: HTMLDivElement | null = null;
    let hideCursor: HTMLStyleElement | null = null;

    const insideContainer = (target: EventTarget | null) => target instanceof Node && el.contains(target);

    function moveCross() {
      if (cross) cross.style.transform = `translate(${virtual.x}px, ${virtual.y}px)`;
    }

    function stop() {
      active = false;
      cross?.remove();
      cross = null;
      hideCursor?.remove();
      hideCursor = null;
    }

    function start() {
      if (active || !last) return;
      active = true;
      real = { ...last };
      virtual.x = last.x;
      virtual.y = last.y;

      hideCursor = document.createElement('style');
      hideCursor.textContent = '[data-pdf-container], [data-pdf-container] * { cursor: none !important; }';
      document.head.appendChild(hideCursor);

      cross = document.createElement('div');
      cross.style.cssText = `position:fixed;left:0;top:0;z-index:60;pointer-events:none;width:${CROSS_SIZE}px;height:${CROSS_SIZE}px;margin:${-CROSS_SIZE / 2}px 0 0 ${-CROSS_SIZE / 2}px;`;
      const line = 'position:absolute;background:#e11d48;box-shadow:0 0 0 1px rgba(255,255,255,.8);';
      cross.innerHTML = `<div style="${line}left:50%;top:0;width:1px;height:100%"></div><div style="${line}top:50%;left:0;height:1px;width:100%"></div>`;
      document.body.appendChild(cross);
      moveCross();
    }

    function dispatchAtVirtual(type: string, source: MouseEvent) {
      const target = document.elementFromPoint(virtual.x, virtual.y) ?? el;
      const init: MouseEventInit = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: virtual.x,
        clientY: virtual.y,
        screenX: source.screenX,
        screenY: source.screenY,
        button: source.button,
        buttons: source.buttons,
        detail: source.detail,
        ctrlKey: source.ctrlKey,
        shiftKey: source.shiftKey,
        altKey: source.altKey,
        metaKey: source.metaKey,
      };
      target.dispatchEvent(
        source instanceof WheelEvent
          ? new WheelEvent(type, { ...init, deltaX: source.deltaX, deltaY: source.deltaY, deltaMode: source.deltaMode })
          : new MouseEvent(type, init),
      );
    }

    // Capture phase on window: runs before React's handlers so the real events can be swapped for ours.
    function onMove(e: MouseEvent) {
      if (!e.isTrusted) return; // our own dispatched events
      if (!active) {
        last = insideContainer(e.target) ? { x: e.clientX, y: e.clientY } : null;
        return;
      }
      if (!insideContainer(e.target)) {
        stop(); // the real cursor left the drawing: the normal pointer is back
        last = null;
        return;
      }
      e.stopImmediatePropagation();
      const speed = useViewportStore.getState().isMagnifierKeyDown ? SLOW : 1;
      const rect = el.getBoundingClientRect();
      virtual.x = Math.min(rect.right - 1, Math.max(rect.left, virtual.x + (e.clientX - real.x) * speed));
      virtual.y = Math.min(rect.bottom - 1, Math.max(rect.top, virtual.y + (e.clientY - real.y) * speed));
      real = { x: e.clientX, y: e.clientY };
      moveCross();
      dispatchAtVirtual('mousemove', e);
    }
    function redispatch(e: MouseEvent) {
      if (!active || !e.isTrusted || !insideContainer(e.target)) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      dispatchAtVirtual(e.type, e);
    }

    const unsubscribe = useViewportStore.subscribe((state, prev) => {
      if (state.isMagnifierKeyDown && !prev.isMagnifierKeyDown) start();
    });

    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('blur', stop);
    const redispatched = ['mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'wheel'] as const;
    redispatched.forEach((t) => window.addEventListener(t, redispatch as EventListener, true));

    return () => {
      stop();
      unsubscribe();
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('blur', stop);
      redispatched.forEach((t) => window.removeEventListener(t, redispatch as EventListener, true));
    };
  }, [containerRef]);
}
