import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import type { PdfLayer } from '@/types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { pdfjsLib };
export type PdfDocumentProxy = Awaited<ReturnType<typeof pdfjsLib.getDocument>['promise']>;
export type PdfPageProxy = Awaited<ReturnType<PdfDocumentProxy['getPage']>>;
export type PdfOptionalContentConfig = Awaited<ReturnType<PdfDocumentProxy['getOptionalContentConfig']>>;

export async function loadPdfDocument(blob: Blob): Promise<PdfDocumentProxy> {
  const buffer = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  return loadingTask.promise;
}

/**
 * Resolves the document's Optional Content (layers) config and flattens it into
 * a typed list. Returns null when the PDF has no OCGs at all (getOrder() ===
 * null, common for scanned/flattened PDFs) — callers must treat null as "hide
 * the layers feature for this file".
 */
export async function detectPdfLayers(
  doc: PdfDocumentProxy,
): Promise<{ config: PdfOptionalContentConfig; layers: PdfLayer[] } | null> {
  const config = await doc.getOptionalContentConfig();
  const order = config.getOrder() as unknown;
  if (!Array.isArray(order) || order.length === 0) return null;

  const layers: PdfLayer[] = [];
  for (const id of order) {
    if (typeof id !== 'string') continue; // defensive: skip nested-group entries pdfjs's loose typings allow but weren't observed in practice
    const group = config.getGroup(id) as { name: string; visible: boolean } | null;
    if (!group) continue;
    layers.push({ id, name: group.name, visible: group.visible });
  }
  return layers.length > 0 ? { config, layers } : null;
}
