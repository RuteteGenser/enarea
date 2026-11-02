import { describe, expect, it } from 'vitest';
import { PDFDocument, degrees } from 'pdf-lib';
import { exportProjectPdf } from '@/lib/pdfExport';
import type { Annotation, PdfFile, Project } from '@/types';

const project: Project = { id: 'p', name: 'Testbygg', northDirection: 0, createdAt: 1, updatedAt: 1 };

const room = {
  id: 'r',
  fileId: 'f',
  type: 'rectangle',
  points: [{ x: 50, y: 50 }, { x: 250, y: 50 }, { x: 250, y: 150 }, { x: 50, y: 150 }],
  edges: [{ wallType: 'external' }, {}, {}, {}],
  name: 'Kontor',
  roomNumber: '101',
  people: 2,
  roomTemplate: { id: 't', name: 'Kontorlandskap' },
  color: 'blue',
  visible: true,
  locked: false,
  createdAt: 0,
  updatedAt: 0,
} as unknown as Annotation;

async function file(rotation: number): Promise<PdfFile> {
  const doc = await PDFDocument.create();
  doc.addPage([400, 300]).setRotation(degrees(rotation));
  const bytes = await doc.save();
  return {
    id: 'f',
    projectId: 'p',
    name: 'Plan.pdf',
    order: 0,
    pdfBlob: new Blob([bytes as BlobPart]),
    calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realMeters: 10 },
    openings: [
      { id: 'o1', kind: 'vindu', name: 'Vindu 1', widthMm: 1200, heightMm: 1500 },
      { id: 'o2', kind: 'dor', name: 'Dør 1', widthMm: 900, heightMm: 2100 },
    ],
    placedOpenings: [
      { id: 'p1', openingId: 'o1', annotationId: 'r', edgeIndex: 0, t: 0.3 },
      { id: 'p2', openingId: 'o2', annotationId: 'r', edgeIndex: 0, t: 0.7 },
    ],
    createdAt: 0,
  } as PdfFile;
}

describe('exportProjectPdf with windows and doors', () => {
  for (const rotation of [0, 90, 180, 270]) {
    it(`draws them on a page rotated ${rotation}°`, async () => {
      const blob = await exportProjectPdf(project, [{ file: await file(rotation), annotations: [room] }], 'm', []);
      const out = await PDFDocument.load(await blob.arrayBuffer());
      expect(out.getPageCount()).toBe(2); // cover page + the drawing
      expect(out.getPage(1).getRotation().angle).toBe(rotation);
    });
  }
});
