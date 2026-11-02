import { annotationArea, distance, polygonPerimeter } from '@/lib/geometry';
import { metersPerUnit } from '@/lib/calibration';
import { displayName } from '@/lib/annotationLabel';
import { joinPlacements, openingArea, OPENING_KIND_LABELS } from '@/lib/openings';
import { openingTotals } from '@/lib/wallOpenings';
import { ventilationTotal } from '@/lib/ventilation';
import { BUILDING_CATEGORY_LABELS, BUILDING_COMPONENT_CATEGORY_LABELS, VENTILATION_UNIT_LABELS } from '@/types';
import { compassPoint, ORIENTATION_NAMES, wallBearing } from '@/lib/wallOrientation';
import type { Annotation, BuildingComponentType, EdgeMeta, OpeningItem, PdfFile, Project } from '@/types';

export type ExportFileData = { file: PdfFile; annotations: Annotation[] };

/** A spreadsheet cell: number, text, or empty. */
export type Cell = string | number | null;

export type ExportTable = {
  title: string;
  headers: string[];
  rows: Cell[][];
  /** Columns that identify a group of rows (e.g. the room): groups get alternating background colors in Excel. */
  groupBy?: number[];
  /** Smaller tables written below the rows, one after the other (e.g. the sums per compass direction). */
  summaries?: ExportSummary[];
};

/** How a summary row is colored: detail rows alternate per group, then room sums, direction/kind sums and the total. */
export type RowStyle = 'detail' | 'detailAlt' | 'roomSum' | 'groupSum' | 'total';

export type ExportSummary = { title: string; headers: string[]; rows: Cell[][]; styles?: RowStyle[] };

const bearingCell = (degrees: number | undefined): Cell => (degrees === undefined ? null : degrees);

export { ventilationTotal };

const round = (value: number, decimals = 2) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * Names the windows and doors on some sides: "2 × Vindu 1 (Trevindu), 1 × Dør 1". Placed items use the name of
 * their type plus the building type picked for it; ones added in the material picker use the building type's name.
 */
function openingNames(edges: (EdgeMeta | undefined)[], items: OpeningItem[], buildingTypes: BuildingComponentType[]): Cell {
  const counts = new Map<string, number>();
  const add = (label: string) => counts.set(label, (counts.get(label) ?? 0) + 1);
  for (const edge of edges) for (const o of edge?.openings ?? []) add(o.component.name);
  for (const item of items) {
    const typeName = buildingTypes.find((t) => t.id === item.typeId)?.name;
    add(typeName ? `${item.name} (${typeName})` : item.name);
  }
  if (counts.size === 0) return null;
  return [...counts].map(([label, n]) => `${n} × ${label}`).join(', ');
}

/**
 * Turns the project data into tables for the Excel export. Lengths are in m, areas in m²; they
 * are left empty for files that haven't been calibrated, since the numbers would be meaningless.
 */
export function buildExportTables(
  project: Project,
  filesData: ExportFileData[],
  buildingTypes: BuildingComponentType[] = [],
): ExportTable[] {
  const rooms: Cell[][] = [];
  const walls: Cell[][] = [];
  const openings: Cell[][] = [];
  const wallSums: WallSum[] = [];
  const zoneSums: ZoneSum[] = [];
  const typeSums: OpeningTypeSum[] = [];

  let totalArea = 0;
  let totalPeople = 0;
  let roomCount = 0;
  let uncalibrated = 0;

  for (const { file, annotations } of filesData) {
    const calibrated = file.calibration !== null;
    if (!calibrated) uncalibrated++;
    const mpu = metersPerUnit(file.calibration);
    const items = joinPlacements(file.openings ?? [], file.placedOpenings ?? []);

    for (const annotation of annotations) {
      const name = displayName(annotation);

      // Saved lines are not part of the export.
      if (annotation.type === 'line') continue;

      roomCount++;
      const area = calibrated ? annotationArea(annotation) * mpu * mpu : null;
      if (area !== null) totalArea += area;
      totalPeople += annotation.people ?? 0;
      const template = annotation.roomTemplate;
      const roomItems = items.filter((it) => it.placement?.annotationId === annotation.id);
      const total = openingTotals(annotation.edges, roomItems);
      const wallTypes = [
        ...new Set((annotation.edges ?? []).filter((e) => e.wallType === 'external').map((e) => e.buildingComponent?.name).filter(Boolean)),
      ];
      const air = ventilationTotal(template?.ventilationRate, template?.ventilationUnit, area, annotation.people, template?.perPersonRate);

      rooms.push([
        file.name,
        annotation.roomNumber ?? null,
        name,
        template?.name ?? null,
        area === null ? null : round(area),
        calibrated ? round(polygonPerimeter(annotation.points) * mpu) : null,
        annotation.people ?? null,
        annotation.buildingComponent?.name ?? null,
        annotation.buildingComponent?.uValue ?? null,
        wallTypes.join(', ') || null,
        total.vindu.count || null,
        total.vindu.count ? round(total.vindu.area) : null,
        total.dor.count || null,
        total.dor.count ? round(total.dor.area) : null,
        openingNames(annotation.edges ?? [], roomItems, buildingTypes),
        template?.ventilationRate ?? null,
        template?.ventilationRate !== undefined
          ? VENTILATION_UNIT_LABELS[template.ventilationUnit ?? 'm3h_per_m2']
          : null,
        air === null ? null : round(air, 1),
      ]);

      const zone: ZoneSum = { file: file.name, roomNumber: annotation.roomNumber ?? null, room: name, outerCount: 0, outerLength: 0, outerArea: 0, hasHeight: false, allLength: calibrated ? polygonPerimeter(annotation.points) * mpu : null };
      if (calibrated) zoneSums.push(zone);

      (annotation.edges ?? []).forEach((edge, i) => {
        const a = annotation.points[i];
        const b = annotation.points[(i + 1) % annotation.points.length];
        const open = edge.openings ?? [];
        const placed = items.filter((it) => it.placement?.annotationId === annotation.id && it.placement.edgeIndex === i);
        const wall = openingTotals([edge], placed);
        const wallLength = calibrated && a && b ? distance(a, b) * mpu : null;
        const wallArea = wallLength !== null && edge.heightMeters ? wallLength * edge.heightMeters : null;
        // Only sides marked as outer walls are walls in the export: internal walls and unmarked sides
        // (e.g. where two zones meet) are left out. Windows/doors on them still appear in their own sheet.
        if (edge.wallType === 'external') walls.push([
          file.name,
          annotation.roomNumber ?? null,
          name,
          i + 1,
          calibrated && a && b ? round(distance(a, b) * mpu) : null,
          edge.heightMeters ?? null,
          wallArea === null ? null : round(wallArea),
          edge.buildingComponent?.name ?? null,
          edge.buildingComponent?.uValue ?? null,
          edge.buildingComponent?.wallThickness ?? null,
          edge.wallType === 'external' ? 'Yttervegg' : edge.wallType === 'internal' ? 'Innervegg' : null,
          bearingCell(wallBearing(annotation, i, project.northDirection)),
          wall.vindu.count || null,
          wall.vindu.count ? round(wall.vindu.area) : null,
          wall.dor.count || null,
          wall.dor.count ? round(wall.dor.area) : null,
          openingNames([edge], placed, buildingTypes),
        ]);
        if (edge.wallType === 'external' && wallLength !== null) {
          zone.outerCount++;
          zone.outerLength += wallLength;
          if (wallArea !== null) {
            zone.outerArea += wallArea;
            zone.hasHeight = true;
          }
        }
        if (edge.wallType === 'external' && calibrated && a && b) {
          wallSums.push({ file: file.name, roomKey: `${file.id}:${annotation.id}`, roomNumber: annotation.roomNumber ?? null, room: name, bearing: wallBearing(annotation, i, project.northDirection) ?? 0, length: distance(a, b) * mpu, area: wallArea, vindu: wall.vindu.area, dor: wall.dor.area, vinduCount: wall.vindu.count, dorCount: wall.dor.count });
        }

        for (const opening of open) {
          // Windows/doors added in the material picker have a name and an area, but no width/height.
          typeSums.push({
            file: file.name,
            kind: opening.component.category === 'vindu' ? 'Vindu' : 'Dør',
            name: opening.component.name,
            widthMm: null,
            heightMm: null,
            area: opening.area,
            typeName: opening.component.name,
            uValue: opening.component.uValue ?? null,
            bearing: wallBearing(annotation, i, project.northDirection) ?? null,
            roomKey: `${file.id}:${annotation.id}`,
            roomNumber: annotation.roomNumber ?? null,
            room: name,
          });
          openings.push([
            file.name,
            null,
            BUILDING_COMPONENT_CATEGORY_LABELS[opening.component.category],
            null,
            null,
            round(opening.area),
            opening.component.name,
            opening.component.uValue ?? null,
            annotation.roomNumber ?? null,
            name,
            i + 1,
            bearingCell(wallBearing(annotation, i, project.northDirection)),
          ]);
        }
      });
    }
  }

  for (const { file, annotations } of filesData) {
    const placedCopies = joinPlacements(file.openings ?? [], file.placedOpenings ?? []);
    for (const type of file.openings ?? []) {
      const typeRow = buildingTypes.find((t) => t.id === type.typeId);
      const area = openingArea(type);
      const placements = placedCopies.filter((it) => it.openingId === type.id);
      // One row per placed copy. A type that isn't placed anywhere has no wall, so it isn't listed.
      for (const item of placements) {
        const room = annotations.find((a) => a.id === item.placement.annotationId);
        typeSums.push({
          file: file.name,
          kind: OPENING_KIND_LABELS[type.kind],
          name: type.name,
          widthMm: type.widthMm ?? null,
          heightMm: type.heightMm ?? null,
          area: area ?? null,
          typeName: typeRow?.name ?? null,
          uValue: typeRow?.uValue ?? null,
          bearing: room ? (wallBearing(room, item.placement.edgeIndex, project.northDirection) ?? null) : null,
          roomKey: `${file.id}:${item.placement.annotationId}`,
          roomNumber: room?.roomNumber ?? null,
          room: room ? displayName(room) : null,
        });
        openings.push([
          file.name,
          type.name,
          OPENING_KIND_LABELS[type.kind],
          type.widthMm ?? null,
          type.heightMm ?? null,
          area === undefined ? null : round(area),
          typeRow?.name ?? null,
          typeRow?.uValue ?? null,
          room?.roomNumber ?? null,
          room ? displayName(room) : null,
          item.placement.edgeIndex + 1,
          room ? bearingCell(wallBearing(room, item.placement.edgeIndex, project.northDirection)) : null,
        ]);
      }
    }
  }

  const info: Cell[][] = [
    ['Prosjektnavn', project.name],
    ['Bygningsbeskrivelse', project.description ?? null],
    ['Bygningskategori', project.buildingCategory ? BUILDING_CATEGORY_LABELS[project.buildingCategory] : null],
    ['Byggeår', project.buildYear ?? null],
    ['Klimasted / kommune', project.climateLocation ?? null],
    ['Eksportert', new Date().toLocaleDateString('nb-NO')],
    ['Antall rom', roomCount],
    ['Totalt areal (m²)', round(totalArea)],
    ['Totalt antall personer', totalPeople],
    ['Filer uten kalibrering', uncalibrated ? `${uncalibrated} (mål mangler i arkene)` : 'Ingen'],
  ];

  return [
    { title: 'Prosjekt', headers: ['Felt', 'Verdi'], rows: info },
    {
      title: 'Rom',
      headers: [
        'Fil',
        'Nr',
        'Navn',
        'Romtype',
        'Areal (m²)',
        'Total vegglengde (m)',
        'Personer',
        'Gulv/dekke',
        'U-verdi gulv/dekke (W/m²K)',
        'Veggtyper',
        'Vindu (antall)',
        'Vindu (m²)',
        'Dør (antall)',
        'Dør (m²)',
        'Vinduer og dører (navn)',
        'Luftmengde (verdi)',
        'Luftmengde (enhet)',
        'Beregnet luftmengde (m³/h)',
      ],
      rows: rooms,
      groupBy: [0, 1, 2],
    },
    {
      title: 'Vegger',
      headers: [
        'Fil',
        'Rom nr',
        'Rom',
        'Vegg nr',
        'Lengde (m)',
        'Vegghøyde (m)',
        'Veggareal (m²)',
        'Veggtype',
        'U-verdi (W/m²K)',
        'Tykkelse (mm)',
        'Yttervegg/innervegg',
        'Himmelretning (°)',
        'Vindu (antall)',
        'Vindu (m²)',
        'Dør (antall)',
        'Dør (m²)',
        'Vinduer og dører (navn)',
      ],
      rows: walls,
      groupBy: [0, 1, 2],
      summaries: [wallSummary(wallSums), zoneSummary(zoneSums)].filter((t): t is NonNullable<typeof t> => t !== undefined),
    },
    {
      title: 'Vinduer og dører',
      headers: [
        'Fil',
        'Navn',
        'Vindu/dør',
        'Bredde (mm)',
        'Høyde (mm)',
        'Areal (m²)',
        'Byggedelstype',
        'U-verdi (W/m²K)',
        'Rom nr',
        'Rom',
        'Vegg nr',
        'Himmelretning (°)',
      ],
      rows: openings,
      groupBy: [0, 8, 9],
      summaries: [openingTypeSummary(typeSums)].filter((t): t is NonNullable<typeof t> => t !== undefined),
    },
  ];
}

type WallSum = {
  file: string;
  roomKey: string;
  roomNumber: string | null;
  room: string;
  bearing: number;
  length: number;
  area: number | null;
  vindu: number;
  dor: number;
  vinduCount: number;
  dorCount: number;
};

const roomLabel = (roomNumber: string | null, room: string | null) => [roomNumber, room].filter(Boolean).join(' ');

/** The direction of a wall in whole degrees, and the compass name that goes with it (the degrees are never rounded to the name). */
const degreesOfBearing = (bearing: number) => Math.round(bearing) % 360;
const nameOfDegrees = (degrees: number) => ORIENTATION_NAMES[compassPoint(degrees)];
const sortedDegrees = (list: number[]) => [...new Set(list)].sort((a, b) => a - b);

/**
 * Sums of the outer walls room by room; within each room one group per exact direction in degrees (not rounded to
 * north/east/…), with a sum row per room. Then the sums per exact direction over all rooms and a grand total.
 */
function wallSummary(walls: WallSum[]): ExportSummary | undefined {
  if (walls.length === 0) return undefined;
  const rows: Cell[][] = [];
  const styles: RowStyle[] = [];
  const add = (style: RowStyle, row: Cell[]) => {
    rows.push(row);
    styles.push(style);
  };
  let group = 0;
  const sums = (list: WallSum[]) => ({
    count: list.length,
    length: round(list.reduce((s, w) => s + w.length, 0)),
    area: list.some((w) => w.area !== null) ? round(list.reduce((s, w) => s + (w.area ?? 0), 0)) : null,
    vinduCount: list.reduce((s, w) => s + w.vinduCount, 0),
    vindu: round(list.reduce((s, w) => s + w.vindu, 0)),
    dorCount: list.reduce((s, w) => s + w.dorCount, 0),
    dor: round(list.reduce((s, w) => s + w.dor, 0)),
  });
  const numbers = (list: WallSum[]): Cell[] => {
    const sum = sums(list);
    return [sum.count, sum.length, sum.area, sum.vinduCount, sum.vindu, sum.dorCount, sum.dor];
  };
  const degreesIn = (list: WallSum[]) => sortedDegrees(list.map((w) => degreesOfBearing(w.bearing)));

  for (const roomKey of [...new Set(walls.map((w) => w.roomKey))]) {
    const inRoom = walls.filter((w) => w.roomKey === roomKey);
    for (const degrees of degreesIn(inRoom)) {
      const mine = inRoom.filter((w) => degreesOfBearing(w.bearing) === degrees);
      add(group % 2 ? 'detailAlt' : 'detail', [inRoom[0].file, inRoom[0].roomNumber, inRoom[0].room, nameOfDegrees(degrees), degrees, ...numbers(mine)]);
    }
    add('roomSum', [`Sum ${roomLabel(inRoom[0].roomNumber, inRoom[0].room)}`, null, null, null, null, ...numbers(inRoom)]);
    group++;
  }
  for (const degrees of degreesIn(walls)) {
    const mine = walls.filter((w) => degreesOfBearing(w.bearing) === degrees);
    add('groupSum', [`Sum ${degrees}°`, null, null, nameOfDegrees(degrees), degrees, ...numbers(mine)]);
  }
  add('total', ['Sum alle', null, null, null, null, ...numbers(walls)]);
  return {
    title: 'Oppsummering: yttervegger per rom og himmelretning (grader)',
    headers: ['Fil', 'Rom nr', 'Rom', 'Himmelretning', 'Grader (°)', 'Antall vegger', 'Total lengde (m)', 'Veggareal (m²)', 'Vindu (antall)', 'Vindu (m²)', 'Dør (antall)', 'Dør (m²)'],
    rows,
    styles,
  };
}

type ZoneSum = {
  file: string;
  roomNumber: string | null;
  room: string;
  outerCount: number;
  outerLength: number;
  outerArea: number;
  hasHeight: boolean;
  allLength: number | null;
};

/** Total wall length per zone (room/area): the outer walls and all sides, with a total row. */
function zoneSummary(zones: ZoneSum[]): ExportSummary | undefined {
  if (zones.length === 0) return undefined;
  const rows: Cell[][] = zones.map((z) => [
    z.file,
    z.roomNumber,
    z.room,
    z.outerCount || null,
    round(z.outerLength),
    z.hasHeight ? round(z.outerArea) : null,
    z.allLength === null ? null : round(z.allLength),
  ]);
  rows.push([
    'Sum',
    null,
    null,
    zones.reduce((s, z) => s + z.outerCount, 0),
    round(zones.reduce((s, z) => s + z.outerLength, 0)),
    round(zones.reduce((s, z) => s + z.outerArea, 0)),
    round(zones.reduce((s, z) => s + (z.allLength ?? 0), 0)),
  ]);
  return {
    title: 'Oppsummering: total vegglengde per sone',
    headers: ['Fil', 'Rom nr', 'Sone', 'Antall yttervegger', 'Total lengde yttervegger (m)', 'Veggareal yttervegger (m²)', 'Total vegglengde alle sider (m)'],
    rows,
    styles: rows.map((_, index): RowStyle => (index < zones.length ? (index % 2 ? 'detailAlt' : 'detail') : 'total')),
  };
}

/** One placed window/door with its wall's direction (null when the wall isn't an outer wall). */
type OpeningTypeSum = {
  file: string;
  kind: string;
  name: string;
  widthMm: number | null;
  heightMm: number | null;
  area: number | null;
  typeName: string | null;
  uValue: number | null;
  bearing: number | null;
  roomKey: string;
  roomNumber: string | null;
  room: string | null;
};

/**
 * How many windows/doors of each type there are, how big each one is and which way they face: room by room, within
 * each room per exact direction in degrees (not rounded to north/east/…) with one row per type (windows before
 * doors), a sum row per room, then the sums per exact direction over all rooms, per kind, and in total.
 */
function openingTypeSummary(items: OpeningTypeSum[]): ExportSummary | undefined {
  if (items.length === 0) return undefined;
  const rows: Cell[][] = [];
  const styles: RowStyle[] = [];
  const add = (style: RowStyle, row: Cell[]) => {
    rows.push(row);
    styles.push(style);
  };
  let group = 0;
  const area = (list: OpeningTypeSum[]) => round(list.reduce((s, t) => s + (t.area ?? 0), 0));
  const blank = (n: number) => Array<Cell>(n).fill(null);
  const degreesOf = (t: OpeningTypeSum) => (t.bearing === null ? null : degreesOfBearing(t.bearing));
  /** Exact directions in degrees, then null for windows/doors that are not on an outer wall. */
  const directionsIn = (list: OpeningTypeSum[]) => {
    const found = sortedDegrees(list.flatMap((t) => (degreesOf(t) === null ? [] : [degreesOf(t) as number])));
    return [...found, ...(list.some((t) => degreesOf(t) === null) ? [null] : [])] as (number | null)[];
  };
  const nameOf = (degrees: number | null) => (degrees === null ? 'Ikke på yttervegg' : nameOfDegrees(degrees));

  const byType = (list: OpeningTypeSum[]) => {
    const types = new Map<string, OpeningTypeSum[]>();
    for (const t of list) {
      const key = [t.file, t.kind, t.name, t.widthMm, t.heightMm, t.area, t.typeName].join('|');
      types.set(key, [...(types.get(key) ?? []), t]);
    }
    return [...types.values()].sort(
      (a, b) =>
        (a[0].kind === 'Vindu' ? 0 : 1) - (b[0].kind === 'Vindu' ? 0 : 1) ||
        a[0].file.localeCompare(b[0].file) ||
        a[0].name.localeCompare(b[0].name, 'nb', { numeric: true }),
    );
  };

  for (const roomKey of [...new Set(items.map((t) => t.roomKey))]) {
    const inRoom = items.filter((t) => t.roomKey === roomKey);
    for (const degrees of directionsIn(inRoom)) {
      for (const list of byType(inRoom.filter((t) => degreesOf(t) === degrees))) {
        const t = list[0];
        add(group % 2 ? 'detailAlt' : 'detail', [t.file, t.roomNumber, t.room, nameOf(degrees), degrees, t.name, t.kind, t.widthMm, t.heightMm, t.area === null ? null : round(t.area), t.typeName, t.uValue, list.length, area(list)]);
      }
    }
    add('roomSum', [`Sum ${roomLabel(inRoom[0].roomNumber, inRoom[0].room)}`, null, null, null, null, ...blank(7), inRoom.length, area(inRoom)]);
    group++;
  }
  for (const degrees of directionsIn(items)) {
    const mine = items.filter((t) => degreesOf(t) === degrees);
    add('groupSum', [degrees === null ? 'Sum ikke på yttervegg' : `Sum ${degrees}°`, null, null, degrees === null ? null : nameOf(degrees), degrees, ...blank(7), mine.length, area(mine)]);
  }
  for (const kind of ['Vindu', 'Dør']) {
    const mine = items.filter((t) => t.kind === kind);
    if (mine.length > 0) add('groupSum', [`Sum ${kind.toLowerCase()}`, ...blank(11), mine.length, area(mine)]);
  }
  add('total', ['Sum alle', ...blank(11), items.length, area(items)]);
  return {
    title: 'Oppsummering: vinduer og dører per rom, himmelretning (grader) og type',
    headers: ['Fil', 'Rom nr', 'Rom', 'Himmelretning', 'Grader (°)', 'Navn / type', 'Vindu/dør', 'Bredde (mm)', 'Høyde (mm)', 'Areal per stk (m²)', 'Byggedelstype', 'U-verdi (W/m²K)', 'Antall', 'Samlet areal (m²)'],
    rows,
    styles,
  };
}
