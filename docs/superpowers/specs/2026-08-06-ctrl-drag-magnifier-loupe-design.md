# CTRL-drag magnifier loupe

## Context

When placing or dragging a point precisely (a vertex on an existing shape,
or a new point while drawing a line/rectangle/polygon), it's hard to see
exactly where the point will land relative to the underlying PDF drawing —
the cursor itself covers the exact spot, and at normal zoom a wall corner
or line can be only a pixel or two wide. The user wants a magnifying-glass
overlay, shown only while holding CTRL during a point drag/placement, that
zooms in on the small area around the cursor (not the whole view) so the
point can be aligned precisely against the drawing underneath.

## Requirements (confirmed via brainstorming)

- **Content**: the loupe shows the actual rendered PDF raster content,
  magnified — not just the vector shape/points being edited. This is what
  makes it useful for aligning to a wall line or corner in the drawing.
- **Trigger**: holding CTRL while dragging an existing vertex (select tool)
  *or* while placing a new point (line/rectangle/polygon draw tools).
  Released the moment CTRL is released, the drag/draw ends, or the tool
  changes.
- **Position**: offset from the cursor (up-right), not centered directly on
  it and not fixed in a screen corner — so the loupe never covers the exact
  point being placed.
- **Size/magnification**: ~150px diameter circle, ~3x magnification over
  whatever the current PDF zoom already is.
- **Crosshair**: a small "+" drawn at the exact center of the loupe,
  marking the precise point the dragged/placed point will land on.
- **Out of scope for this version**: the loupe shows PDF raster content
  only — no annotation overlays (other shapes' points/edges, snap
  indicators) composited on top. Can be revisited later if needed.

## Architecture

### Shared state: `viewportStore.ts`

Add ephemeral UI state, following the existing `isSpaceDown`/`isShiftDown`
pattern in this same store:

```ts
magnifierScreenPos: { x: number; y: number } | null;
setMagnifierScreenPos: (pos: { x: number; y: number } | null) => void;
```

This was chosen over threading an explicit callback prop through
`PdfCanvas.tsx` → `AnnotationLayer.tsx` → the tool hooks, since both
`useSelectTool.ts` and `useDrawTool.ts` already read viewport flags
(`isSpaceDown`, `isShiftDown`) directly from this same store via
`useViewportStore.getState()`, and adding one more ephemeral flag there is
far less invasive than new prop plumbing across multiple component layers.

### Setting the position

- **`useSelectTool.ts`**, inside the existing `onMove` handler (the
  `window.addEventListener('mousemove', onMove)` callback used during a
  vertex drag): call
  `useViewportStore.getState().setMagnifierScreenPos(e.ctrlKey ? { x: e.clientX, y: e.clientY } : null)`
  each time it fires. Cleared in the existing `finishDrag`/`reset` paths
  (drag ends, Escape, tool change) the same way `dragRef`/`livePoints` are
  already reset.
- **`useDrawTool.ts`**, inside `onMouseMove` (tracks the draw-preview
  cursor for line/rectangle/polygon): same pattern — set from `e.ctrlKey`
  on every move while `isDrawTool` is true, cleared in the existing
  `resetDrawing()` (already called on Escape, tool change, and shape
  completion).

Both call sites already have direct access to the native/React mouse
event's `ctrlKey`, `clientX`, `clientY` — no new event plumbing needed,
just reading fields already available where the cursor position is
computed today.

### Rendering: new `MagnifierLoupe.tsx`

Rendered in `PdfCanvas.tsx` as a sibling to `ScaleBar`/`CompassWidget`
(same "fixed overlay positioned over the canvas area" pattern), receiving
`canvasRef` as a prop exactly like `RoomDetectionOverlay` already does.

- Subscribes to `magnifierScreenPos` from `viewportStore`; renders nothing
  when `null`.
- When set, renders a small `<canvas>` (150×150, `border-radius: 50%` via
  CSS or a circular clip) positioned at `magnifierScreenPos` offset 24px up
  and 24px right of the cursor, clamped to stay within the viewport so it
  can't render off-screen near the window edges.
- On each position update, draws the magnified crop via `drawImage`:
  1. Map `magnifierScreenPos` (viewport CSS coordinates) into the main
     canvas's own backing-store pixel space using its actual
     `getBoundingClientRect()` vs `canvas.width`/`canvas.height` ratio —
     this automatically accounts for `devicePixelRatio` and the existing
     `FIT_SUPERSAMPLE` render-resolution floor (`PdfCanvas.tsx`) without
     needing to duplicate that math; same principle `RoomDetectionOverlay.tsx`
     already uses for its own screen→canvas mapping.
  2. Compute a source crop square centered on that point, sized so that
     `150px / 3x magnification` (50 CSS px worth of content) of the source
     maps to the full 150px loupe.
  3. `drawImage(mainCanvas, sx, sy, sSize, sSize, 0, 0, 150, 150)` — a crop
     rect that extends past the source canvas's edges is clipped
     automatically by the Canvas API (draws only the valid portion, leaves
     the rest blank), which is visually correct since that's genuinely
     outside the page.
  4. Draw the "+" crosshair at the loupe's own center (75, 75) — fixed,
     independent of the source crop.

### Pure, testable coordinate mapping

Extract the "viewport point → main-canvas source crop rect" calculation
(step 1–2 above) into a small pure function (mirroring the style of the
standalone helpers in `roomDetection.ts`) so it can be unit tested without
a browser/canvas environment — the actual `drawImage` call and circular
styling are visual-only and verified manually.

### Error handling

- `canvasRef.current` null → render nothing (defensive, same style as
  existing overlay components).
- Source crop partially or fully outside the canvas bounds (cursor near a
  page edge) → handled automatically by `drawImage`'s clipping; no special
  casing needed.

## Files touched

- `src/store/viewportStore.ts` — `magnifierScreenPos` + setter
- `src/components/tools/useSelectTool.ts` — set/clear during vertex drag
- `src/components/tools/useDrawTool.ts` — set/clear during point placement
- `src/components/viewer/MagnifierLoupe.tsx` — new component
- `src/components/viewer/PdfCanvas.tsx` — render `MagnifierLoupe`

## Verification

1. `npx tsc -b` and `npx vitest run` (including new unit tests for the pure
   coordinate-mapping function) — must stay clean/passing.
2. Manual: hold CTRL while dragging an existing vertex — loupe appears
   offset up-right of the cursor, shows magnified PDF content with a
   crosshair at the exact target point, disappears when CTRL is released.
3. Manual: hold CTRL while placing a new point with the line/rectangle/
   polygon tool — same behavior.
4. Manual: loupe stays fully on-screen (clamped) when the cursor is near a
   viewport edge; shows blank appropriately when the crop would extend past
   the page edge.
