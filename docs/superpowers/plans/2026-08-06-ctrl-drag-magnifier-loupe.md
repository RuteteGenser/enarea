# CTRL-drag Magnifier Loupe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While holding CTRL during a vertex drag (select tool) or new-point placement (line/rectangle/polygon draw tools), show a small circular loupe near the cursor that displays a magnified crop of the rendered PDF, with a crosshair marking the exact target point.

**Architecture:** A new ephemeral `magnifierScreenPos` field on the existing `viewportStore` (same pattern as `isSpaceDown`/`isShiftDown`) is set by the two tool hooks whenever CTRL is held during their respective mouse-move handling, and cleared on release/drag-end/tool-change. A new `MagnifierLoupe` component subscribes to that field and, when set, draws a magnified `drawImage` crop of the main PDF canvas into its own small canvas, positioned near (but offset from) the cursor. The screen↔canvas coordinate math is extracted into pure, unit-tested functions.

**Tech Stack:** React 19, TypeScript, Zustand, native Canvas 2D API (`drawImage`), Vitest.

## Global Constraints

- Loupe diameter: 150px. Magnification: 3x the current PDF zoom.
- Loupe offset from cursor: 24px up, 24px right (never centered directly on the cursor).
- Loupe shows PDF raster content only — no annotation/snap overlays composited in (out of scope for this version, see spec).
- Follow existing codebase conventions: pure logic in `src/lib/*.ts` with Vitest tests mirroring `src/lib/roomDetection.ts`'s style; ephemeral UI flags live on `viewportStore` and are read via `useViewportStore.getState()` inside non-React event handlers, exactly like `isSpaceDown`/`isShiftDown` already are.

---

### Task 1: Add `magnifierScreenPos` state to `viewportStore`

**Files:**
- Modify: `src/store/viewportStore.ts`

**Interfaces:**
- Produces: `magnifierScreenPos: { x: number; y: number } | null` (store field), `setMagnifierScreenPos: (pos: { x: number; y: number } | null) => void` (store action). Both consumed by Tasks 3, 4, and 5.

This is a plain state addition with no branching logic (mirrors the existing untested `isSpaceDown`/`isShiftDown` fields in this same store) — no dedicated unit test, consistent with how those fields are handled today.

- [ ] **Step 1: Add the field and setter to the store**

In `src/store/viewportStore.ts`, add to the `ViewportStore` type (after `isShiftDown: boolean;` on line 17):

```ts
  isShiftDown: boolean;
  magnifierScreenPos: { x: number; y: number } | null;
```

Add to the type's action signatures (after `setShiftDown: (down: boolean) => void;` on line 29):

```ts
  setShiftDown: (down: boolean) => void;
  setMagnifierScreenPos: (pos: { x: number; y: number } | null) => void;
```

Add to the store's initial state (after `isShiftDown: false,` on line 42):

```ts
  isShiftDown: false,
  magnifierScreenPos: null,
```

Add to the store's actions (after `setShiftDown: (down) => set({ isShiftDown: down }),` on line 60):

```ts
  setShiftDown: (down) => set({ isShiftDown: down }),
  setMagnifierScreenPos: (pos) => set({ magnifierScreenPos: pos }),
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/viewportStore.ts
git commit -m "Add magnifierScreenPos ephemeral state to viewportStore"
```

---

### Task 2: Pure coordinate-mapping functions for the loupe

**Files:**
- Create: `src/lib/magnifier.ts`
- Test: `src/lib/magnifier.test.ts`

**Interfaces:**
- Consumes: nothing (pure functions, no dependency on Tasks 1/3/4).
- Produces:
  - `computeMagnifierCrop(screenPos: {x,y}, canvasRect: {left,top,width,height}, canvasPixelWidth: number, canvasPixelHeight: number, loupeSize: number, magnification: number): { sx: number; sy: number; sSize: number }`
  - `computeLoupePosition(screenPos: {x,y}, loupeSize: number, offsetX: number, offsetY: number, viewportWidth: number, viewportHeight: number): { left: number; top: number }`
  - Both consumed by Task 5's `MagnifierLoupe.tsx`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/magnifier.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { computeLoupePosition, computeMagnifierCrop } from '@/lib/magnifier';

describe('computeMagnifierCrop', () => {
  it('centers the crop on the cursor when canvas pixels match CSS pixels 1:1', () => {
    const screenPos = { x: 150, y: 100 };
    const canvasRect = { left: 50, top: 50, width: 400, height: 300 };
    // Cursor is at canvas-local CSS point (100, 50).
    const crop = computeMagnifierCrop(screenPos, canvasRect, 400, 300, 150, 3);
    // cssCropSize = 150 / 3 = 50; scale = 1 (400/400); sSize = 50.
    expect(crop.sSize).toBeCloseTo(50, 5);
    expect(crop.sx).toBeCloseTo(100 - 25, 5); // canvasX - sSize/2
    expect(crop.sy).toBeCloseTo(50 - 25, 5);
  });

  it('scales the crop size when the canvas backing store is higher-resolution than its CSS size', () => {
    const screenPos = { x: 100, y: 100 };
    const canvasRect = { left: 0, top: 0, width: 400, height: 300 };
    // Backing store is 2x CSS size (e.g. supersampled render).
    const crop = computeMagnifierCrop(screenPos, canvasRect, 800, 600, 150, 3);
    // scale = 800/400 = 2; cssCropSize = 50; sSize = 50 * 2 = 100.
    expect(crop.sSize).toBeCloseTo(100, 5);
    // canvasX = (100-0)*2 = 200; sx = 200 - 100/2 = 150.
    expect(crop.sx).toBeCloseTo(150, 5);
    expect(crop.sy).toBeCloseTo(150, 5);
  });
});

describe('computeLoupePosition', () => {
  it('offsets the loupe up and to the right of the cursor when there is room', () => {
    const pos = computeLoupePosition({ x: 500, y: 500 }, 150, 24, 24, 1920, 1080);
    // left = 500 + 24 = 524; top = 500 - 24 - 150 = 326.
    expect(pos.left).toBeCloseTo(524, 5);
    expect(pos.top).toBeCloseTo(326, 5);
  });

  it('clamps to stay on-screen near the top-left corner', () => {
    const pos = computeLoupePosition({ x: 5, y: 5 }, 150, 24, 24, 1920, 1080);
    expect(pos.left).toBeGreaterThanOrEqual(0);
    expect(pos.top).toBeGreaterThanOrEqual(0);
  });

  it('clamps to stay on-screen near the bottom-right corner', () => {
    const pos = computeLoupePosition({ x: 1918, y: 1078 }, 150, 24, 24, 1920, 1080);
    expect(pos.left).toBeLessThanOrEqual(1920 - 150);
    expect(pos.top).toBeLessThanOrEqual(1080 - 150);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/lib/magnifier.test.ts`
Expected: FAIL — `Cannot find module '@/lib/magnifier'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

Create `src/lib/magnifier.ts`:

```ts
type ScreenPoint = { x: number; y: number };
type Rect = { left: number; top: number; width: number; height: number };

/**
 * Maps a viewport (client) point into a square source crop on the main PDF
 * canvas's own backing-store pixel space, sized so that `loupeSize / magnification`
 * CSS pixels of content fill the full loupe. Reads the canvas's actual
 * getBoundingClientRect() vs its width/height (backing-store pixel count) to
 * derive the scale factor, so this is correct regardless of devicePixelRatio
 * or any supersampled render resolution — same principle RoomDetectionOverlay
 * already uses for its own screen-to-canvas mapping.
 */
export function computeMagnifierCrop(
  screenPos: ScreenPoint,
  canvasRect: Rect,
  canvasPixelWidth: number,
  canvasPixelHeight: number,
  loupeSize: number,
  magnification: number,
): { sx: number; sy: number; sSize: number } {
  const scaleX = canvasPixelWidth / canvasRect.width;
  const scaleY = canvasPixelHeight / canvasRect.height;
  const canvasX = (screenPos.x - canvasRect.left) * scaleX;
  const canvasY = (screenPos.y - canvasRect.top) * scaleY;

  const cssCropSize = loupeSize / magnification;
  const sSize = cssCropSize * scaleX;

  return { sx: canvasX - sSize / 2, sy: canvasY - sSize / 2, sSize };
}

/**
 * Positions the loupe offset up-and-right of the cursor, clamped so it never
 * renders off-screen near a viewport edge.
 */
export function computeLoupePosition(
  screenPos: ScreenPoint,
  loupeSize: number,
  offsetX: number,
  offsetY: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  const desiredLeft = screenPos.x + offsetX;
  const desiredTop = screenPos.y - offsetY - loupeSize;

  const left = Math.min(Math.max(desiredLeft, 0), Math.max(0, viewportWidth - loupeSize));
  const top = Math.min(Math.max(desiredTop, 0), Math.max(0, viewportHeight - loupeSize));

  return { left, top };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/magnifier.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and run the full suite**

Run: `npx tsc -b && npx vitest run`
Expected: no errors; all test files pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/magnifier.ts src/lib/magnifier.test.ts
git commit -m "Add pure coordinate-mapping functions for the magnifier loupe"
```

---

### Task 3: Wire magnifier position into `useSelectTool` vertex drag

**Files:**
- Modify: `src/components/tools/useSelectTool.ts`

**Interfaces:**
- Consumes: `useViewportStore.getState().setMagnifierScreenPos` (Task 1).
- Produces: no new exports — behavioral change only to the existing `onMove`/`reset` internals.

- [ ] **Step 1: Set the magnifier position on every drag-move while CTRL is held**

In `src/components/tools/useSelectTool.ts`, inside the `onMove` function (starts at line 65), add the position update as the first line of the function body:

```ts
    function onMove(e: MouseEvent) {
      const current = dragRef.current;
      if (!current) return;
      useViewportStore.getState().setMagnifierScreenPos(
        e.ctrlKey ? { x: e.clientX, y: e.clientY } : null,
      );
      const cursorPdf = clientToPdf(e.clientX, e.clientY);
```

- [ ] **Step 2: Clear it whenever the drag ends**

In the same file, inside `reset()` (starts at line 87), add the clear call:

```ts
    function reset() {
      dragRef.current = null;
      setDrag(null);
      livePointsRef.current = null;
      setLivePoints(null);
      useViewportStore.getState().setMagnifierScreenPos(null);
    }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors (`useViewportStore` is already imported in this file).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open a project with a calibrated file, draw a shape, select it, then mouse-down on one of its corner handles and drag while holding CTRL.
Expected: no crash; this task alone won't show the loupe yet (Task 5 renders it) but sets up the state — verify no console errors while dragging with CTRL held and released repeatedly.

- [ ] **Step 5: Commit**

```bash
git add src/components/tools/useSelectTool.ts
git commit -m "Track magnifier screen position during CTRL+vertex drag"
```

---

### Task 4: Wire magnifier position into `useDrawTool` point placement

**Files:**
- Modify: `src/components/tools/useDrawTool.ts`

**Interfaces:**
- Consumes: `useViewportStore.getState().setMagnifierScreenPos` (Task 1).
- Produces: no new exports — behavioral change only to the existing `onMouseMove`/`resetDrawing` internals.

- [ ] **Step 1: Set the magnifier position on every mouse move while drawing and CTRL is held**

In `src/components/tools/useDrawTool.ts`, replace the `onMouseMove` function (lines 87-90):

```ts
  function onMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!isDrawTool || useViewportStore.getState().isSpaceDown) return;
    setCursor(resolvePoint(e, getReferencePoint()));
  }
```

with:

```ts
  function onMouseMove(e: ReactMouseEvent<SVGSVGElement>) {
    if (!isDrawTool || useViewportStore.getState().isSpaceDown) return;
    useViewportStore.getState().setMagnifierScreenPos(
      e.ctrlKey ? { x: e.clientX, y: e.clientY } : null,
    );
    setCursor(resolvePoint(e, getReferencePoint()));
  }
```

- [ ] **Step 2: Clear it whenever drawing resets**

In the same file, inside `resetDrawing` (lines 40-46), add the clear call:

```ts
  const resetDrawing = () => {
    pointsRef.current = [];
    setPoints([]);
    setDragStart(null);
    setCursor(null);
    setSnapped(null);
    useViewportStore.getState().setMagnifierScreenPos(null);
  };
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors (`useViewportStore` is already imported in this file).

- [ ] **Step 4: Manual verification**

Run `npm run dev`, open a calibrated file, select the line, rectangle, or polygon tool, and move the mouse over the canvas while holding CTRL.
Expected: no crash; state updates but nothing renders yet (Task 5 renders it).

- [ ] **Step 5: Commit**

```bash
git add src/components/tools/useDrawTool.ts
git commit -m "Track magnifier screen position while placing new points with CTRL held"
```

---

### Task 5: Build and wire up `MagnifierLoupe`

**Files:**
- Create: `src/components/viewer/MagnifierLoupe.tsx`
- Modify: `src/components/viewer/PdfCanvas.tsx`

**Interfaces:**
- Consumes: `magnifierScreenPos` (Task 1, via `useViewportStore`), `computeMagnifierCrop`/`computeLoupePosition` (Task 2), `canvasRef: RefObject<HTMLCanvasElement | null>` (passed as a prop, same as `RoomDetectionOverlay` already receives).
- Produces: `MagnifierLoupe` default export, a React component taking `{ canvasRef }`.

- [ ] **Step 1: Create the component**

Create `src/components/viewer/MagnifierLoupe.tsx`:

```tsx
import { useEffect, useRef, type RefObject } from 'react';
import { computeLoupePosition, computeMagnifierCrop } from '@/lib/magnifier';
import { useViewportStore } from '@/store/viewportStore';

const LOUPE_SIZE = 150;
const MAGNIFICATION = 3;
const OFFSET = 24;

type MagnifierLoupeProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export default function MagnifierLoupe({ canvasRef }: MagnifierLoupeProps) {
  const screenPos = useViewportStore((s) => s.magnifierScreenPos);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!screenPos) return;
    const mainCanvas = canvasRef.current;
    const loupeCanvas = loupeCanvasRef.current;
    if (!mainCanvas || !loupeCanvas) return;
    const ctx = loupeCanvas.getContext('2d');
    if (!ctx) return;

    const canvasRect = mainCanvas.getBoundingClientRect();
    const { sx, sy, sSize } = computeMagnifierCrop(
      screenPos,
      canvasRect,
      mainCanvas.width,
      mainCanvas.height,
      LOUPE_SIZE,
      MAGNIFICATION,
    );

    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.drawImage(mainCanvas, sx, sy, sSize, sSize, 0, 0, LOUPE_SIZE, LOUPE_SIZE);

    const center = LOUPE_SIZE / 2;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center - 8, center);
    ctx.lineTo(center + 8, center);
    ctx.moveTo(center, center - 8);
    ctx.lineTo(center, center + 8);
    ctx.stroke();
  }, [screenPos, canvasRef]);

  if (!screenPos) return null;

  const { left, top } = computeLoupePosition(
    screenPos,
    LOUPE_SIZE,
    OFFSET,
    OFFSET,
    window.innerWidth,
    window.innerHeight,
  );

  return (
    <canvas
      ref={loupeCanvasRef}
      width={LOUPE_SIZE}
      height={LOUPE_SIZE}
      className="pointer-events-none fixed z-50 rounded-full shadow-lg ring-2 ring-border"
      style={{ left, top }}
    />
  );
}
```

- [ ] **Step 2: Render it in `PdfCanvas.tsx`**

In `src/components/viewer/PdfCanvas.tsx`, add the import (after the `CompassWidget` import on line 7):

```tsx
import CompassWidget from '@/components/viewer/CompassWidget';
import MagnifierLoupe from '@/components/viewer/MagnifierLoupe';
```

Add the render call after the `CompassWidget` line (line 303):

```tsx
      {status === 'ready' && showScaleBar && <ScaleBar zoom={zoom} calibration={file.calibration} />}
      {status === 'ready' && showCompass && <CompassWidget />}
      {status === 'ready' && <MagnifierLoupe canvasRef={canvasRef} />}
```

(No visibility toggle needed here — `MagnifierLoupe` already renders `null` internally whenever `magnifierScreenPos` is unset, so it's inert until a CTRL-drag is active.)

- [ ] **Step 3: Typecheck and run the full suite**

Run: `npx tsc -b && npx vitest run`
Expected: no errors; all test files pass.

- [ ] **Step 4: Manual verification — vertex drag**

Run `npm run dev`, open a calibrated file with an existing shape, select it, mouse-down on a corner handle, and drag while holding CTRL.
Expected: a ~150px circular loupe appears offset up-right of the cursor, showing a 3x-magnified crop of the PDF with a small red crosshair at its exact center. Releasing CTRL (while still dragging) makes it disappear; re-holding CTRL brings it back. Releasing the mouse button ends the drag and the loupe disappears.

- [ ] **Step 5: Manual verification — new point placement**

With the line, rectangle, or polygon tool active, move the mouse over the canvas while holding CTRL.
Expected: same loupe behavior while CTRL is held and the tool is active; disappears when CTRL is released, Escape is pressed, or the tool is switched.

- [ ] **Step 6: Manual verification — edge clamping**

Repeat the CTRL-drag near the top-left and bottom-right corners of the browser window.
Expected: the loupe stays fully visible on-screen (clamped), never rendering partially off-window.

- [ ] **Step 7: Commit**

```bash
git add src/components/viewer/MagnifierLoupe.tsx src/components/viewer/PdfCanvas.tsx
git commit -m "Add CTRL-drag magnifier loupe for precise point placement"
```

---

## Self-Review Notes

- **Spec coverage:** content=PDF raster (Task 5's `drawImage` from the main canvas) ✓; trigger on both select-tool vertex drag (Task 3) and draw-tool point placement (Task 4) ✓; offset positioning up-right with clamping (Task 2 `computeLoupePosition` + Task 5) ✓; 150px/3x sizing (Task 5 constants) ✓; crosshair (Task 5) ✓; DPR/supersampling-safe coordinate mapping (Task 2 `computeMagnifierCrop`, tested in Task 2 Step 1's second test case) ✓.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact manual-test procedure.
- **Type consistency:** `setMagnifierScreenPos(pos: { x: number; y: number } | null)` (Task 1) is called identically in Tasks 3, 4, and read as `magnifierScreenPos` in Task 5 — same shape throughout. `computeMagnifierCrop`/`computeLoupePosition` signatures in Task 2 match their call sites in Task 5 exactly.
