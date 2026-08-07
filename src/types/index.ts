export type Point = { x: number; y: number };

export type PdfLayer = { id: string; name: string; visible: boolean };

export type ToolId = 'select' | 'line' | 'rectangle' | 'polygon' | 'calibrate' | 'calibrate-area' | 'pan' | 'detect' | 'wall' | 'material';

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
export type EdgeMeta = {
  wallType?: WallType;
  orientation?: Orientation;
  buildingComponent?: BuildingComponentAssignment;
};

export type AnnotationType = 'rectangle' | 'polygon' | 'line';

export type Annotation = {
  id: string;
  fileId: string;
  type: AnnotationType;
  points: Point[];
  edges?: EdgeMeta[];
  name?: string;
  labelPos?: Point;
  color: AnnotationColor;
  locked: boolean;
  visible: boolean;
  buildingComponent?: BuildingComponentAssignment;
  createdAt: number;
  updatedAt: number;
};

export type Calibration = {
  pointA: Point;
  pointB: Point;
  realMeters: number;
} | null;

export type PdfFile = {
  id: string;
  projectId: string;
  name: string;
  order: number;
  pdfBlob: Blob;
  calibration: Calibration;
  createdAt: number;
};

export type Project = {
  id: string;
  name: string;
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
