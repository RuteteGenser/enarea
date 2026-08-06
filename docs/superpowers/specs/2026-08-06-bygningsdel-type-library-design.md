# Bygningsdel type library

## Context

This is the first increment of a larger roadmap (see
`docs/notat-bygningsdel-simien.md`) to make Enarea a bindeledd (bridge)
between PDF floor-plan markup and the Simien energy-calculation program.
The full roadmap covers a Bygningsdel type library, a generalized
annotation-edit tool with wall/floor-type picker menus, compass-direction
inheritance, and eventual Simien export — these are independent
subsystems, and this spec covers only the first: **letting the user define
and manage a reusable library of building-component types** (e.g.
"Yttervegg type 1", "Vindu type A"), each carrying the properties Simien
will eventually need (starting with U-verdi and, for walls, veggtykkelse).

This increment does **not** wire types into annotations/edges yet (that's
the generalized edit-tool phase) — it only builds the library itself: the
data model, storage, and a management UI to create/edit/delete types.

## Requirements (confirmed via brainstorming)

- **Scope**: the library is global — shared across all projects, not
  scoped to a single project. A type defined once (e.g. "Yttervegg type 1")
  is available everywhere.
- **Categories**: each type belongs to one of six fixed categories:
  Yttervegg, Vindu, Ytterdør, Tak, Gulv, Dekke. A user can create any
  number of named types within each category (e.g. "Yttervegg type 1",
  "Yttervegg type 2" both under the Yttervegg category).
- **Properties**: every type has a required `uValue` (U-verdi, W/m²K).
  Types in the Yttervegg category additionally have a required
  `wallThickness` (veggtykkelse, mm). No other properties (e.g.
  kuldebroverdi) are part of this increment — the notes describe
  kuldebroverdi as belonging to a separate future "kuldebrotype"
  (junction-type) concept, not the building-component type itself.
- **UI**: a dedicated page at a new route, reached via a button on the
  project-list screen (since the library isn't tied to any one project).
  Types are grouped by their fixed category, editable inline in a list —
  not wired into the PDF canvas/annotation tools in this increment.

## Architecture

### Data model — `src/types/index.ts`

```ts
export type BuildingComponentCategory = 'yttervegg' | 'vindu' | 'ytterdor' | 'tak' | 'gulv' | 'dekke';

export type BuildingComponentType = {
  id: string;
  category: BuildingComponentCategory;
  name: string;
  uValue: number;           // W/m²K — required for every category
  wallThickness?: number;   // mm — present only when category === 'yttervegg'
  createdAt: number;
  updatedAt: number;
};
```

### Storage — `src/lib/db.ts`

Follows the existing `idb`-based repo pattern used by `projects`/`files`/
`annotations` exactly:

- Bump `openDB('enarea', ...)` to schema version 2.
- Add an `upgrade` branch creating a new object store:
  `db.createObjectStore('buildingComponentTypes', { keyPath: 'id' })` — no
  project-scoping index, since the library is global.
- Add `buildingComponentTypes: { key: string; value: BuildingComponentType }`
  to the `EnareaDB` schema interface.
- Export `buildingComponentTypesRepo` with the same `list`/`get`/`put`/
  `remove` shape as `projectsRepo`/`filesRepo`/`annotationsRepo`. No
  cascading deletes needed (nothing currently references a type by id yet
  — that wiring is a later increment).

### Store — new `src/store/buildingComponentTypeStore.ts`

Mirrors `projectStore.ts`'s shape and conventions:

```ts
type BuildingComponentTypeStore = {
  types: BuildingComponentType[];
  loaded: boolean;
  loadTypes: () => Promise<void>;
  createType: (category: BuildingComponentCategory, name: string, uValue: number, wallThickness?: number) => Promise<void>;
  updateType: (id: string, patch: Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>) => Promise<void>;
  deleteType: (id: string) => Promise<void>;
};
```

Every mutating action follows the existing pattern: build/derive the
updated object, `await buildingComponentTypesRepo.put(updated)`, then
`set()` to sync the in-memory array — identical to
`projectStore.updateNorthDirection`.

### UI

**Entry point** — `src/routes/ProjectList.tsx`: a new "Bygningsdeltyper"
button in the header, next to "Nytt prosjekt", navigating to a new route.

**Routing** — `src/App.tsx`: a new lazy route,
`<Route path="/bygningsdeltyper" element={<BuildingComponentTypes />} />`,
alongside the existing `/` and `/project/:projectId` routes.

**Page** — new `src/routes/BuildingComponentTypes.tsx`, structured like
`ProjectList.tsx` (header with back button + title, content area below):
six always-visible category sections (Yttervegg, Vindu, Ytterdør, Tak,
Gulv, Dekke), each rendering its types as inline-editable rows plus an
"add type" affordance. Categories with no types yet still show their
heading and an empty state, so it's obvious all six exist and invites
adding the first type.

**Row component** — new `src/components/buildingComponentTypes/
BuildingComponentTypeRow.tsx`, modeled directly on
`MeasurementRow.tsx`'s inline-edit pattern (confirmed by reading that
file): double-click a field to edit, `Input` with `autoFocus`, commit on
blur or Enter, Escape reverts the draft and exits edit mode without
committing. Applied per-field:
- Name: text input, commits only if non-empty (same guard as
  `MeasurementRow.commitRename`).
- U-verdi: numeric input, commits only if the parsed value is a finite
  positive number, otherwise reverts to the last valid value.
- Veggtykkelse (Yttervegg rows only): same numeric validation as U-verdi.

A delete button per row opens the existing `ConfirmDialog` (same component
`ProjectList.tsx` already uses for project deletion).

**Add-type control** — per category section, a small form/row (name input
already scoped to that category, so the user doesn't pick a category —
it's implied by which section they're adding to) with the same required-
field validation as above gating the "create" action; only commits (calls
`createType`) when all required fields for that category are valid.

## Files touched

- `src/types/index.ts` — `BuildingComponentCategory`, `BuildingComponentType`
- `src/lib/db.ts` — schema v2, `buildingComponentTypes` store,
  `buildingComponentTypesRepo`
- `src/store/buildingComponentTypeStore.ts` — new
- `src/App.tsx` — new `/bygningsdeltyper` route
- `src/routes/ProjectList.tsx` — new header button
- `src/routes/BuildingComponentTypes.tsx` — new
- `src/components/buildingComponentTypes/BuildingComponentTypeRow.tsx` — new

## Out of scope for this increment

- Wiring types into `EdgeMeta`/annotations (the generalized edit-tool
  phase from the notes).
- Kuldebroverdi/Ψ-verdi (described in the notes as a separate future
  "kuldebrotype" concept).
- Compass-direction inheritance.
- Any Simien export.

## Verification

1. `npx tsc -b` and `npx vitest run` — must stay clean/passing.
2. Manual: navigate to `/bygningsdeltyper` from the project list, create a
   type in each of the 6 categories (confirming Yttervegg requires and
   shows veggtykkelse, the other 5 don't), edit a type's name/U-verdi
   inline, delete a type with confirmation, and confirm the library
   persists across a page reload (IndexedDB).
