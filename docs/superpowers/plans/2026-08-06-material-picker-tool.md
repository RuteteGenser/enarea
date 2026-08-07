# Material-Picker Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new, independent canvas tool that lets the user assign a Bygningsdel type (from the global library) to a wall edge or to a whole floor/area annotation, with an inline quick-add for new types.

**Architecture:** A shared `BuildingComponentAssignment` snapshot type stored on `EdgeMeta` (walls) and `Annotation` (areas). A new `MaterialPickerOverlay` mirrors the existing `WallToolOverlay`'s per-edge hit-target pattern, adding a per-annotation fill hit-target underneath it for areas. Both open a shared, reusable `BuildingComponentPicker` — a controlled Radix `Popover` anchored to the clicked edge/shape, listing types from `useBuildingComponentTypeStore` filtered by category.

**Tech Stack:** React 19, TypeScript, Zustand, Radix Popover (`@/components/ui/popover`), existing `BuildingComponentType`/`useBuildingComponentTypeStore` from the type-library increment.

## Global Constraints

- Assignment is a **snapshot**, not a live reference: picking a type copies its current `name`/`uValue`/`wallThickness` onto the wall/area, keyed by `typeId` for provenance only — never re-read live from the library afterward.
- The picker lists straight from the global library — no project-level curation/shortlist step in this increment.
- This is a **new, separate** tool — the existing "wall" tool (external/internal + N/S/E/W) is untouched and keeps working independently.
- Edge clicks → Yttervegg types only. Area (fill) clicks → Gulv + Dekke types together, grouped by category.
- Windows/doors are out of scope (no annotation concept for them yet).
- **No unit tests for this feature**, per this codebase's established convention (confirmed in the prior increment's plan: zero test files exist for any store or component; only pure `.ts` logic in `src/lib/` is unit-tested). Verified via `npx tsc -b` plus manual browser checks instead.

---

### Task 1: Data model

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/components/buildingComponentTypes/CategorySection.tsx`

**Interfaces:**
- Consumes: `BuildingComponentCategory`, `BuildingComponentType` (existing, from the type-library increment).
- Produces: `BuildingComponentAssignment` (type), `BUILDING_COMPONENT_CATEGORY_LABELS` (const), extended `EdgeMeta`/`Annotation` — all consumed by Task 2.

- [ ] **Step 1: Add the assignment type and a shared category-label map**

In `src/types/index.ts`, add after the existing `BuildingComponentType` definition at the end of the file:

```ts
export type BuildingComponentAssignment = {
  typeId: string; // originating library type id — provenance/display only, never re-read live
  category: BuildingComponentCategory;
  name: string;
  uValue: number;
  wallThickness?: number; // present only when category === 'yttervegg'
};

export const BUILDING_COMPONENT_CATEGORY_LABELS: Record<BuildingComponentCategory, string> = {
  yttervegg: 'Yttervegg',
  vindu: 'Vindu',
  ytterdor: 'Ytterdør',
  tak: 'Tak',
  gulv: 'Gulv',
  dekke: 'Dekke',
};
```

- [ ] **Step 2: Extend `EdgeMeta` and `Annotation` to hold an assignment**

In `src/types/index.ts`, change:

```ts
export type EdgeMeta = {
  wallType?: WallType;
  orientation?: Orientation;
};
```

to:

```ts
export type EdgeMeta = {
  wallType?: WallType;
  orientation?: Orientation;
  buildingComponent?: BuildingComponentAssignment;
};
```

And change the `Annotation` type from:

```ts
export type Annotation = {
  id: string;
  fileId: string;
  type: AnnotationType;
  points: Point[];
  edges?: EdgeMeta[];
  name?: string;
  color: AnnotationColor;
  locked: boolean;
  visible: boolean;
  createdAt: number;
  updatedAt: number;
};
```

to:

```ts
export type Annotation = {
  id: string;
  fileId: string;
  type: AnnotationType;
  points: Point[];
  edges?: EdgeMeta[];
  name?: string;
  color: AnnotationColor;
  locked: boolean;
  visible: boolean;
  buildingComponent?: BuildingComponentAssignment;
  createdAt: number;
  updatedAt: number;
};
```

(Forward-referencing `BuildingComponentAssignment`, defined later in the same file, is valid TypeScript for type aliases — no reordering needed.)

- [ ] **Step 3: Remove the now-duplicate local category-label map**

In `src/components/buildingComponentTypes/CategorySection.tsx`, remove the local `CATEGORY_LABELS` constant and its usages, importing the shared one instead. Change:

```tsx
import type { BuildingComponentCategory, BuildingComponentType } from '@/types';

const CATEGORY_LABELS: Record<BuildingComponentCategory, string> = {
  yttervegg: 'Yttervegg',
  vindu: 'Vindu',
  ytterdor: 'Ytterdør',
  tak: 'Tak',
  gulv: 'Gulv',
  dekke: 'Dekke',
};
```

to:

```tsx
import { BUILDING_COMPONENT_CATEGORY_LABELS } from '@/types';
import type { BuildingComponentCategory, BuildingComponentType } from '@/types';
```

Then replace both occurrences of `CATEGORY_LABELS[category]` in the same file with `BUILDING_COMPONENT_CATEGORY_LABELS[category]`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/components/buildingComponentTypes/CategorySection.tsx
git commit -m "Add BuildingComponentAssignment and extend EdgeMeta/Annotation"
```

---

### Task 2: Picker component, overlay, and tool wiring

**Files:**
- Modify: `src/store/buildingComponentTypeStore.ts`
- Create: `src/components/material/BuildingComponentPicker.tsx`
- Create: `src/components/material/MaterialPickerOverlay.tsx`
- Modify: `src/components/viewer/PdfCanvas.tsx`
- Modify: `src/components/toolbar/Toolbar.tsx`
- Modify: `src/components/tools/useKeyboardShortcuts.ts`

**Interfaces:**
- Consumes: `BuildingComponentAssignment`, `BUILDING_COMPONENT_CATEGORY_LABELS` (Task 1); `useBuildingComponentTypeStore`, `useAnnotationStore` (existing).
- Produces: `BuildingComponentPicker` (default export, props below), `MaterialPickerOverlay` (default export, props `{ zoom: number; width: number; height: number }`) — mounted in `PdfCanvas.tsx`.

- [ ] **Step 1: Make `createType` return the created type**

In `src/store/buildingComponentTypeStore.ts`, change the store type's signature from:

```ts
  createType: (category: BuildingComponentCategory, name: string, uValue: number, wallThickness?: number) => Promise<void>;
```

to:

```ts
  createType: (category: BuildingComponentCategory, name: string, uValue: number, wallThickness?: number) => Promise<BuildingComponentType>;
```

And change the implementation from:

```ts
  createType: async (category, name, uValue, wallThickness) => {
    const now = Date.now();
    const type: BuildingComponentType = {
      id: createId(),
      category,
      name: name.trim() || 'Uten navn',
      uValue,
      wallThickness,
      createdAt: now,
      updatedAt: now,
    };
    await buildingComponentTypesRepo.put(type);
    set((state) => ({ types: [...state.types, type] }));
  },
```

to:

```ts
  createType: async (category, name, uValue, wallThickness) => {
    const now = Date.now();
    const type: BuildingComponentType = {
      id: createId(),
      category,
      name: name.trim() || 'Uten navn',
      uValue,
      wallThickness,
      createdAt: now,
      updatedAt: now,
    };
    await buildingComponentTypesRepo.put(type);
    set((state) => ({ types: [...state.types, type] }));
    return type;
  },
```

This is backward-compatible — `CategorySection.tsx`'s existing `void createType(...)` call site is unaffected by the added return value.

- [ ] **Step 2: Typecheck the store change**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Create the reusable picker popover**

Create `src/components/material/BuildingComponentPicker.tsx`:

```tsx
import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import { BUILDING_COMPONENT_CATEGORY_LABELS } from '@/types';
import type { BuildingComponentAssignment, BuildingComponentCategory, BuildingComponentType } from '@/types';

type BuildingComponentPickerProps = {
  categories: BuildingComponentCategory[];
  current?: BuildingComponentAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assignment: BuildingComponentAssignment | null) => void;
  children: React.ReactNode;
};

function toAssignment(type: BuildingComponentType): BuildingComponentAssignment {
  return {
    typeId: type.id,
    category: type.category,
    name: type.name,
    uValue: type.uValue,
    wallThickness: type.wallThickness,
  };
}

export default function BuildingComponentPicker({
  categories,
  current,
  open,
  onOpenChange,
  onSelect,
  children,
}: BuildingComponentPickerProps) {
  const types = useBuildingComponentTypeStore((s) => s.types);
  const createType = useBuildingComponentTypeStore((s) => s.createType);

  const [adding, setAdding] = useState(false);
  const [addCategory, setAddCategory] = useState<BuildingComponentCategory>(categories[0]);
  const [name, setName] = useState('');
  const [uValue, setUValue] = useState('');
  const [wallThickness, setWallThickness] = useState('');

  const isYttervegg = addCategory === 'yttervegg';
  const parsedUValue = Number(uValue.replace(',', '.'));
  const parsedThickness = Number(wallThickness.replace(',', '.'));
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(parsedUValue) &&
    parsedUValue > 0 &&
    (!isYttervegg || (Number.isFinite(parsedThickness) && parsedThickness > 0));

  function resetForm() {
    setName('');
    setUValue('');
    setWallThickness('');
    setAddCategory(categories[0]);
    setAdding(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleCreate() {
    if (!canSubmit) return;
    const created = await createType(addCategory, name.trim(), parsedUValue, isYttervegg ? parsedThickness : undefined);
    onSelect(toAssignment(created));
    resetForm();
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        {!adding ? (
          <>
            <div className="max-h-64 overflow-y-auto">
              {categories.map((category) => {
                const categoryTypes = types.filter((t) => t.category === category);
                return (
                  <div key={category} className="mb-2">
                    {categories.length > 1 && (
                      <div className="px-1 py-1 text-xs font-semibold text-muted-foreground">
                        {BUILDING_COMPONENT_CATEGORY_LABELS[category]}
                      </div>
                    )}
                    {categoryTypes.length === 0 && (
                      <div className="px-1 py-1 text-xs text-muted-foreground">Ingen typer ennå.</div>
                    )}
                    {categoryTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => {
                          onSelect(toAssignment(type));
                          onOpenChange(false);
                        }}
                        className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                      >
                        <span className="truncate">{type.name}</span>
                        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                          {type.uValue} W/m²K
                          {current?.typeId === type.id && <Check className="size-3.5 text-primary" />}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>

            {current && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  onOpenChange(false);
                }}
                className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-secondary"
              >
                <X className="size-3.5" /> Fjern merking
              </button>
            )}

            <Button
              variant="ghost"
              size="sm"
              className="mt-1 w-full justify-start"
              onClick={() => {
                setAddCategory(categories[0]);
                setAdding(true);
              }}
            >
              <Plus /> Legg til type
            </Button>
          </>
        ) : (
          <div className="grid gap-2">
            {categories.length > 1 && (
              <div className="flex gap-1">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setAddCategory(category)}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs',
                      addCategory === category
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground',
                    )}
                  >
                    {BUILDING_COMPONENT_CATEGORY_LABELS[category]}
                  </button>
                ))}
              </div>
            )}
            <Input
              autoFocus
              placeholder="Navn"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              inputMode="decimal"
              placeholder="U-verdi"
              value={uValue}
              onChange={(e) => setUValue(e.target.value)}
              className="h-8 text-sm"
            />
            {isYttervegg && (
              <Input
                inputMode="decimal"
                placeholder="Tykkelse (mm)"
                value={wallThickness}
                onChange={(e) => setWallThickness(e.target.value)}
                className="h-8 text-sm"
              />
            )}
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAdding(false)}>
                Avbryt
              </Button>
              <Button size="sm" className="flex-1" disabled={!canSubmit} onClick={() => void handleCreate()}>
                Legg til
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 4: Create the overlay**

Create `src/components/material/MaterialPickerOverlay.tsx`:

```tsx
import { useState } from 'react';
import BuildingComponentPicker from '@/components/material/BuildingComponentPicker';
import { useAnnotationStore } from '@/store/annotationStore';
import type { EdgeMeta, Point } from '@/types';

type MaterialPickerOverlayProps = {
  zoom: number;
  width: number;
  height: number;
};

function toScreen(p: Point, zoom: number) {
  return { x: p.x * zoom, y: p.y * zoom };
}

type OpenTarget =
  | { kind: 'area'; annotationId: string }
  | { kind: 'edge'; annotationId: string; edgeIndex: number };

export default function MaterialPickerOverlay({ zoom, width, height }: MaterialPickerOverlayProps) {
  const annotations = useAnnotationStore((s) => s.annotations);
  const updateAnnotation = useAnnotationStore((s) => s.updateAnnotation);
  const setEdgeMeta = useAnnotationStore((s) => s.setEdgeMeta);

  const [openTarget, setOpenTarget] = useState<OpenTarget | null>(null);
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const eligible = annotations.filter((a) => a.type !== 'line' && a.visible && !a.locked);

  function isOpen(target: OpenTarget): boolean {
    if (!openTarget || openTarget.kind !== target.kind || openTarget.annotationId !== target.annotationId) {
      return false;
    }
    if (openTarget.kind === 'edge' && target.kind === 'edge') return openTarget.edgeIndex === target.edgeIndex;
    return true;
  }

  return (
    <svg className="absolute inset-0 cursor-pointer" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {eligible.map((annotation) => {
        const screenPoints = annotation.points.map((p) => toScreen(p, zoom));
        const pointsAttr = screenPoints.map((p) => `${p.x},${p.y}`).join(' ');
        const areaTarget: OpenTarget = { kind: 'area', annotationId: annotation.id };
        const centroid = {
          x: screenPoints.reduce((sum, p) => sum + p.x, 0) / screenPoints.length,
          y: screenPoints.reduce((sum, p) => sum + p.y, 0) / screenPoints.length,
        };
        const areaHoverKey = `area:${annotation.id}`;

        return (
          <g key={annotation.id}>
            <BuildingComponentPicker
              categories={['gulv', 'dekke']}
              current={annotation.buildingComponent}
              open={isOpen(areaTarget)}
              onOpenChange={(open) => setOpenTarget(open ? areaTarget : null)}
              onSelect={(assignment) => updateAnnotation(annotation.id, { buildingComponent: assignment ?? undefined })}
            >
              <polygon
                points={pointsAttr}
                fill="transparent"
                pointerEvents="all"
                onMouseEnter={() => setHoveredKey(areaHoverKey)}
                onMouseLeave={() => setHoveredKey((k) => (k === areaHoverKey ? null : k))}
              />
            </BuildingComponentPicker>

            {hoveredKey === areaHoverKey && (
              <g transform={`translate(${centroid.x}, ${centroid.y})`} pointerEvents="none">
                <rect x={-50} y={-10} width={100} height={20} rx={4} className="fill-card/90 stroke-border" strokeWidth={1} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={10} className="fill-foreground select-none">
                  {annotation.buildingComponent?.name ?? 'Ingen type'}
                </text>
              </g>
            )}

            {annotation.points.map((point, i) => {
              const next = annotation.points[(i + 1) % annotation.points.length];
              const a = toScreen(point, zoom);
              const b = toScreen(next, zoom);
              const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
              const edgeTarget: OpenTarget = { kind: 'edge', annotationId: annotation.id, edgeIndex: i };
              const edge: EdgeMeta = annotation.edges?.[i] ?? {};
              const edgeHoverKey = `edge:${annotation.id}:${i}`;

              return (
                <g key={i}>
                  <BuildingComponentPicker
                    categories={['yttervegg']}
                    current={edge.buildingComponent}
                    open={isOpen(edgeTarget)}
                    onOpenChange={(open) => setOpenTarget(open ? edgeTarget : null)}
                    onSelect={(assignment) => setEdgeMeta(annotation.id, i, { buildingComponent: assignment ?? undefined })}
                  >
                    <line
                      x1={a.x}
                      y1={a.y}
                      x2={b.x}
                      y2={b.y}
                      stroke="transparent"
                      strokeWidth={14}
                      onMouseEnter={() => setHoveredKey(edgeHoverKey)}
                      onMouseLeave={() => setHoveredKey((k) => (k === edgeHoverKey ? null : k))}
                    />
                  </BuildingComponentPicker>

                  {hoveredKey === edgeHoverKey && (
                    <g transform={`translate(${mid.x}, ${mid.y})`} pointerEvents="none">
                      <rect x={-50} y={-19} width={100} height={18} rx={4} className="fill-card/90 stroke-amber-500" strokeWidth={1} />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={10} className="fill-amber-700 select-none">
                        {edge.buildingComponent?.name ?? 'Ingen type'}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
```

Note: no manual `onClick` handler is needed on the `<polygon>`/`<line>` hit-targets — `BuildingComponentPicker`'s `PopoverTrigger asChild` already injects Radix's own click handler onto them, which toggles the controlled `open` prop via `onOpenChange`. Only one `openTarget` can be set at a time, so opening a new picker automatically closes any other (its `open` prop becomes `false` on the next render).

- [ ] **Step 5: Mount the overlay**

In `src/components/viewer/PdfCanvas.tsx`, add the import after the existing `WallToolOverlay` import:

```tsx
import WallToolOverlay from '@/components/wall/WallToolOverlay';
import MaterialPickerOverlay from '@/components/material/MaterialPickerOverlay';
```

Add the render block right after the existing `{tool === 'wall' && <WallToolOverlay .../>}` line:

```tsx
{tool === 'wall' && <WallToolOverlay zoom={zoom} width={pageWidth} height={pageHeight} />}
{tool === 'material' && <MaterialPickerOverlay zoom={zoom} width={pageWidth} height={pageHeight} />}
```

- [ ] **Step 6: Add the `ToolId` member and toolbar button**

In `src/types/index.ts`, extend the `ToolId` union:

```ts
export type ToolId = 'select' | 'line' | 'rectangle' | 'polygon' | 'calibrate' | 'calibrate-area' | 'pan' | 'detect' | 'wall' | 'material';
```

In `src/components/toolbar/Toolbar.tsx`, add `Palette` to the lucide-react import list:

```tsx
import {
  MousePointer2,
  Hand,
  Slash,
  Square,
  Hexagon,
  Wand2,
  BrickWall,
  Palette,
  Ruler,
  Compass,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Eye,
  Download,
} from 'lucide-react';
```

Add a new `ToolButton` right after the existing "wall" tool button:

```tsx
<ToolButton
  icon={BrickWall}
  label="Merk yttervegg"
  shortcut="W"
  active={tool === 'wall'}
  disabled={!calibrated}
  disabledReason="Kalibrer PDF-en først"
  onClick={() => setTool('wall')}
/>
<ToolButton
  icon={Palette}
  label="Materialvelger"
  shortcut="M"
  active={tool === 'material'}
  onClick={() => setTool('material')}
/>
```

(No `disabled`/`disabledReason` — unlike the draw/wall/detect tools, assigning a Bygningsdel type doesn't depend on the file being calibrated.)

- [ ] **Step 7: Add the keyboard shortcut**

In `src/components/tools/useKeyboardShortcuts.ts`, change:

```ts
const TOOL_KEYS: Record<string, 'select' | 'line' | 'rectangle' | 'polygon' | 'pan' | 'detect' | 'wall'> = {
  v: 'select',
  l: 'line',
  r: 'rectangle',
  p: 'polygon',
  h: 'pan',
  d: 'detect',
  w: 'wall',
};
```

to:

```ts
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
```

- [ ] **Step 8: Typecheck and run the full test suite**

Run: `npx tsc -b && npx vitest run`
Expected: no errors; all existing tests pass (no new test files, per the Global Constraints note).

- [ ] **Step 9: Manual verification**

Run `npm run dev`, open a project with `src/assets/Test plantegning.pdf` (or any uploaded PDF) with an existing wall/room annotation:

- Click the "Materialvelger" tool (palette icon, or press `M`).
- Hover a wall edge — confirm a small label shows "Ingen type" (or the assigned name, once set).
- Click a wall edge — confirm a popover opens listing only Yttervegg types (no category heading needed for a single category), with a "+ Legg til type" row at the bottom.
- Use "+ Legg til type" to create a new Yttervegg type (name, U-verdi, Tykkelse) — confirm the popover closes and the edge is immediately assigned (hover label updates); confirm the new type also now appears on `/bygningsdeltyper` under Yttervegg.
- Click the same edge again — confirm the popover reopens with the current type checkmarked, and "Fjern merking" is present; click it — confirm the assignment clears.
- Click inside a room/area (not on an edge) — confirm a popover opens showing **both** Gulv and Dekke types, grouped under their category headings; assign one and confirm the hover label at the shape's centroid updates.
- Edit that same type's U-verdi afterward on `/bygningsdeltyper` — confirm the already-assigned wall/area's hover label does **not** change (snapshot behavior).
- Switch to the existing "wall" tool (brick icon, `W`) — confirm external/internal + compass-orientation marking still works exactly as before, unaffected by this change.

- [ ] **Step 10: Commit**

```bash
git add src/store/buildingComponentTypeStore.ts src/components/material/BuildingComponentPicker.tsx src/components/material/MaterialPickerOverlay.tsx src/components/viewer/PdfCanvas.tsx src/components/toolbar/Toolbar.tsx src/components/tools/useKeyboardShortcuts.ts src/types/index.ts
git commit -m "Add material-picker tool for assigning Bygningsdel types to walls and areas"
```

---

## Self-Review Notes

- **Spec coverage:** snapshot-not-reference (`BuildingComponentAssignment` copied via `toAssignment`, `typeId` kept only for display) ✓; picker reads straight from the global library (`useBuildingComponentTypeStore`, no project-shortlist layer) ✓; new separate tool, existing wall tool untouched (Task 2 Step 5/6 only add alongside) ✓; edge → Yttervegg only, area → Gulv+Dekke grouped (Task 2 Step 4's `categories` props) ✓; quick-add inline form (`BuildingComponentPicker`'s `adding` state) ✓; hover feedback (Task 2 Step 4's `hoveredKey` labels) ✓; windows/doors explicitly out of scope, no task touches them ✓.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact manual-test procedure.
- **Type consistency:** `BuildingComponentAssignment` (Task 1) fields (`typeId`, `category`, `name`, `uValue`, `wallThickness`) match `toAssignment()`'s return shape (Task 2 Step 3) exactly; `EdgeMeta.buildingComponent`/`Annotation.buildingComponent` (Task 1) match the `setEdgeMeta`/`updateAnnotation` call sites in `MaterialPickerOverlay` (Task 2 Step 4) exactly; `createType`'s new `Promise<BuildingComponentType>` return (Task 2 Step 1) matches its usage in `BuildingComponentPicker.handleCreate` (Task 2 Step 3).
