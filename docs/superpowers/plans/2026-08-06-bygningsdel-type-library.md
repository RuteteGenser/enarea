# Bygningsdel Type Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user create, edit, and delete a global (cross-project) library of Bygningsdel (building-component) types, grouped into six fixed categories, each carrying a required U-verdi and (for Yttervegg only) a required veggtykkelse.

**Architecture:** A new `BuildingComponentType` entity persisted in a new global IndexedDB object store (no project scoping), following the exact `projectsRepo`/`projectStore` pattern already used for `Project`. A new route `/bygningsdeltyper` renders a page grouping types by category, each type editable inline (double-click a field to edit, matching `MeasurementRow.tsx`'s existing pattern), reached via a new button on the project-list screen.

**Tech Stack:** React 19, TypeScript, Zustand, `idb` (IndexedDB), react-router-dom, existing shadcn-style UI primitives (`Button`, `Input`, `ConfirmDialog`).

## Global Constraints

- The library is global — one shared set of types across all projects, not scoped per-project (confirmed in brainstorming).
- Six fixed categories: `yttervegg`, `vindu`, `ytterdor`, `tak`, `gulv`, `dekke`.
- Every type requires `uValue` (W/m²K). Only `yttervegg` types additionally require `wallThickness` (mm).
- This increment does **not** wire types into `EdgeMeta`/annotations, does not add kuldebroverdi, and does not touch compass-direction logic — those are separate future increments (see `docs/superpowers/specs/2026-08-06-bygningsdel-type-library-design.md`'s "Out of scope" section).
- **No unit tests for this feature.** This codebase's existing convention (confirmed by inspection: zero `*.test.tsx` files exist, `vitest.config`'s `test.include` is `src/**/*.test.ts` only, no React Testing Library installed) is to unit-test pure `.ts` logic functions only — Zustand stores and React components are verified manually, exactly like `projectStore.ts`, `filesStore.ts`, `MeasurementRow.tsx`, and `CalibrationDialog.tsx` today. Each task below is verified via `npx tsc -b` plus a manual check instead of an automated test.

---

### Task 1: Data model and storage layer

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/db.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `BuildingComponentCategory` (type), `BuildingComponentType` (type), `buildingComponentTypesRepo` (object with `list(): Promise<BuildingComponentType[]>`, `get(id: string): Promise<BuildingComponentType | undefined>`, `put(type: BuildingComponentType): Promise<void>`, `remove(id: string): Promise<void>`) — all consumed by Task 2.

- [ ] **Step 1: Add the new types**

In `src/types/index.ts`, add after the existing `Project` type at the end of the file:

```ts
export type BuildingComponentCategory = 'yttervegg' | 'vindu' | 'ytterdor' | 'tak' | 'gulv' | 'dekke';

export type BuildingComponentType = {
  id: string;
  category: BuildingComponentCategory;
  name: string;
  uValue: number; // W/m²K
  wallThickness?: number; // mm — present only when category === 'yttervegg'
  createdAt: number;
  updatedAt: number;
};
```

- [ ] **Step 2: Add the IndexedDB store and repo**

In `src/lib/db.ts`, update the import line to also bring in the new type:

```ts
import type { Annotation, BuildingComponentType, PdfFile, Project } from '@/types';
```

Add `buildingComponentTypes` to the `EnareaDB` interface (after the `annotations` field):

```ts
interface EnareaDB extends DBSchema {
  projects: {
    key: string;
    value: Project;
  };
  files: {
    key: string;
    value: PdfFile;
    indexes: { 'by-project': string };
  };
  annotations: {
    key: string;
    value: Annotation;
    indexes: { 'by-file': string };
  };
  buildingComponentTypes: {
    key: string;
    value: BuildingComponentType;
  };
}
```

Bump the DB version to `2` and add the new object store in the `upgrade` callback:

```ts
function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<EnareaDB>('enarea', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('projects', { keyPath: 'id' });
          const files = db.createObjectStore('files', { keyPath: 'id' });
          files.createIndex('by-project', 'projectId');
          const annotations = db.createObjectStore('annotations', { keyPath: 'id' });
          annotations.createIndex('by-file', 'fileId');
        }
        if (oldVersion < 2) {
          db.createObjectStore('buildingComponentTypes', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}
```

Add the repo at the end of the file, following the exact shape of `projectsRepo` (no cascading delete needed — nothing references a type by id yet):

```ts
export const buildingComponentTypesRepo = {
  async list(): Promise<BuildingComponentType[]> {
    const db = await getDb();
    const all = await db.getAll('buildingComponentTypes');
    return all.sort((a, b) => a.createdAt - b.createdAt);
  },
  async get(id: string): Promise<BuildingComponentType | undefined> {
    const db = await getDb();
    return db.get('buildingComponentTypes', id);
  },
  async put(type: BuildingComponentType): Promise<void> {
    const db = await getDb();
    await db.put('buildingComponentTypes', type);
  },
  async remove(id: string): Promise<void> {
    const db = await getDb();
    await db.delete('buildingComponentTypes', id);
  },
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/types/index.ts src/lib/db.ts
git commit -m "Add BuildingComponentType data model and IndexedDB store"
```

---

### Task 2: Zustand store

**Files:**
- Create: `src/store/buildingComponentTypeStore.ts`

**Interfaces:**
- Consumes: `buildingComponentTypesRepo` (Task 1), `createId` from `@/lib/id` (already exists, used identically by `projectStore.ts`).
- Produces: `useBuildingComponentTypeStore` hook exposing `types: BuildingComponentType[]`, `loaded: boolean`, `loadTypes: () => Promise<void>`, `createType: (category: BuildingComponentCategory, name: string, uValue: number, wallThickness?: number) => Promise<void>`, `updateType: (id: string, patch: Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>) => Promise<void>`, `deleteType: (id: string) => Promise<void>` — all consumed by Task 3.

- [ ] **Step 1: Write the store**

Create `src/store/buildingComponentTypeStore.ts`:

```ts
import { create } from 'zustand';
import { buildingComponentTypesRepo } from '@/lib/db';
import { createId } from '@/lib/id';
import type { BuildingComponentCategory, BuildingComponentType } from '@/types';

type BuildingComponentTypeStore = {
  types: BuildingComponentType[];
  loaded: boolean;
  loadTypes: () => Promise<void>;
  createType: (category: BuildingComponentCategory, name: string, uValue: number, wallThickness?: number) => Promise<void>;
  updateType: (id: string, patch: Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>) => Promise<void>;
  deleteType: (id: string) => Promise<void>;
};

export const useBuildingComponentTypeStore = create<BuildingComponentTypeStore>((set, get) => ({
  types: [],
  loaded: false,

  loadTypes: async () => {
    const types = await buildingComponentTypesRepo.list();
    set({ types, loaded: true });
  },

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

  updateType: async (id, patch) => {
    const type = get().types.find((t) => t.id === id);
    if (!type) return;
    const updated: BuildingComponentType = { ...type, ...patch, updatedAt: Date.now() };
    await buildingComponentTypesRepo.put(updated);
    set((state) => ({ types: state.types.map((t) => (t.id === id ? updated : t)) }));
  },

  deleteType: async (id) => {
    await buildingComponentTypesRepo.remove(id);
    set((state) => ({ types: state.types.filter((t) => t.id !== id) }));
  },
}));
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/store/buildingComponentTypeStore.ts
git commit -m "Add buildingComponentTypeStore"
```

---

### Task 3: UI — page, category sections, editable rows, and route wiring

**Files:**
- Create: `src/components/buildingComponentTypes/BuildingComponentTypeRow.tsx`
- Create: `src/components/buildingComponentTypes/CategorySection.tsx`
- Create: `src/routes/BuildingComponentTypes.tsx`
- Modify: `src/App.tsx`
- Modify: `src/routes/ProjectList.tsx`

**Interfaces:**
- Consumes: `useBuildingComponentTypeStore` (Task 2), `BuildingComponentCategory`/`BuildingComponentType` (Task 1), existing `Button`/`Input`/`ConfirmDialog` UI primitives, `useNavigate` from `react-router-dom` (already a project dependency, used identically in `Workspace.tsx`/`ProjectCard.tsx`).
- Produces: `BuildingComponentTypeRow` (default export, props `{ type: BuildingComponentType; onUpdate: (patch: Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>) => void; onDelete: () => void }`), `CategorySection` (default export, props `{ category: BuildingComponentCategory; types: BuildingComponentType[] }`), `BuildingComponentTypes` page (default export, no props, rendered at route `/bygningsdeltyper`).

- [ ] **Step 1: Create the editable row component**

Create `src/components/buildingComponentTypes/BuildingComponentTypeRow.tsx`:

```tsx
import { useState, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BuildingComponentType } from '@/types';

type EditableField = 'name' | 'uValue' | 'wallThickness' | null;

type BuildingComponentTypeRowProps = {
  type: BuildingComponentType;
  onUpdate: (patch: Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>) => void;
  onDelete: () => void;
};

export default function BuildingComponentTypeRow({ type, onUpdate, onDelete }: BuildingComponentTypeRowProps) {
  const [editing, setEditing] = useState<EditableField>(null);
  const [draft, setDraft] = useState('');

  function startEdit(field: EditableField, initial: string) {
    setDraft(initial);
    setEditing(field);
  }

  function commitName() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== type.name) onUpdate({ name: trimmed });
    setEditing(null);
  }

  function commitNumber(field: 'uValue' | 'wallThickness') {
    const parsed = Number(draft.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      onUpdate({ [field]: parsed });
    }
    setEditing(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, commit: () => void, revertTo: string) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      setDraft(revertTo);
      setEditing(null);
    }
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
      {editing === 'name' ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => handleKeyDown(e, commitName, type.name)}
          className="h-7 flex-1 px-1.5 py-0 text-sm"
        />
      ) : (
        <span className="flex-1 truncate text-foreground" onDoubleClick={() => startEdit('name', type.name)}>
          {type.name}
        </span>
      )}

      {editing === 'uValue' ? (
        <Input
          autoFocus
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitNumber('uValue')}
          onKeyDown={(e) => handleKeyDown(e, () => commitNumber('uValue'), String(type.uValue))}
          className="h-7 w-24 px-1.5 py-0 text-sm"
        />
      ) : (
        <span
          className="w-24 shrink-0 tabular-nums text-muted-foreground"
          onDoubleClick={() => startEdit('uValue', String(type.uValue))}
        >
          {type.uValue} W/m²K
        </span>
      )}

      {type.category === 'yttervegg' &&
        (editing === 'wallThickness' ? (
          <Input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitNumber('wallThickness')}
            onKeyDown={(e) =>
              handleKeyDown(e, () => commitNumber('wallThickness'), String(type.wallThickness ?? ''))
            }
            className="h-7 w-28 px-1.5 py-0 text-sm"
          />
        ) : (
          <span
            className="w-28 shrink-0 tabular-nums text-muted-foreground"
            onDoubleClick={() => startEdit('wallThickness', String(type.wallThickness ?? ''))}
          >
            {type.wallThickness ?? '—'} mm
          </span>
        ))}

      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Create the category section (list + add-type form)**

Create `src/components/buildingComponentTypes/CategorySection.tsx`:

```tsx
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import BuildingComponentTypeRow from '@/components/buildingComponentTypes/BuildingComponentTypeRow';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import type { BuildingComponentCategory, BuildingComponentType } from '@/types';

const CATEGORY_LABELS: Record<BuildingComponentCategory, string> = {
  yttervegg: 'Yttervegg',
  vindu: 'Vindu',
  ytterdor: 'Ytterdør',
  tak: 'Tak',
  gulv: 'Gulv',
  dekke: 'Dekke',
};

type CategorySectionProps = {
  category: BuildingComponentCategory;
  types: BuildingComponentType[];
};

export default function CategorySection({ category, types }: CategorySectionProps) {
  const createType = useBuildingComponentTypeStore((s) => s.createType);
  const updateType = useBuildingComponentTypeStore((s) => s.updateType);
  const deleteType = useBuildingComponentTypeStore((s) => s.deleteType);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [uValue, setUValue] = useState('');
  const [wallThickness, setWallThickness] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<BuildingComponentType | null>(null);

  const isYttervegg = category === 'yttervegg';
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
    setAdding(false);
  }

  function handleCreate() {
    if (!canSubmit) return;
    void createType(category, name.trim(), parsedUValue, isYttervegg ? parsedThickness : undefined);
    resetForm();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-semibold text-foreground">{CATEGORY_LABELS[category]}</h2>

      {types.length === 0 && !adding && <p className="mb-2 text-sm text-muted-foreground">Ingen typer ennå.</p>}

      {(types.length > 0 || adding) && (
        <div className="divide-y divide-border rounded-md border border-border">
          {types.map((type) => (
            <BuildingComponentTypeRow
              key={type.id}
              type={type}
              onUpdate={(patch) => void updateType(type.id, patch)}
              onDelete={() => setDeleteTarget(type)}
            />
          ))}

          {adding && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <Input
                autoFocus
                placeholder="Navn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 flex-1 px-1.5 py-0 text-sm"
              />
              <Input
                inputMode="decimal"
                placeholder="U-verdi"
                value={uValue}
                onChange={(e) => setUValue(e.target.value)}
                className="h-7 w-24 px-1.5 py-0 text-sm"
              />
              {isYttervegg && (
                <Input
                  inputMode="decimal"
                  placeholder="Tykkelse (mm)"
                  value={wallThickness}
                  onChange={(e) => setWallThickness(e.target.value)}
                  className="h-7 w-28 px-1.5 py-0 text-sm"
                />
              )}
              <Button size="sm" disabled={!canSubmit} onClick={handleCreate}>
                Legg til
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                Avbryt
              </Button>
            </div>
          )}
        </div>
      )}

      {!adding && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(true)}>
          <Plus /> Legg til type
        </Button>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={deleteTarget !== null}
          title={`Slette «${deleteTarget.name}»?`}
          description="Dette kan ikke angres."
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => void deleteType(deleteTarget.id)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 3: Create the page**

Create `src/routes/BuildingComponentTypes.tsx`:

```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CategorySection from '@/components/buildingComponentTypes/CategorySection';
import { useBuildingComponentTypeStore } from '@/store/buildingComponentTypeStore';
import type { BuildingComponentCategory } from '@/types';

const CATEGORIES: BuildingComponentCategory[] = ['yttervegg', 'vindu', 'ytterdor', 'tak', 'gulv', 'dekke'];

export default function BuildingComponentTypes() {
  const navigate = useNavigate();
  const types = useBuildingComponentTypeStore((s) => s.types);
  const loadTypes = useBuildingComponentTypeStore((s) => s.loadTypes);

  useEffect(() => {
    void loadTypes();
  }, [loadTypes]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')} title="Til prosjektliste">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold leading-none text-foreground">Bygningsdeltyper</h1>
          <p className="mt-1 text-xs text-muted-foreground">Delt bibliotek av bygningsdeltyper for alle prosjekter.</p>
        </div>
      </header>

      {CATEGORIES.map((category) => (
        <CategorySection key={category} category={category} types={types.filter((t) => t.category === category)} />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Wire the route**

In `src/App.tsx`, add the lazy import (after the existing `Workspace` import):

```ts
const ProjectList = lazy(() => import('@/routes/ProjectList'));
const Workspace = lazy(() => import('@/routes/Workspace'));
const BuildingComponentTypes = lazy(() => import('@/routes/BuildingComponentTypes'));
```

Add the route (after the existing `/project/:projectId` route):

```tsx
<Routes>
  <Route path="/" element={<ProjectList />} />
  <Route path="/project/:projectId" element={<Workspace />} />
  <Route path="/bygningsdeltyper" element={<BuildingComponentTypes />} />
</Routes>
```

- [ ] **Step 5: Add the entry button**

In `src/routes/ProjectList.tsx`, add the import:

```tsx
import { Plus, Ruler, Wrench } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
```

Add `const navigate = useNavigate();` inside the component (alongside the existing `useProjectStore()` destructure), and add a new button in the header, before the existing "Nytt prosjekt" button:

```tsx
<header className="mb-8 flex items-center justify-between">
  <div className="flex items-center gap-2.5">
    <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
      <Ruler className="size-5" />
    </div>
    <div>
      <h1 className="text-lg font-semibold leading-none text-foreground">Enarea</h1>
      <p className="mt-1 text-xs text-muted-foreground">Oppmålingsverktøy for energirådgivere</p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    <Button variant="outline" onClick={() => navigate('/bygningsdeltyper')}>
      <Wrench /> Bygningsdeltyper
    </Button>
    <Button onClick={() => setNewOpen(true)}>
      <Plus /> Nytt prosjekt
    </Button>
  </div>
</header>
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Run the full test suite**

Run: `npx vitest run`
Expected: all existing tests still pass (this task adds no new test files, per the Global Constraints note — nothing here is pure logic worth extracting into a tested module).

- [ ] **Step 8: Manual verification**

Run `npm run dev`, open the app, and from the project list click "Bygningsdeltyper":
- Confirm all six category headings are visible (Yttervegg, Vindu, Ytterdør, Tak, Gulv, Dekke), each showing "Ingen typer ennå." initially.
- Under Yttervegg, click "Legg til type", enter a name, U-verdi, and Tykkelse (mm), click "Legg til" — confirm the new row appears showing all three values, and confirm the Tykkelse field does **not** appear when adding a type under any other category (e.g. Vindu).
- Double-click the new row's name, U-verdi, and Tykkelse values one at a time — confirm each becomes an editable input, commits on Enter or blur, and reverts on Escape without saving.
- Delete the type via its trash icon — confirm the `ConfirmDialog` appears, and the row disappears after confirming.
- Reload the page — confirm any remaining types persist (IndexedDB).

- [ ] **Step 9: Commit**

```bash
git add src/components/buildingComponentTypes/BuildingComponentTypeRow.tsx src/components/buildingComponentTypes/CategorySection.tsx src/routes/BuildingComponentTypes.tsx src/App.tsx src/routes/ProjectList.tsx
git commit -m "Add Bygningsdeltyper page with category-grouped, inline-editable type library"
```

---

## Self-Review Notes

- **Spec coverage:** global scope (Task 1's store has no project-id field or index) ✓; six fixed categories (Task 3's `CATEGORIES`/`CATEGORY_LABELS`) ✓; uValue required for all, wallThickness required only for yttervegg (Task 3's `canSubmit` guard and conditional field rendering) ✓; dedicated route reached from project-list header (Task 3 Steps 4–5) ✓; inline-editable rows modeled on `MeasurementRow.tsx` (Task 3 Step 1, same double-click/autoFocus/blur-commit/Escape-revert pattern) ✓; out-of-scope items (edge wiring, kuldebroverdi, compass direction, Simien export) intentionally have no tasks ✓.
- **Placeholder scan:** no TBD/TODO; every step has literal code or an exact manual-test procedure.
- **Type consistency:** `BuildingComponentType`/`BuildingComponentCategory` (Task 1) match `buildingComponentTypesRepo`'s signatures (Task 1) match `useBuildingComponentTypeStore`'s signatures (Task 2) match `BuildingComponentTypeRow`/`CategorySection`/`BuildingComponentTypes` props (Task 3) exactly throughout — `Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>` is the same shape in the store's `updateType` and the row's `onUpdate` prop.
