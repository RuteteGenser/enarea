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
  /** Index of the column with the direction in degrees: the row color alternates whenever the direction changes. */
  directionColumn?: number;
  /** Smaller tables written below the rows, one after the other (e.g. the sums per compass direction). */
  summaries?: ExportSummary[];
};

/**
 * How a summary row is colored. Detail rows and direction sums alternate between two colors (`band` 0 and 1), and
 * the color changes whenever the direction changes, so the directions are easy to tell apart.
 */
export type RowStyle = { kind: 'detail' | 'directionSum' | 'roomSum' | 'kindSum' | 'total'; band?: 0 | 1 };

/** Hands out 0, 1, 0, 1 … : the next band each time the value differs from the previous one. */
export function makeBander<T>(): (value: T) => 0 | 1 {
  let band: 0 | 1 = 1;
  let last: T | undefined;
  let started = false;
  return (value) => {
    if (!started || value !== last) {
      band = band === 0 ? 1 : 0;
      last = value;
      started = true;
    }
    return band;
  };
}

export type ExportSummary = { title: string; headers: string[]; rows: Cell[][]; styles?: RowStyle[] };

/**
 * Rooms/areas with the same name and the same number in the same file are one zone: the summaries add them up.
 * Lets a room be split into several areas (e.g. by ceiling height) that still count as one zone.
 */
const zoneKey = (fileId: string, a: { roomNumber?: string; name?: string } & Parameters<typeof displayName>[0]) =>
  [fileId, (a.roomNumber ?? '').trim().toLowerCase(), displayName(a).trim().toLowerCase()].join('|');

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
  const partitions: Cell[][] = [];
  const partitionSums: PartitionSum[] = [];
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

      // Luftvolum = floor area x the room's wall height (average of the walls that have a height set).
      const heights = (annotation.edges ?? []).map((e) => e.heightMeters).filter((h): h is number => !!h);
      const roomHeight = heights.length ? heights.reduce((sum, h) => sum + h, 0) / heights.length : null;
      const volume = area !== null && roomHeight !== null ? area * roomHeight : null;

      rooms.push([
        file.name,
        annotation.roomNumber ?? null,
        name,
        template?.name ?? null,
        area === null ? null : round(area),
        calibrated ? round(polygonPerimeter(annotation.points) * mpu) : null,
        volume === null ? null : round(volume),
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

      const zoneId = zoneKey(file.id, annotation);
      let zone = zoneSums.find((z) => z.key === zoneId);
      if (!zone) {
        zone = { key: zoneId, file: file.name, roomNumber: annotation.roomNumber ?? null, room: name, outerCount: 0, outerLength: 0, outerArea: 0, hasHeight: false, allLength: calibrated ? 0 : null, areas: 0, area: 0, volume: 0, hasVolume: false, people: 0 };
        if (calibrated) zoneSums.push(zone);
      }
      zone.areas++;
      zone.people += annotation.people ?? 0;
      if (calibrated) {
        zone.allLength = (zone.allLength ?? 0) + polygonPerimeter(annotation.points) * mpu;
        zone.area += area ?? 0;
        if (volume !== null) {
          zone.volume += volume;
          zone.hasVolume = true;
        }
      }

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
        // Skillekonstruksjoner (partition walls) get their own sheet, laid out like the outer walls but without direction.
        if (edge.wallType === 'partition') {
          partitions.push([
            file.name,
            annotation.roomNumber ?? null,
            name,
            i + 1,
            wallLength === null ? null : round(wallLength),
            edge.heightMeters ?? null,
            wallArea === null ? null : round(wallArea),
            edge.buildingComponent?.name ?? null,
            edge.buildingComponent?.uValue ?? null,
            edge.buildingComponent?.wallThickness ?? null,
            edge.temperature ?? null,
            wall.vindu.count || null,
            wall.vindu.count ? round(wall.vindu.area) : null,
            wall.dor.count || null,
            wall.dor.count ? round(wall.dor.area) : null,
            openingNames([edge], placed, buildingTypes),
          ]);
          if (wallLength !== null) {
            partitionSums.push({ file: file.name, roomKey: zoneKey(file.id, annotation), roomNumber: annotation.roomNumber ?? null, room: name, type: edge.buildingComponent?.name ?? null, uValue: edge.buildingComponent?.uValue ?? null, thickness: edge.buildingComponent?.wallThickness ?? null, length: wallLength, area: wallArea });
          }
        }
        if (edge.wallType === 'external' && wallLength !== null) {
          zone.outerCount++;
          zone.outerLength += wallLength;
          if (wallArea !== null) {
            zone.outerArea += wallArea;
            zone.hasHeight = true;
          }
        }
        if (edge.wallType === 'external' && calibrated && a && b) {
          wallSums.push({ file: file.name, roomKey: zoneKey(file.id, annotation), roomNumber: annotation.roomNumber ?? null, room: name, bearing: wallBearing(annotation, i, project.northDirection) ?? 0, length: distance(a, b) * mpu, area: wallArea, vindu: wall.vindu.area, dor: wall.dor.area, vinduCount: wall.vindu.count, dorCount: wall.dor.count });
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
            roomKey: zoneKey(file.id, annotation),
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
          roomKey: room ? zoneKey(file.id, room) : `${file.id}:${item.placement.annotationId}`,
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

  const partitionSheet: ExportTable[] = partitions.length === 0 ? [] : [
    {
      title: 'Skillekonstruksjoner',
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
        'Temperatur (°C)',
        'Vindu (antall)',
        'Vindu (m²)',
        'Dør (antall)',
        'Dør (m²)',
        'Vinduer og dører (navn)',
      ],
      rows: partitions,
      groupBy: [0, 1, 2],
      summaries: [partitionSummary(partitionSums)].filter((t): t is NonNullable<typeof t> => t !== undefined),
    },
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
        'Luftvolum (m³)',
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
      summaries: [zoneRoomSummary(zoneSums)].filter((t): t is NonNullable<typeof t> => t !== undefined),
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
      directionColumn: 11,
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
      directionColumn: 11,
      summaries: [openingTypeSummary(typeSums)].filter((t): t is NonNullable<typeof t> => t !== undefined),
    },
    ...partitionSheet,
  ];
}

type PartitionSum = {
  file: string;
  roomKey: string;
  roomNumber: string | null;
  room: string;
  type: string | null;
  uValue: number | null;
  thickness: number | null;
  length: number;
  area: number | null;
};

const NO_TYPE = 'Uten veggtype';

/**
 * Sums of the skillekonstruksjoner room by room (one row per wall type, a sum row per room), then the sums per
 * wall type over all rooms and a grand total. The same layout as the outer-wall summary, without compass directions.
 */
function partitionSummary(walls: PartitionSum[]): ExportSummary | undefined {
  if (walls.length === 0) return undefined;
  const rows: Cell[][] = [];
  const styles: RowStyle[] = [];
  const add = (style: RowStyle, row: Cell[]) => {
    rows.push(row);
    styles.push(style);
  };
  const roomBand = makeBander<string>();
  const typeBand = makeBander<string>();
  const typeKey = (w: PartitionSum) => [w.type, w.uValue, w.thickness].join('|');
  const typesIn = (list: PartitionSum[]) => {
    const groups = new Map<string, PartitionSum[]>();
    for (const w of list) groups.set(typeKey(w), [...(groups.get(typeKey(w)) ?? []), w]);
    return [...groups.values()].sort((a, b) => (a[0].type ?? '\uffff').localeCompare(b[0].type ?? '\uffff', 'nb', { numeric: true }));
  };
  const numbers = (list: PartitionSum[]): Cell[] => [
    list.length,
    round(list.reduce((s, w) => s + w.length, 0)),
    list.some((w) => w.area !== null) ? round(list.reduce((s, w) => s + (w.area ?? 0), 0)) : null,
  ];

  for (const roomKey of [...new Set(walls.map((w) => w.roomKey))]) {
    const inRoom = walls.filter((w) => w.roomKey === roomKey);
    for (const list of typesIn(inRoom)) {
      const w = list[0];
      add({ kind: 'detail', band: roomBand(roomKey) }, [w.file, w.roomNumber, w.room, w.type ?? NO_TYPE, w.uValue, w.thickness, ...numbers(list)]);
    }
    add({ kind: 'roomSum' }, [`Sum ${roomLabel(inRoom[0].roomNumber, inRoom[0].room)}`, null, null, null, null, null, ...numbers(inRoom)]);
  }
  for (const list of typesIn(walls)) {
    const w = list[0];
    add({ kind: 'directionSum', band: typeBand(typeKey(w)) }, [`Sum ${w.type ?? NO_TYPE}`, null, null, w.type ?? NO_TYPE, w.uValue, w.thickness, ...numbers(list)]);
  }
  add({ kind: 'total' }, ['Sum alle', null, null, null, null, null, ...numbers(walls)]);
  return {
    title: 'Oppsummering: skillekonstruksjoner per rom og veggtype',
    headers: ['Fil', 'Rom nr', 'Rom', 'Veggtype', 'U-verdi (W/m²K)', 'Tykkelse (mm)', 'Antall vegger', 'Total lengde (m)', 'Veggareal (m²)'],
    rows,
    styles,
  };
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
  const detailBand = makeBander<number>();
  const sumBand = makeBander<number>();
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
      add({ kind: 'detail', band: detailBand(degrees) }, [inRoom[0].file, inRoom[0].roomNumber, inRoom[0].room, nameOfDegrees(degrees), degrees, ...numbers(mine)]);
    }
    add({ kind: 'roomSum' }, [`Sum ${roomLabel(inRoom[0].roomNumber, inRoom[0].room)}`, null, null, null, null, ...numbers(inRoom)]);
  }
  for (const degrees of degreesIn(walls)) {
    const mine = walls.filter((w) => degreesOfBearing(w.bearing) === degrees);
    add({ kind: 'directionSum', band: sumBand(degrees) }, [`Sum ${degrees}°`, null, null, nameOfDegrees(degrees), degrees, ...numbers(mine)]);
  }
  add({ kind: 'total' }, ['Sum alle', null, null, null, null, ...numbers(walls)]);
  return {
    title: 'Oppsummering: yttervegger per rom og himmelretning (grader)',
    headers: ['Fil', 'Rom nr', 'Rom', 'Himmelretning', 'Grader (°)', 'Antall vegger', 'Total lengde (m)', 'Veggareal (m²)', 'Vindu (antall)', 'Vindu (m²)', 'Dør (antall)', 'Dør (m²)'],
    rows,
    styles,
  };
}

type ZoneSum = {
  key: string;
  /** How many areas (drawn shapes) make up the zone. */
  areas: number;
  area: number;
  volume: number;
  hasVolume: boolean;
  people: number;
  file: string;
  roomNumber: string | null;
  room: string;
  outerCount: number;
  outerLength: number;
  outerArea: number;
  hasHeight: boolean;
  allLength: number | null;
};

/** Area, air volume, people and wall length per zone: areas with the same name and number are added together. */
function zoneRoomSummary(zones: ZoneSum[]): ExportSummary | undefined {
  if (zones.length === 0) return undefined;
  const volume = (z: ZoneSum) => (z.hasVolume ? round(z.volume) : null);
  const rows: Cell[][] = zones.map((z) => [z.file, z.roomNumber, z.room, z.areas, round(z.area), volume(z), z.people || null, z.allLength === null ? null : round(z.allLength)]);
  rows.push([
    'Sum',
    null,
    null,
    zones.reduce((s, z) => s + z.areas, 0),
    round(zones.reduce((s, z) => s + z.area, 0)),
    zones.some((z) => z.hasVolume) ? round(zones.reduce((s, z) => s + z.volume, 0)) : null,
    zones.reduce((s, z) => s + z.people, 0) || null,
    round(zones.reduce((s, z) => s + (z.allLength ?? 0), 0)),
  ]);
  return {
    title: 'Oppsummering: areal og luftvolum per sone (samme navn og nr = samme sone)',
    headers: ['Fil', 'Rom nr', 'Sone', 'Antall delareal', 'Areal (m²)', 'Luftvolum (m³)', 'Personer', 'Total vegglengde alle sider (m)'],
    rows,
    styles: rows.map((_, index): RowStyle => ({ kind: index < zones.length ? 'detail' : 'total' })),
  };
}

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
    styles: rows.map((_, index): RowStyle => ({ kind: index < zones.length ? 'detail' : 'total' })),
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
  const detailBand = makeBander<number | null>();
  const sumBand = makeBander<number | null>();
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
        add({ kind: 'detail', band: detailBand(degrees) }, [t.file, t.roomNumber, t.room, nameOf(degrees), degrees, t.name, t.kind, t.widthMm, t.heightMm, t.area === null ? null : round(t.area), t.typeName, t.uValue, list.length, area(list)]);
      }
    }
    add({ kind: 'roomSum' }, [`Sum ${roomLabel(inRoom[0].roomNumber, inRoom[0].room)}`, null, null, null, null, ...blank(7), inRoom.length, area(inRoom)]);
  }
  for (const degrees of directionsIn(items)) {
    const mine = items.filter((t) => degreesOf(t) === degrees);
    add({ kind: 'directionSum', band: sumBand(degrees) }, [degrees === null ? 'Sum ikke på yttervegg' : `Sum ${degrees}°`, null, null, degrees === null ? null : nameOf(degrees), degrees, ...blank(7), mine.length, area(mine)]);
  }
  for (const kind of ['Vindu', 'Dør']) {
    const mine = items.filter((t) => t.kind === kind);
    if (mine.length > 0) add({ kind: 'kindSum' }, [`Sum ${kind.toLowerCase()}`, ...blank(11), mine.length, area(mine)]);
  }
  add({ kind: 'total' }, ['Sum alle', ...blank(11), items.length, area(items)]);
  return {
    title: 'Oppsummering: vinduer og dører per rom, himmelretning (grader) og type',
    headers: ['Fil', 'Rom nr', 'Rom', 'Himmelretning', 'Grader (°)', 'Navn / type', 'Vindu/dør', 'Bredde (mm)', 'Høyde (mm)', 'Areal per stk (m²)', 'Byggedelstype', 'U-verdi (W/m²K)', 'Antall', 'Samlet areal (m²)'],
    rows,
    styles,
  };
}
