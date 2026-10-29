import { annotationArea, distance } from '@/lib/geometry';
import { metersPerUnit } from '@/lib/calibration';
import { displayName } from '@/lib/annotationLabel';
import { findAreaType } from '@/lib/areaTypes';
import { openingArea, OPENING_KIND_LABELS } from '@/lib/openings';
import { openingsSummary, totalOpeningArea } from '@/lib/wallOpenings';
import { BUILDING_CATEGORY_LABELS, BUILDING_COMPONENT_CATEGORY_LABELS, VENTILATION_UNIT_LABELS } from '@/types';
import type { Annotation, BuildingComponentType, OpeningItem, PdfFile, Project, VentilationUnit } from '@/types';

export type ExportFileData = { file: PdfFile; annotations: Annotation[] };

/** A spreadsheet cell: number, text, or empty. */
export type Cell = string | number | null;

export type ExportTable = { title: string; headers: string[]; rows: Cell[][] };

const ORIENTATION_LABELS = { N: 'Nord', S: 'Sør', E: 'Øst', W: 'Vest' } as const;

/** Air volume in m³/h when it can be derived from the room's area/people (otherwise null). */
export function ventilationTotal(
  rate: number | undefined,
  unit: VentilationUnit | undefined,
  squareMeters: number | null,
  people: number | undefined,
): number | null {
  if (rate === undefined) return null;
  switch (unit ?? 'm3h_per_m2') {
    case 'm3h_per_m2':
      return squareMeters === null ? null : rate * squareMeters;
    case 'm3h_per_person':
      return people ? rate * people : null;
    case 'm3h_total':
      return rate;
    default:
      return null; // per dusj / per toalettstol: the count isn't recorded
  }
}

const round = (value: number, decimals = 2) => Math.round(value * 10 ** decimals) / 10 ** decimals;

/**
 * Turns the project data into tables for the Excel export. Lengths are in m, areas in m²; they
 * are left empty for files that haven't been calibrated, since the numbers would be meaningless.
 */
export function buildExportTables(
  project: Project,
  filesData: ExportFileData[],
  types: BuildingComponentType[] = [],
): ExportTable[] {
  const rooms: Cell[][] = [];
  const walls: Cell[][] = [];
  const openings: Cell[][] = [];
  const lines: Cell[][] = [];

  let totalArea = 0;
  let totalPeople = 0;
  let roomCount = 0;
  let uncalibrated = 0;

  for (const { file, annotations } of filesData) {
    const calibrated = file.calibration !== null;
    if (!calibrated) uncalibrated++;
    const mpu = metersPerUnit(file.calibration);
    const items: OpeningItem[] = file.openings ?? [];

    for (const annotation of annotations) {
      const name = displayName(annotation);

      if (annotation.type === 'line') {
        lines.push([
          file.name,
          annotation.name?.trim() || null,
          calibrated ? round(distance(annotation.points[0], annotation.points[1]) * mpu) : null,
        ]);
        continue;
      }

      roomCount++;
      const area = calibrated ? annotationArea(annotation) * mpu * mpu : null;
      if (area !== null) totalArea += area;
      totalPeople += annotation.people ?? 0;
      const template = annotation.roomTemplate;
      const summary = openingsSummary(annotation, items);
      const wallTypes = [...new Set((annotation.edges ?? []).map((e) => e.buildingComponent?.name).filter(Boolean))];
      const air = ventilationTotal(template?.ventilationRate, template?.ventilationUnit, area, annotation.people);

      rooms.push([
        file.name,
        annotation.roomNumber ?? null,
        name,
        template?.name ?? null,
        area === null ? null : round(area),
        findAreaType(annotation.areaType)?.label ?? null,
        annotation.people ?? null,
        annotation.buildingComponent?.name ?? null,
        annotation.buildingComponent?.uValue ?? null,
        wallTypes.join(', ') || null,
        summary.count || null,
        summary.count ? round(summary.area) : null,
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
        const openCount = open.length + placed.length;
        const openArea = totalOpeningArea(edge) + placed.reduce((sum, it) => sum + (openingArea(it) ?? 0), 0);
        walls.push([
          file.name,
          annotation.roomNumber ?? null,
          name,
          i + 1,
          calibrated && a && b ? round(distance(a, b) * mpu) : null,
          edge.buildingComponent?.name ?? null,
          edge.buildingComponent?.uValue ?? null,
          edge.buildingComponent?.wallThickness ?? null,
          edge.wallType === 'external' ? 'Yttervegg' : edge.wallType === 'internal' ? 'Innervegg' : null,
          edge.orientation ? ORIENTATION_LABELS[edge.orientation] : null,
          openCount || null,
          openCount ? round(openArea) : null,
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
            edge.orientation ? ORIENTATION_LABELS[edge.orientation] : null,
          ]);
        }
      });
    }
  }

  for (const { file, annotations } of filesData) {
    for (const item of file.openings ?? []) {
      const type = types.find((t) => t.id === item.typeId);
      const room = item.placement ? annotations.find((a) => a.id === item.placement?.annotationId) : undefined;
      const edge = room && item.placement ? room.edges?.[item.placement.edgeIndex] : undefined;
      const area = openingArea(item);
      openings.push([
        file.name,
        item.name,
        OPENING_KIND_LABELS[item.kind],
        item.widthMm ?? null,
        item.heightMm ?? null,
        area === undefined ? null : round(area),
        type?.name ?? null,
        type?.uValue ?? null,
        room?.roomNumber ?? null,
        room ? displayName(room) : null,
        item.placement ? item.placement.edgeIndex + 1 : null,
        edge?.orientation ? ORIENTATION_LABELS[edge.orientation] : null,
      ]);
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
        'Arealtype',
        'Personer',
        'Gulv/dekke',
        'U-verdi gulv/dekke (W/m²K)',
        'Veggtyper',
        'Vindu/dør (antall)',
        'Vindu/dør (m²)',
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
        'Himmelretning',
        'Vindu/dør (antall)',
        'Vindu/dør (m²)',
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
        'Himmelretning',
      ],
      rows: openings,
    },
    { title: 'Linjer', headers: ['Fil', 'Navn', 'Lengde (m)'], rows: lines },
  ];
}
