import { annotationArea, distance, polygonPerimeter } from '@/lib/geometry';
import { metersPerUnit } from '@/lib/calibration';
import { displayName } from '@/lib/annotationLabel';
import { joinPlacements, openingArea, OPENING_KIND_LABELS } from '@/lib/openings';
import { openingTotals } from '@/lib/wallOpenings';
import { ventilationTotal } from '@/lib/ventilation';
import { BUILDING_CATEGORY_LABELS, BUILDING_COMPONENT_CATEGORY_LABELS, VENTILATION_UNIT_LABELS } from '@/types';
import { wallBearing } from '@/lib/wallOrientation';
import type { Annotation, BuildingComponentType, PdfFile, Project } from '@/types';

export type ExportFileData = { file: PdfFile; annotations: Annotation[] };

/** A spreadsheet cell: number, text, or empty. */
export type Cell = string | number | null;

export type ExportTable = { title: string; headers: string[]; rows: Cell[][] };

const bearingCell = (degrees: number | undefined): Cell => (degrees === undefined ? null : degrees);

export { ventilationTotal };

const round = (value: number, decimals = 2) => Math.round(value * 10 ** decimals) / 10 ** decimals;

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
        template?.ventilationRate ?? null,
        template?.ventilationRate !== undefined
          ? VENTILATION_UNIT_LABELS[template.ventilationUnit ?? 'm3h_per_m2']
          : null,
        air === null ? null : round(air, 1),
      ]);

      (annotation.edges ?? []).forEach((edge, i) => {
        const a = annotation.points[i];
        const b = annotation.points[(i + 1) % annotation.points.length];
        const open = edge.openings ?? [];
        const placed = items.filter((it) => it.placement?.annotationId === annotation.id && it.placement.edgeIndex === i);
        const wall = openingTotals([edge], placed);
        // Only sides marked as outer walls are walls in the export: internal walls and unmarked sides
        // (e.g. where two zones meet) are left out. Windows/doors on them still appear in their own sheet.
        if (edge.wallType === 'external') walls.push([
          file.name,
          annotation.roomNumber ?? null,
          name,
          i + 1,
          calibrated && a && b ? round(distance(a, b) * mpu) : null,
          edge.buildingComponent?.name ?? null,
          edge.buildingComponent?.uValue ?? null,
          edge.buildingComponent?.wallThickness ?? null,
          edge.wallType === 'external' ? 'Yttervegg' : edge.wallType === 'internal' ? 'Innervegg' : null,
          bearingCell(wallBearing(annotation, i, project.northDirection)),
          wall.vindu.count || null,
          wall.vindu.count ? round(wall.vindu.area) : null,
          wall.dor.count || null,
          wall.dor.count ? round(wall.dor.area) : null,
        ]);

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
        'Veggtype',
        'U-verdi (W/m²K)',
        'Tykkelse (mm)',
        'Yttervegg/innervegg',
        'Himmelretning (°)',
        'Vindu (antall)',
        'Vindu (m²)',
        'Dør (antall)',
        'Dør (m²)',
      ],
      rows: walls,
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
