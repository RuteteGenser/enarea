import type { Point } from '@/types';

/** A piece of text on the drawing, in page coordinates (origin top-left, y down), the same as annotation points. */
export type TextBox = { str: string; x: number; y: number; w: number; h: number };

export type RoomLabel = {
  name?: string;
  number?: string;
  /** Bounding box of the text the label was read from (for the hover highlight). */
  box: { x: number; y: number; w: number; h: number };
};

const AREA_TEXT = /\bm\s?[²2]\b|\bm\^2\b/i; // "12,5 m²" – a floor area, not a room name/number

/** "101", "A-101", "2.01", "1.12b": short, no spaces, has a digit. */
export function isRoomNumber(text: string): boolean {
  const t = text.trim();
  return t.length > 0 && t.length <= 8 && !/\s/.test(t) && /\d/.test(t) && !AREA_TEXT.test(t) && /^[\p{L}]{0,2}[-.]?\d+([.\-/]\d+)?[\p{L}]?$/u.test(t);
}

/** Text with at least two letters that is not just a number. */
export function isRoomName(text: string): boolean {
  const t = text.trim();
  return (t.match(/\p{L}/gu) ?? []).length >= 2 && !isRoomNumber(t) && !AREA_TEXT.test(t);
}

/** Splits one text such as "101 Møterom" or "Møterom 101" into number and name. */
function splitCombined(text: string): { number?: string; name?: string } {
  const parts = text.trim().split(/\s+/);
  if (parts.length < 2) return {};
  if (isRoomNumber(parts[0]) && isRoomName(parts.slice(1).join(' '))) return { number: parts[0], name: parts.slice(1).join(' ') };
  const last = parts[parts.length - 1];
  if (isRoomNumber(last) && isRoomName(parts.slice(0, -1).join(' '))) return { number: last, name: parts.slice(0, -1).join(' ') };
  return {};
}

const overlap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));

/** Are two text pieces part of the same label: stacked above each other, or side by side on one line? */
function related(a: TextBox, b: TextBox): boolean {
  const h = Math.min(a.h, b.h) || Math.max(a.h, b.h) || 1;
  const gapY = Math.max(0, Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h));
  const gapX = Math.max(0, Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w));

  const centersCloseX = Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)) <= Math.max(a.w, b.w) * 0.6 + h;
  const stacked = centersCloseX && gapY <= h * 1.8;

  const sameLine = overlap(a.y, a.y + a.h, b.y, b.y + b.h) >= h * 0.5 && gapX <= h * 2.5;
  return stacked || sameLine;
}

/**
 * Reads the room label at `click`: finds the text under the point, collects the text pieces next to it
 * (above/below or beside), and sorts them into a room number and a room name. `accept` can reject text
 * that belongs elsewhere (e.g. lies in another room).
 */
export function findRoomLabel(
  boxes: TextBox[],
  click: Point,
  accept: (box: TextBox) => boolean = () => true,
): RoomLabel | null {
  const texts = boxes.filter((b) => b.str.trim().length > 0);

  // The clicked text: the box containing the point, else the nearest one within a few text heights.
  let start: TextBox | null = null;
  let bestDist = Infinity;
  for (const b of texts) {
    const pad = Math.max(b.h * 0.4, 1.5);
    const dx = Math.max(b.x - pad - click.x, 0, click.x - (b.x + b.w + pad));
    const dy = Math.max(b.y - pad - click.y, 0, click.y - (b.y + b.h + pad));
    const d = Math.hypot(dx, dy);
    if (d < bestDist) {
      bestDist = d;
      start = b;
    }
  }
  if (!start || bestDist > 0 || !accept(start)) return null;

  // Grow the cluster of related text around the clicked piece (at most a handful of pieces).
  const cluster: TextBox[] = [start];
  for (let i = 0; i < cluster.length && cluster.length < 6; i++) {
    for (const b of texts) {
      if (cluster.includes(b) || cluster.length >= 6) continue;
      if (accept(b) && (isRoomNumber(b.str) || isRoomName(b.str) || splitCombined(b.str).name) && related(cluster[i], b)) cluster.push(b);
    }
  }

  // Reading order: top to bottom, then left to right.
  cluster.sort((a, b) => (Math.abs(a.y - b.y) < Math.min(a.h, b.h) * 0.5 ? a.x - b.x : a.y - b.y));

  let number: string | undefined;
  const names: string[] = [];
  for (const b of cluster) {
    const text = b.str.trim();
    const combined = splitCombined(text);
    if (combined.number && combined.name) {
      number ??= combined.number;
      names.push(combined.name);
    } else if (isRoomNumber(text)) {
      number ??= text;
    } else if (isRoomName(text)) {
      names.push(text);
    }
  }
  const name = names.join(' ').replace(/\s+/g, ' ').trim() || undefined;
  if (!name && !number) return null;

  const used = cluster.filter((b) => isRoomNumber(b.str) || isRoomName(b.str) || splitCombined(b.str).name);
  const x0 = Math.min(...used.map((b) => b.x));
  const y0 = Math.min(...used.map((b) => b.y));
  const x1 = Math.max(...used.map((b) => b.x + b.w));
  const y1 = Math.max(...used.map((b) => b.y + b.h));
  return { name, number, box: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } };
}
