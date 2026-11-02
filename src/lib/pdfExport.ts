import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { annotationArea, distance } from '@/lib/geometry';
import { formatArea, formatLength, metersPerUnit } from '@/lib/calibration';
import { displayName, TYPE_LABEL_NB } from '@/lib/annotationLabel';
import { joinPlacements, openingArea, OPENING_DEPTH_METERS, OPENING_KIND_LABELS, placedOpeningRect } from '@/lib/openings';
import { ANNOTATION_COLORS } from '@/types';
import type { Annotation, BuildingComponentType, PdfFile, Project, Unit } from '@/types';

export type ExportFileData = { file: PdfFile; annotations: Annotation[] };

const MARGIN = 50;
const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4 portrait, points

function hexToRgb01(hex: string) {
  const value = hex.replace('#', '');
  const r = parseInt(value.substring(0, 2), 16) / 255;
  const g = parseInt(value.substring(2, 4), 16) / 255;
  const b = parseInt(value.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
}

/** Without a calibration the numbers would be meaningless (PDF units taken for meters), so none are shown. */
const NOT_CALIBRATED_LABEL = 'ikke kalibrert';

function annotationValueLabel(annotation: Annotation, mpu: number, unit: Unit, calibrated: boolean): string {
  if (!calibrated) return NOT_CALIBRATED_LABEL;
  if (annotation.type === 'line') {
    return formatLength(distance(annotation.points[0], annotation.points[1]) * mpu, unit);
  }
  return formatArea(annotationArea(annotation) * mpu * mpu, unit);
}

function drawCoverPage(
  doc: PDFDocument,
  project: Project,
  filesData: ExportFileData[],
  unit: Unit,
  font: PDFFont,
  boldFont: PDFFont,
  buildingTypes: BuildingComponentType[],
): void {
  let page = doc.addPage(PAGE_SIZE);
  let [pageWidth, pageHeight] = [PAGE_SIZE[0], PAGE_SIZE[1]];
  let y = pageHeight - MARGIN;

  function newPage() {
    page = doc.addPage(PAGE_SIZE);
    [pageWidth, pageHeight] = [PAGE_SIZE[0], PAGE_SIZE[1]];
    y = pageHeight - MARGIN;
  }

  function ensureSpace(rowHeight: number) {
    if (y - rowHeight < MARGIN) newPage();
  }

  page.drawText('Enarea — Oppmålingsrapport', { x: MARGIN, y, size: 20, font: boldFont, color: rgb(0.1, 0.1, 0.12) });
  y -= 28;

  const dateLabel = new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' });
  page.drawText(`Prosjekt: ${project.name}`, { x: MARGIN, y, size: 12, font, color: rgb(0.25, 0.25, 0.28) });
  y -= 16;
  page.drawText(`Dato: ${dateLabel}`, { x: MARGIN, y, size: 12, font, color: rgb(0.25, 0.25, 0.28) });
  y -= 30;

  let grandTotalArea = 0;

  for (const { file, annotations } of filesData) {
    const visible = annotations.filter((a) => a.visible);
    if (visible.length === 0) continue;

    ensureSpace(50);
    page.drawText(file.name, { x: MARGIN, y, size: 13, font: boldFont, color: rgb(0.1, 0.1, 0.12) });
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: pageWidth - MARGIN, y },
      thickness: 0.75,
      color: rgb(0.85, 0.85, 0.87),
    });
    y -= 16;

    const mpu = metersPerUnit(file.calibration);
    const colWidths = { name: 220, type: 100, value: 130 };

    ensureSpace(16);
    page.drawText('Navn', { x: MARGIN, y, size: 9, font: boldFont, color: rgb(0.5, 0.5, 0.53) });
    page.drawText('Type', { x: MARGIN + colWidths.name, y, size: 9, font: boldFont, color: rgb(0.5, 0.5, 0.53) });
    page.drawText('Verdi', {
      x: MARGIN + colWidths.name + colWidths.type,
      y,
      size: 9,
      font: boldFont,
      color: rgb(0.5, 0.5, 0.53),
    });
    y -= 14;

    for (const annotation of visible) {
      ensureSpace(18);
      page.drawRectangle({
        x: MARGIN,
        y: y - 2,
        width: 8,
        height: 8,
        color: hexToRgb01(ANNOTATION_COLORS[annotation.color]),
      });
      page.drawText([annotation.roomNumber, displayName(annotation)].filter(Boolean).join(' '), {
        x: MARGIN + 14,
        y,
        size: 10,
        font,
        color: rgb(0.15, 0.15, 0.17),
      });
      page.drawText(TYPE_LABEL_NB[annotation.type], {
        x: MARGIN + colWidths.name,
        y,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.43),
      });
      page.drawText(annotationValueLabel(annotation, mpu, unit, file.calibration !== null), {
        x: MARGIN + colWidths.name + colWidths.type,
        y,
        size: 10,
        font,
        color: rgb(0.15, 0.15, 0.17),
      });
      y -= 16;

      // The details that go with the room: room type, people and floor/ceiling type.
      const details = [
        annotation.roomTemplate?.name,
        annotation.people ? `${annotation.people} ${annotation.people === 1 ? 'person' : 'personer'}` : undefined,
        annotation.buildingComponent?.name ? `Gulv/dekke: ${annotation.buildingComponent.name}` : undefined,
      ].filter(Boolean);
      if (annotation.type !== 'line' && details.length > 0) {
        ensureSpace(12);
        page.drawText(details.join('  ·  '), { x: MARGIN + 14, y: y + 3, size: 8, font, color: rgb(0.45, 0.45, 0.48) });
        y -= 10;
      }

      if (annotation.type !== 'line') {
        if (file.calibration) grandTotalArea += annotationArea(annotation) * mpu * mpu;
      }
    }
    y -= 14;

    // Windows and doors placed on the walls of this drawing.
    const placedOpenings = joinPlacements(file.openings ?? [], file.placedOpenings ?? []);
    if (placedOpenings.length > 0) {
      ensureSpace(40);
      page.drawText('Vinduer og dører', { x: MARGIN, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.12) });
      y -= 14;
      const cols = [MARGIN, MARGIN + 95, MARGIN + 175, MARGIN + 225, MARGIN + 355];
      ['Navn', 'Størrelse (mm)', 'Areal', 'Byggedelstype', 'Rom / vegg'].forEach((title, i) => {
        page.drawText(title, { x: cols[i], y, size: 9, font: boldFont, color: rgb(0.5, 0.5, 0.53) });
      });
      y -= 14;
      const totals = { vindu: { count: 0, area: 0 }, dor: { count: 0, area: 0 } };
      for (const item of placedOpenings) {
        ensureSpace(14);
        const area = openingArea(item);
        const room = annotations.find((a) => a.id === item.placement.annotationId);
        totals[item.kind].count++;
        totals[item.kind].area += area ?? 0;
        const cells = [
          item.name,
          item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm}` : '—',
          area === undefined ? '—' : formatArea(area, unit),
          buildingTypes.find((t) => t.id === item.typeId)?.name ?? '—',
          room ? `${[room.roomNumber, displayName(room)].filter(Boolean).join(' ')} · vegg ${item.placement.edgeIndex + 1}` : '—',
        ];
        cells.forEach((text, i) => {
          const maxWidth = (cols[i + 1] ?? pageWidth - MARGIN) - cols[i] - 6;
          let shown = text;
          while (shown.length > 1 && font.widthOfTextAtSize(shown, 9) > maxWidth) shown = shown.slice(0, -2);
          page.drawText(shown === text ? text : `${shown}…`, { x: cols[i], y, size: 9, font, color: rgb(0.15, 0.15, 0.17) });
        });
        y -= 13;
      }
      ensureSpace(16);
      const summary = (['vindu', 'dor'] as const)
        .filter((kind) => totals[kind].count > 0)
        .map((kind) => `${OPENING_KIND_LABELS[kind]}: ${totals[kind].count} stk, ${formatArea(totals[kind].area, unit)}`)
        .join('   ·   ');
      page.drawText(summary, { x: MARGIN, y, size: 9, font: boldFont, color: rgb(0.25, 0.25, 0.28) });
      y -= 22;
    }
  }

  ensureSpace(24);
  const skipped = filesData.filter(({ file, annotations }) => file.calibration === null && annotations.some((a) => a.visible)).length;
  const skippedNote = skipped > 0 ? `  (utenom ${skipped} ukalibrert${skipped === 1 ? '' : 'e'} tegning${skipped === 1 ? '' : 'er'})` : '';
  page.drawText(`Totalt areal: ${formatArea(grandTotalArea, unit)}${skippedNote}`, {
    x: MARGIN,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.12),
  });
}

function drawAnnotationsOnPage(page: PDFPage, annotations: Annotation[], font: PDFFont, unit: Unit, mpu: number, file: PdfFile): void {
  // Annotation coordinates are measured on the page as shown (y down). A rotated page (see "Roter PDF") has
  // its content stored turned, so shown positions are mapped back to the page's own coordinates.
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const rotation = (((page.getRotation().angle % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const flip = (x: number, y: number) => {
    switch (rotation) {
      case 90:
        return { x: y, y: x };
      case 180:
        return { x: pageWidth - x, y };
      case 270:
        return { x: pageWidth - y, y: pageHeight - x };
      default:
        return { x, y: pageHeight - y };
    }
  };

  for (const annotation of annotations) {
    if (!annotation.visible) continue;
    const color = hexToRgb01(ANNOTATION_COLORS[annotation.color]);
    const flipped = annotation.points.map((p) => flip(p.x, p.y));

    if (annotation.type === 'line') {
      page.drawLine({ start: flipped[0], end: flipped[1], thickness: 1, color });
    } else {
      const rings = [annotation.points, ...(annotation.regions ?? [])];
      for (const ring of rings) {
        const flippedRing = ring.map((p) => flip(p.x, p.y));
        for (let i = 0; i < flippedRing.length; i++) {
          const a = flippedRing[i];
          const b = flippedRing[(i + 1) % flippedRing.length];
          page.drawLine({ start: a, end: b, thickness: 1, color });
        }
      }
    }

    // The label sits at the middle of the shape, as seen on the page.
    const shown = annotation.points;
    const center = {
      x: shown.reduce((sum, p) => sum + p.x, 0) / shown.length,
      y: shown.reduce((sum, p) => sum + p.y, 0) / shown.length,
    };
    const valueLabel = annotationValueLabel(annotation, mpu, unit, file.calibration !== null);
    const title = [annotation.roomNumber, annotation.name].filter(Boolean).join(' ');
    const labelText = file.calibration === null ? title || valueLabel : title ? `${title}  ${valueLabel}` : valueLabel;
    const textWidth = font.widthOfTextAtSize(labelText, 9);
    const turn = degrees(rotation);
    page.drawRectangle({
      ...flip(center.x - textWidth / 2 - 4, center.y + 4),
      width: textWidth + 8,
      height: 13,
      color: rgb(1, 1, 1),
      rotate: turn,
    });
    page.drawText(labelText, {
      ...flip(center.x - textWidth / 2, center.y + 1),
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.12),
      rotate: turn,
    });
  }

  // Placed windows and doors: an outline on their wall (blue = window, brown = door) with the name beside it.
  if (file.calibration) {
    for (const item of joinPlacements(file.openings ?? [], file.placedOpenings ?? [])) {
      const rect = placedOpeningRect(item, annotations, mpu);
      if (!rect) continue;
      const color = item.kind === 'vindu' ? rgb(0.05, 0.45, 0.9) : rgb(0.6, 0.35, 0.1);
      const corners = rect.corners.map((p) => flip(p.x, p.y));
      for (let i = 0; i < corners.length; i++) {
        page.drawLine({ start: corners[i], end: corners[(i + 1) % corners.length], thickness: 1.2, color });
      }
      // The name is centred on the window/door, just outside it (on the side facing away from the room).
      const room = annotations.find((a) => a.id === item.placement.annotationId);
      const a = room?.points[item.placement.edgeIndex];
      const b = room?.points[(item.placement.edgeIndex + 1) % (room?.points.length ?? 1)];
      if (!room || !a || !b) continue;
      const edgeLength = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      let nx = -(b.y - a.y) / edgeLength;
      let ny = (b.x - a.x) / edgeLength;
      const inside = { x: room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length, y: room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length };
      if ((rect.center.x - inside.x) * nx + (rect.center.y - inside.y) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      const size = 6;
      const textWidth = font.widthOfTextAtSize(item.name, size);
      const depth = OPENING_DEPTH_METERS / mpu;
      const distance = depth / 2 + 3 + Math.abs(nx) * (textWidth / 2) + Math.abs(ny) * (size / 2);
      const middle = { x: rect.center.x + nx * distance, y: rect.center.y + ny * distance };
      page.drawText(item.name, {
        ...flip(middle.x - textWidth / 2, middle.y + size * 0.35),
        size,
        font,
        color,
        rotate: degrees(rotation),
      });
    }
  }
}

export async function exportProjectPdf(
  project: Project,
  filesData: ExportFileData[],
  unit: Unit,
  buildingTypes: BuildingComponentType[] = [],
): Promise<Blob> {
  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await outDoc.embedFont(StandardFonts.HelveticaBold);

  drawCoverPage(outDoc, project, filesData, unit, font, boldFont, buildingTypes);

  for (const { file, annotations } of filesData) {
    const srcBytes = await file.pdfBlob.arrayBuffer();
    const srcDoc = await PDFDocument.load(srcBytes);
    const [copiedPage] = await outDoc.copyPages(srcDoc, [0]);
    outDoc.addPage(copiedPage);
    const mpu = metersPerUnit(file.calibration);
    drawAnnotationsOnPage(copiedPage, annotations, font, unit, mpu, file);
  }

  const bytes = await outDoc.save({ useObjectStreams: true });
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
