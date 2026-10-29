export type Point = { x: number; y: number };

export type PdfLayer = { id: string; name: string; visible: boolean };

export type ToolId = 'select' | 'line' | 'rectangle' | 'polygon' | 'calibrate' | 'calibrate-area' | 'pan' | 'detect' | 'wall' | 'wall-auto' | 'opening' | 'material' | 'people';

export type Unit = 'm' | 'mm';

export type AnnotationColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'black';

export const ANNOTATION_COLORS: Record<AnnotationColor, string> = {
  red: '#e5484d',
  blue: '#0091ff',
  green: '#30a46c',
  yellow: '#f5a623',
  purple: '#8e4ec6',
  black: '#1a1a1a',
};

export type WallType = 'external' | 'internal';

export type Orientation = 'N' | 'S' | 'E' | 'W';

// `wallType`/`orientation` (set by the "wall" tool) and `buildingComponent` (set by the
// material-picker tool) are independent, tool-specific fields with no automatic reconciliation
// between them today — e.g. `wallType: 'internal'` can coexist with a `buildingComponent` of
// category 'yttervegg'. A future increment may need to unify them.
// A window or door in a wall: a library type (vindu/ytterdor) plus the area (m²) of this opening.
export type WallOpening = {
  id: string;
  component: BuildingComponentAssignment;
  area: number;
};

export type EdgeMeta = {
  wallType?: WallType;
  orientation?: Orientation;
  buildingComponent?: BuildingComponentAssignment;
  openings?: WallOpening[];
};

export type AnnotationType = 'rectangle' | 'polygon' | 'line';

export type Annotation = {
  id: string;
  fileId: string;
  type: AnnotationType;
  points: Point[];
  // Additional closed polygon rings merged into this annotation (e.g. two halves of a room
  // split by a door threshold, joined via the multi-region "magic wand" flow). Only meaningful
  // for type: 'polygon'. Regions are immutable after creation — no vertex-drag handles and no
  // per-edge wall/material assignment (`edges` only ever pairs with `points`).
  regions?: Point[][];
  edges?: EdgeMeta[];
  name?: string;
  roomNumber?: string;
  // Number of people in the area (set with the Personer tool or in Målinger); omitted when 0.
  people?: number;
  // Id of the chosen area type (src/lib/areaTypes.ts); picking one suggests `people` from the floor area.
  areaType?: string;
  labelPos?: Point;
  color: AnnotationColor;
  locked: boolean;
  visible: boolean;
  buildingComponent?: BuildingComponentAssignment;
  roomTemplate?: RoomTemplateAssignment;
  createdAt: number;
  updatedAt: number;
};

export type Calibration = {
  pointA: Point;
  pointB: Point;
  realMeters: number;
} | null;

export type OpeningKind = 'vindu' | 'dor';

// Where an opening sits: on one side (edge) of a room, `t` along that side from 0 (start) to 1 (end).
export type OpeningPlacement = { annotationId: string; edgeIndex: number; t: number };

// A window or door of the plan, e.g. "Vindu 1" or "Dør 3". Size is in mm; the type comes from the
// building-component table (categories vindu / ytterdør) and is looked up live by id.
export type OpeningItem = {
  id: string;
  kind: OpeningKind;
  name: string;
  widthMm?: number;
  heightMm?: number;
  typeId?: string;
  placement?: OpeningPlacement;
};

export type PdfFile = {
  id: string;
  projectId: string;
  name: string;
  order: number;
  pdfBlob: Blob;
  calibration: Calibration;
  openings?: OpeningItem[];
  createdAt: number;
};

export type BuildingCategory =
  | 'smahus'
  | 'boligblokk'
  | 'kontorbygg'
  | 'skolebygg'
  | 'barnehage'
  | 'sykehus'
  | 'sykehjem'
  | 'hotell'
  | 'idrettsbygg'
  | 'forretningsbygg'
  | 'kulturbygg'
  | 'industri'
  | 'annet';

// Energy-labelling (Enova/TEK17) building categories.
export const BUILDING_CATEGORY_LABELS: Record<BuildingCategory, string> = {
  smahus: 'Småhus',
  boligblokk: 'Boligblokk',
  kontorbygg: 'Kontorbygg',
  skolebygg: 'Skolebygg',
  barnehage: 'Barnehage',
  sykehus: 'Sykehus',
  sykehjem: 'Sykehjem',
  hotell: 'Hotell',
  idrettsbygg: 'Idrettsbygg',
  forretningsbygg: 'Forretningsbygg',
  kulturbygg: 'Kulturbygg',
  industri: 'Lett industri/verksted',
  annet: 'Annet',
};

/** The user-entered "Prosjektinformasjon" fields. Everything but name is optional for older projects. */
export type ProjectInfo = {
  name: string;
  description?: string;
  buildingCategory?: BuildingCategory;
  buildYear?: number;
  climateLocation?: string;
};

export type Project = ProjectInfo & {
  id: string;
  northDirection: number;
  createdAt: number;
  updatedAt: number;
  layerVisibilitySelection?: string[]; // OCG layer *names* targeted by the layer-visibility toggle
};

export type BuildingComponentCategory = 'yttervegg' | 'vindu' | 'ytterdor' | 'tak' | 'gulv' | 'dekke';

export type BuildingComponentType = {
  id: string;
  category: BuildingComponentCategory;
  name: string;
  uValue?: number; // W/m²K
  wallThickness?: number; // mm — only meaningful when category === 'yttervegg'
  createdAt: number;
  updatedAt: number;
};

export type BuildingComponentAssignment = {
  typeId: string; // originating library type id — provenance/display only, never re-read live
  category: BuildingComponentCategory;
  name: string;
  uValue?: number;
  wallThickness?: number; // only meaningful when category === 'yttervegg'
};

export const BUILDING_COMPONENT_CATEGORY_LABELS: Record<BuildingComponentCategory, string> = {
  yttervegg: 'Yttervegg',
  vindu: 'Vindu',
  ytterdor: 'Ytterdør',
  tak: 'Tak',
  gulv: 'Gulv',
  dekke: 'Dekke',
};

export type VentilationUnit = 'm3h_per_m2' | 'm3h_per_person' | 'm3h_total' | 'm3h_per_shower' | 'm3h_per_toilet';

export const VENTILATION_UNIT_LABELS: Record<VentilationUnit, string> = {
  m3h_per_m2: 'm³/h per m²',
  m3h_per_person: 'm³/h per person',
  m3h_total: 'm³/h (totalt)',
  m3h_per_shower: 'm³/h per dusj',
  m3h_per_toilet: 'm³/h per toalettstol/urinal',
};

// A user-built library of room categories (e.g. "Møterom") with TEK17 ventilation
// criteria, matched against `Annotation.name` to produce a `RoomTemplateAssignment`.
export type RoomTemplate = {
  id: string;
  name: string; // primary label + primary match keyword, e.g. "Møterom"
  aliases?: string[]; // extra match keywords, e.g. ["konferanserom"]
  ventilationRate?: number;
  ventilationUnit?: VentilationUnit;
  note?: string;
  createdAt: number;
  updatedAt: number;
};

export type RoomTemplateMatchType = 'exact' | 'fuzzy' | 'manual';

export type RoomTemplateAssignment = {
  templateId: string; // originating library template id — provenance/display only, never re-read live
  name: string;
  ventilationRate?: number;
  ventilationUnit?: VentilationUnit;
  note?: string;
  matchType: RoomTemplateMatchType;
};
