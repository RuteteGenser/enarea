import { useEffect, type RefObject } from 'react';
import { useViewportStore } from '@/store/viewportStore';

/** Fraction of the real mouse speed the virtual cursor moves at while F is held. */
const SPEED = 0.3;
/** F must be held this long before the cursor locks, so a quick tap just shows the loupe. */
const ENGAGE_DELAY_MS = 120;
const CROSS_SIZE = 18;

/**
 * Slows the cursor while F is held (the magnifier is showing) for precise placement.
 * A page can't change the OS cursor speed, so this locks the pointer to the container,
 * draws a virtual crosshair that moves at a fraction of the real movement, and re-dispatches
 * the mouse events at the crosshair's position — tools and handlers just see normal events.
 */
export function useSlowCursor(containerRef: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof container.requestPointerLock !== 'function') return;
    const el: HTMLElement = container;

    let last: { x: number; y: number } | null = null;
    const virtual = { x: 0, y: 0 };
    let locked = false;
    let engageTimer: number | null = null;
    let cross: HTMLDivElement | null = null;

    function trackMouse(e: MouseEvent) {
      if (!locked) last = { x: e.clientX, y: e.clientY };
    }
    function forgetMouse() {
      if (!locked) last = null;
    }

    function createCross() {
      const c = document.createElement('div');
      c.style.cssText = `position:fixed;left:0;top:0;z-index:60;pointer-events:none;width:${CROSS_SIZE}px;height:${CROSS_SIZE}px;margin:${-CROSS_SIZE / 2}px 0 0 ${-CROSS_SIZE / 2}px;`;
      const line = 'position:absolute;background:#e11d48;box-shadow:0 0 0 1px rgba(255,255,255,.8);';
      c.innerHTML = `<div style="${line}left:50%;top:0;width:1px;height:100%"></div><div style="${line}top:50%;left:0;height:1px;width:100%"></div>`;
      document.body.appendChild(c);
      return c;
    }
    function moveCross() {
      if (cross) cross.style.transform = `translate(${virtual.x}px, ${virtual.y}px)`;
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

    function onMove(e: MouseEvent) {
      // isTrusted: skip the events we dispatch ourselves, or they'd be re-dispatched forever.
      if (!locked || !e.isTrusted) return;
      e.stopImmediatePropagation();
      const rect = el.getBoundingClientRect();
      virtual.x = Math.min(rect.right - 1, Math.max(rect.left, virtual.x + e.movementX * SPEED));
      virtual.y = Math.min(rect.bottom - 1, Math.max(rect.top, virtual.y + e.movementY * SPEED));
      moveCross();
      dispatchAtVirtual('mousemove', e);
    }
    function redispatch(e: MouseEvent) {
      if (!locked || !e.isTrusted) return;
      e.stopImmediatePropagation();
      e.preventDefault();
      dispatchAtVirtual(e.type, e);
    }

    function lock() {
      if (!last || locked) return;
      virtual.x = last.x;
      virtual.y = last.y;
      el.requestPointerLock();
    }
    function onLockChange() {
      const nowLocked = document.pointerLockElement === el;
      if (nowLocked === locked) return;
      locked = nowLocked;
      if (locked) {
        cross = createCross();
        moveCross();
      } else {
        cross?.remove();
        cross = null;
      }
    }
    function release() {
      if (engageTimer !== null) window.clearTimeout(engageTimer);
      engageTimer = null;
      if (document.pointerLockElement === el) document.exitPointerLock();
    }

    // Follows the F key (held = magnifier on): lock shortly after pressing, release when let go.
    const unsubscribe = useViewportStore.subscribe((state, prev) => {
      if (state.isMagnifierKeyDown === prev.isMagnifierKeyDown) return;
      if (state.isMagnifierKeyDown) {
        if (engageTimer !== null || locked) return;
        engageTimer = window.setTimeout(() => {
          engageTimer = null;
          lock();
        }, ENGAGE_DELAY_MS);
      } else {
        release();
      }
    });

    el.addEventListener('mousemove', trackMouse);
    el.addEventListener('mouseleave', forgetMouse);
    document.addEventListener('pointerlockchange', onLockChange);
    window.addEventListener('blur', release);
    // Capture phase: runs before React's handlers so the real (frozen-position) events can be swapped for ours.
    window.addEventListener('mousemove', onMove, true);
    const redispatched = ['mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'wheel'] as const;
    redispatched.forEach((t) => window.addEventListener(t, redispatch as EventListener, true));

    return () => {
      release();
      cross?.remove();
      el.removeEventListener('mousemove', trackMouse);
      el.removeEventListener('mouseleave', forgetMouse);
      document.removeEventListener('pointerlockchange', onLockChange);
      unsubscribe();
      window.removeEventListener('blur', release);
      window.removeEventListener('mousemove', onMove, true);
      redispatched.forEach((t) => window.removeEventListener(t, redispatch as EventListener, true));
    };
  }, [containerRef]);
}
