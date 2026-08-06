# Material-picker tool (Bygningsdel type assignment)

## Context

This is the second increment of the Bygningsdel/Simien roadmap (see
`docs/notat-bygningsdel-simien.md`), following the global type library
built in the first increment (`docs/superpowers/specs/2026-08-06-bygningsdel-type-library-design.md`).
That library is a template/catalog with no way yet to say which type
applies to a given wall or floor area in an actual project drawing. This
spec adds that missing link: a dedicated tool for assigning a Bygningsdel
type to specific walls (edges) and areas (whole polygon/rectangle
annotations) on the canvas.

Windows and doors are explicitly out of scope — the user is still
undecided how those should be marked on the canvas, and there's currently
no annotation concept for them to attach to.

## Requirements (confirmed via brainstorming)

- **Snapshot, not reference**: assigning a type to a wall/area copies that
  type's current values onto the wall/area independently. Later edits to
  the library type do not retroactively change anything already assigned.
- **Picker source**: the picker lists types straight from the global
  library, filtered by the relevant category/categories — no project-level
  curation/shortlist step in this increment.
- **New, separate tool**: a new tool, independent of the existing "wall"
  tool (external/internal + N/S/E/W compass orientation, still needed for
  the compass-direction roadmap item). Both tools coexist.
- **Two click targets, one tool**: with the tool active, clicking a wall
  edge opens a picker of Yttervegg types; clicking inside an area (a whole
  polygon/rectangle annotation) opens a picker of Gulv + Dekke types
  together, grouped by category.
- **Quick-add**: the picker includes an inline "+ Legg til type" mini-form
  (name, U-verdi, and veggtykkelse when adding a Yttervegg type) that
  creates the type in the global library and assigns it in one step.
- **Hover feedback**: while the tool is active, hovering an edge/area shows
  its currently assigned type's name (or "Ingen type"), mirroring the
  existing wall tool's hover badge. No persistent visual marker is added
  elsewhere (measurement panel, etc.) in this increment.

## Architecture

### Data model — `src/types/index.ts`

A shared snapshot shape, reused for both edges and whole annotations:

```ts
export type BuildingComponentAssignment = {
  typeId: string; // originating library type id — provenance/display only, never re-read live
  category: BuildingComponentCategory;
  name: string;
  uValue: number;
  wallThickness?: number; // present only when category === 'yttervegg'
};
```

- `EdgeMeta` gains `buildingComponent?: BuildingComponentAssignment`.
- `Annotation` gains `buildingComponent?: BuildingComponentAssignment`.

No store changes are needed: `annotationStore.setEdgeMeta(id, edgeIndex, meta)`
already shallow-merges into `EdgeMeta`, and `updateAnnotation(id, patch)`
already shallow-merges into `Annotation` — the same actions the existing
wall tool and general annotation editing already use.

### Tool — new `'material'` `ToolId`

- Toolbar: a new `ToolButton` (icon `Palette`, label "Materialvelger",
  shortcut `M` — unused today), positioned next to the existing "wall"
  tool button. Not gated on calibration (`disabled={!calibrated}`) since
  no measurement is involved, unlike the draw/wall/detect tools.
- `useKeyboardShortcuts.ts`: add `m: 'material'` to `TOOL_KEYS`.
- `PdfCanvas.tsx`: mount `{tool === 'material' && <MaterialPickerOverlay ... />}`
  alongside the existing `{tool === 'wall' && <WallToolOverlay ... />}` block.

### `MaterialPickerOverlay.tsx` (new)

Modeled directly on `WallToolOverlay.tsx`'s structure (same eligibility
filter: `annotation.type !== 'line' && a.visible && !a.locked`), but with
two layered hit-target types per eligible annotation, matching the paint
order `ShapeRenderer`/`SelectionHandles` already use (fill drawn first,
edges layered on top so edge clicks win over fill clicks):

1. **Area fill hit-target**: one `<polygon>` per eligible annotation,
   `pointerEvents="all"`, wrapped in a `BuildingComponentPicker` scoped to
   `categories={['gulv', 'dekke']}`. On select, calls
   `updateAnnotation(annotation.id, { buildingComponent: assignment })`.
2. **Edge hit-targets**: one 14px-wide transparent hit-`<line>` per edge
   (identical geometry to `WallToolOverlay`'s), each wrapped in a
   `BuildingComponentPicker` scoped to `categories={['yttervegg']}`. On
   select, calls `setEdgeMeta(annotation.id, edgeIndex, { buildingComponent: assignment })`.

Hover state (per edge or per annotation) drives a small label at the edge
midpoint / polygon centroid showing `edge.buildingComponent?.name ?? annotation.buildingComponent?.name ?? 'Ingen type'`,
same visual language as `WallToolOverlay`'s existing hover badge (small
circle/pill at the midpoint).

### `BuildingComponentPicker.tsx` (new, reusable)

A controlled Radix `Popover` (not a context menu — this is the tool's
primary **left-click** interaction, unlike `EdgeContextMenu`'s right-click
wall/orientation toggle). `PopoverTrigger asChild` wraps the SVG hit-target
(edge `<line>` or area `<polygon>`) — the same `asChild`-wraps-an-SVG-`<g>`
technique `EdgeContextMenu`'s `ContextMenuTrigger` already uses successfully
in this codebase.

```ts
type BuildingComponentPickerProps = {
  categories: BuildingComponentCategory[];
  current?: BuildingComponentAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assignment: BuildingComponentAssignment | null) => void; // null clears
  children: React.ReactNode; // the SVG hit-target, passed to PopoverTrigger asChild
};
```

`PopoverContent` renders:
- Types from `useBuildingComponentTypeStore`, filtered to `categories`,
  grouped under a heading per category when `categories.length > 1`
  (matches `/bygningsdeltyper`'s `CategorySection` grouping), each row
  showing name + U-verdi, with a checkmark on `current?.typeId`.
- A "Fjern merking" item when `current` is set, calling `onSelect(null)`.
- An inline quick-add form (name / U-verdi / veggtykkelse-if-yttervegg),
  reusing the exact validation pattern from `CategorySection.tsx`'s
  existing add-type form. On submit: calls
  `useBuildingComponentTypeStore.createType(...)`, then immediately builds
  and passes the resulting type as a `BuildingComponentAssignment` to
  `onSelect`, so quick-add both creates the library type and assigns it in
  one action. When `categories.length > 1`, the quick-add form includes a
  category selector limited to the given `categories`; when there's only
  one category (the edge/wall case), it's implied and hidden.

### Out of scope for this increment

- Windows/doors — no annotation concept to attach a `vindu`/`ytterdor`
  assignment to yet.
- Project-level type curation/shortlist (the picker always reads the full
  global library).
- Any visual indicator of assignment outside the material-picker tool
  itself (e.g. in the measurement panel or exported PDF).
- Re-syncing a snapshot to its source type's current values after editing
  the library type.

## Verification

1. `npx tsc -b` and `npx vitest run` — must stay clean/passing.
2. Manual: activate the material-picker tool, click a wall edge, confirm
   the popover shows only Yttervegg types plus quick-add; pick one and
   confirm it's snapshotted (edit the library type afterward and confirm
   the wall's hover label does **not** change).
3. Manual: click inside a room/area, confirm the popover shows Gulv and
   Dekke types together, grouped by category; assign one; confirm the
   hover label reflects it.
4. Manual: use quick-add from within the picker to create a brand-new
   type — confirm it appears both in `/bygningsdeltyper` afterward and as
   the just-assigned value on the wall/area.
5. Manual: confirm the existing "wall" tool (external/internal + compass
   orientation) still works unchanged, independent of this new tool.
