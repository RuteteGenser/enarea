import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { distance, polygonArea } from '@/lib/geometry';
import { formatArea, formatLength, metersPerUnit } from '@/lib/calibration';
import { displayName, TYPE_LABEL_NB } from '@/lib/annotationLabel';
import { ANNOTATION_COLORS } from '@/types';
import type { Annotation, PdfFile, Project, Unit } from '@/types';

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

function annotationValueLabel(annotation: Annotation, mpu: number, unit: Unit): string {
  if (annotation.type === 'line') {
    return formatLength(distance(annotation.points[0], annotation.points[1]) * mpu, unit);
  }
  return formatArea(polygonArea(annotation.points) * mpu * mpu, unit);
}

function drawCoverPage(
  doc: PDFDocument,
  project: Project,
  filesData: ExportFileData[],
  unit: Unit,
  font: PDFFont,
  boldFont: PDFFont,
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
      page.drawText(displayName(annotation), {
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
      page.drawText(annotationValueLabel(annotation, mpu, unit), {
        x: MARGIN + colWidths.name + colWidths.type,
        y,
        size: 10,
        font,
        color: rgb(0.15, 0.15, 0.17),
      });
      y -= 16;

      if (annotation.type !== 'line') {
        grandTotalArea += polygonArea(annotation.points) * mpu * mpu;
      }
    }
    y -= 14;
  }

  ensureSpace(24);
  page.drawText(`Totalt areal: ${formatArea(grandTotalArea, unit)}`, {
    x: MARGIN,
    y,
    size: 12,
    font: boldFont,
    color: rgb(0.1, 0.1, 0.12),
  });
}

function drawAnnotationsOnPage(page: PDFPage, annotations: Annotation[], font: PDFFont, unit: Unit, mpu: number): void {
  const { height: pageHeight } = page.getSize();
  const flip = (x: number, y: number) => ({ x, y: pageHeight - y });

  for (const annotation of annotations) {
    if (!annotation.visible) continue;
    const color = hexToRgb01(ANNOTATION_COLORS[annotation.color]);
    const flipped = annotation.points.map((p) => flip(p.x, p.y));

    if (annotation.type === 'line') {
      page.drawLine({ start: flipped[0], end: flipped[1], thickness: 1, color });
    } else {
      for (let i = 0; i < flipped.length; i++) {
        const a = flipped[i];
        const b = flipped[(i + 1) % flipped.length];
        page.drawLine({ start: a, end: b, thickness: 1, color });
      }
    }

    const centroid = flipped.reduce((acc, p) => ({ x: acc.x + p.x / flipped.length, y: acc.y + p.y / flipped.length }), {
      x: 0,
      y: 0,
    });
    const valueLabel = annotationValueLabel(annotation, mpu, unit);
    const labelText = annotation.name ? `${annotation.name}  ${valueLabel}` : valueLabel;
    const textWidth = font.widthOfTextAtSize(labelText, 9);
    page.drawRectangle({
      x: centroid.x - textWidth / 2 - 4,
      y: centroid.y - 4,
      width: textWidth + 8,
      height: 13,
      color: rgb(1, 1, 1),
    });
    page.drawText(labelText, { x: centroid.x - textWidth / 2, y: centroid.y - 1, size: 9, font, color: rgb(0.1, 0.1, 0.12) });
  }
}

export async function exportProjectPdf(project: Project, filesData: ExportFileData[], unit: Unit): Promise<Blob> {
  const outDoc = await PDFDocument.create();
  const font = await outDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await outDoc.embedFont(StandardFonts.HelveticaBold);

  drawCoverPage(outDoc, project, filesData, unit, font, boldFont);

  for (const { file, annotations } of filesData) {
    const srcBytes = await file.pdfBlob.arrayBuffer();
    const srcDoc = await PDFDocument.load(srcBytes);
    const [copiedPage] = await outDoc.copyPages(srcDoc, [0]);
    outDoc.addPage(copiedPage);
    const mpu = metersPerUnit(file.calibration);
    drawAnnotationsOnPage(copiedPage, annotations, font, unit, mpu);
  }

  const bytes = await outDoc.save({ useObjectStreams: true });
  return new Blob([bytes as BlobPart], { type: 'application/pdf' });
}
