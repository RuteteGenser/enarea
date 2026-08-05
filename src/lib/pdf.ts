import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };
export type PdfDocumentProxy = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
export type PdfPageProxy = Awaited<ReturnType<PdfDocumentProxy['getPage']>>;

export async function loadPdfDocument(blob: Blob): Promise<PdfDocumentProxy> {
  const buffer = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  return loadingTask.promise;
}
