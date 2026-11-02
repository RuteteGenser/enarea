import { PDFDocument, degrees } from 'pdf-lib';
import { loadPdfDocument } from '@/lib/pdf';
import { annotationsRepo } from '@/lib/db';
import { useAnnotationStore } from '@/store/annotationStore';
import { useFilesStore } from '@/store/filesStore';
import { useProjectStore } from '@/store/projectStore';
import { rotateAnnotationCw, rotateCalibrationCw } from '@/lib/rotateGeometry';
import type { Annotation, PdfFile } from '@/types';

/**
 * Rotates the PDF of a file by `quarterTurns` × 90° clockwise (negative = counter-clockwise). The rotation is
 * written into the stored PDF, and everything drawn on it (areas, people, the calibration, the compass of a
 * one-drawing project) is turned the same way, so it all still sits on the same spot of the drawing.
 */
export async function rotatePdf(file: PdfFile, quarterTurns: number): Promise<void> {
  const turns = ((quarterTurns % 4) + 4) % 4;
  if (turns === 0) return;

  // The size of the page as shown now, which is what the annotation coordinates are measured in.
  const shown = await loadPdfDocument(file.pdfBlob);
  const viewport = (await shown.getPage(1)).getViewport({ scale: 1 });
  let height = viewport.height;
  let width = viewport.width;

  const doc = await PDFDocument.load(await file.pdfBlob.arrayBuffer());
  const page = doc.getPage(0);
  page.setRotation(degrees((page.getRotation().angle + turns * 90) % 360));
  const blob = new Blob([(await doc.save()) as BlobPart], { type: 'application/pdf' });

  const annotationStore = useAnnotationStore.getState();
  let annotations: Annotation[] =
    annotationStore.fileId === file.id ? annotationStore.annotations : await annotationsRepo.listByFile(file.id);
  let calibration = file.calibration;
  for (let i = 0; i < turns; i++) {
    annotations = annotations.map((a) => rotateAnnotationCw(a, height));
    calibration = rotateCalibrationCw(calibration, height);
    [width, height] = [height, width];
  }

  await annotationsRepo.replaceAllForFile(file.id, annotations);
  if (annotationStore.fileId === file.id) useAnnotationStore.setState({ annotations, past: [], future: [] });
  await useFilesStore.getState().replacePdf(file.id, blob, calibration);

  // The compass points north on the drawing; if the drawing is the project's only one, it turns with it.
  const filesOfProject = useFilesStore.getState().filesByProject[file.projectId] ?? [];
  if (filesOfProject.length === 1) {
    const project = useProjectStore.getState().getProject(file.projectId);
    if (project) await useProjectStore.getState().updateNorthDirection(project.id, project.northDirection + turns * 90);
  }
}
