import { annotationArea, distance, polygonPerimeter } from '@/lib/geometry';
import { metersPerUnit } from '@/lib/calibration';
import { displayName } from '@/lib/annotationLabel';
import { joinPlacements, openingArea, OPENING_KIND_LABELS } from '@/lib/openings';
import { openingTotals } from '@/lib/wallOpenings';
import { ventilationTotal } from '@/lib/ventilation';
import { BUILDING_CATEGORY_LABELS, BUILDING_COMPONENT_CATEGORY_LABELS, VENTILATION_UNIT_LABELS } from '@/types';
import { compassPoint, ORIENTATION_NAMES, ORIENTATION_OPTIONS, orientationDegrees, wallBearing } from '@/lib/wallOrientation';
import type { Annotation, BuildingComponentType, EdgeMeta, OpeningItem, PdfFile, Project } from '@/types';

export type ExportFileData = { file: PdfFile; annotations: Annotation[] };

/** A spreadsheet cell: number, text, or empty. */
export type Cell = string | number | null;

export type ExportTable = {
  title: string;
  headers: string[];
  rows: Cell[][];
  /** Smaller tables written below the rows, one after the other (e.g. the sums per compass direction). */
  summaries?: { title: string; headers: string[]; rows: Cell[][] }[];
};

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
          wallSums.push({ file: file.name, roomKey: `${file.id}:${annotation.id}`, roomNumber: annotation.roomNumber ?? null, room: name, bearing: wallBearing(annotation, i, project.northDirection) ?? 0, length: distance(a, b) * mpu, area: wallArea, vindu: wall.vindu.area, dor: wall.dor.area });
        }

        for (const opening of open) {
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
};

/** Sums of the outer walls per compass direction (north first) and, within each, per room; with a sum row per direction and a total. */
function wallSummary(walls: WallSum[]): NonNullable<ExportTable['summaries']>[number] | undefined {
  const rows: Cell[][] = [];
  const total = { count: 0, length: 0, area: 0, vindu: 0, dor: 0 };
  const sums = (list: WallSum[]) => ({
    count: list.length,
    length: list.reduce((s, w) => s + w.length, 0),
    area: list.reduce((s, w) => s + (w.area ?? 0), 0),
    hasHeight: list.some((w) => w.area !== null),
    vindu: list.reduce((s, w) => s + w.vindu, 0),
    dor: list.reduce((s, w) => s + w.dor, 0),
  });

  for (const direction of ORIENTATION_OPTIONS) {
    const inDirection = walls.filter((w) => compassPoint(w.bearing) === direction);
    if (inDirection.length === 0) continue;
    const rooms = [...new Set(inDirection.map((w) => w.roomKey))];
    for (const key of rooms) {
      const mine = inDirection.filter((w) => w.roomKey === key);
      const sum = sums(mine);
      rows.push([
        ORIENTATION_NAMES[direction],
        [...new Set(mine.map((w) => Math.round(w.bearing) % 360))].sort((a, b) => a - b).join(', '),
        mine[0].file,
        mine[0].roomNumber,
        mine[0].room,
        sum.count,
        round(sum.length),
        sum.hasHeight ? round(sum.area) : null,
        round(sum.vindu),
        round(sum.dor),
      ]);
    }
    const sum = sums(inDirection);
    rows.push([`Sum ${ORIENTATION_NAMES[direction].toLowerCase()}`, orientationDegrees(direction), null, null, null, sum.count, round(sum.length), sum.hasHeight ? round(sum.area) : null, round(sum.vindu), round(sum.dor)]);
    total.count += sum.count;
    total.length += sum.length;
    total.area += sum.area;
    total.vindu += sum.vindu;
    total.dor += sum.dor;
  }
  if (rows.length === 0) return undefined;
  rows.push(['Sum alle', null, null, null, null, total.count, round(total.length), round(total.area), round(total.vindu), round(total.dor)]);
  return {
    title: 'Oppsummering: yttervegger per himmelretning og rom',
    headers: ['Himmelretning', 'Grader (°)', 'Fil', 'Rom nr', 'Rom', 'Antall vegger', 'Total lengde (m)', 'Veggareal (m²)', 'Vindu (m²)', 'Dør (m²)'],
    rows,
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
function zoneSummary(zones: ZoneSum[]): NonNullable<ExportTable['summaries']>[number] | undefined {
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
  };
}
