import type { Point } from '@/types';

// Thin detail lines (door swings, furniture) are anti-aliased to light greys, so they must count as walls too;
// light grey room fills (~245 and above) stay open space.
const WALL_LUMINANCE_THRESHOLD = 238;
const MAX_FILL_PIXELS = 4_000_000;
const MIN_FILL_PIXELS = 100;
/** Detection runs at no more than this many pixels per PDF unit (see detectRoomPolygon). */
const MAX_DETECT_PIXELS_PER_UNIT = 3;
const SIMPLIFY_EPSILON_PX = 2.5;

/** 8 directions in clockwise order, starting at North. */
const DIRS: [number, number][] = [
  [0, -1],
  [1, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
];

function luminanceAt(data: Uint8ClampedArray, width: number, x: number, y: number): number {
  const i = (y * width + x) * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
}

/**
 * Flood-fills the enclosed light region containing (seedX, seedY), bounded by dark pixels
 * ("walls"). Returns null if the seed is on a wall, the fill touches the raster edge
 * (region not enclosed), or the region is implausibly large/small.
 */
function floodFillRoom(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  blocked?: Uint8Array,
): { visited: Uint8Array; minX: number; minY: number; maxX: number; maxY: number } | null {
  const { width, height, data } = imageData;
  if (seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) return null;
  if (luminanceAt(data, width, seedX, seedY) < WALL_LUMINANCE_THRESHOLD) return null;
  if (blocked && blocked[seedY * width + seedX]) return null;

  const visited = new Uint8Array(width * height);
  const stack: number[] = [seedY * width + seedX];
  visited[seedY * width + seedX] = 1;

  let filled = 0;
  let minX = seedX;
  let maxX = seedX;
  let minY = seedY;
  let maxY = seedY;
  let touchedEdge = false;

  while (stack.length > 0) {
    const idx = stack.pop()!;
    const py = Math.floor(idx / width);
    const px = idx - py * width;
    filled++;
    if (filled > MAX_FILL_PIXELS) return null;
    if (px === 0 || py === 0 || px === width - 1 || py === height - 1) touchedEdge = true;
    if (px < minX) minX = px;
    if (px > maxX) maxX = px;
    if (py < minY) minY = py;
    if (py > maxY) maxY = py;

    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nx = px + dx;
      const ny = py + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const nIdx = ny * width + nx;
      if (visited[nIdx]) continue;
      if (blocked && blocked[nIdx]) continue; // already marked: counts as a wall
      if (luminanceAt(data, width, nx, ny) < WALL_LUMINANCE_THRESHOLD) continue;
      visited[nIdx] = 1;
      stack.push(nIdx);
    }
  }

  if (touchedEdge || filled < MIN_FILL_PIXELS) return null;
  return { visited, minX, minY, maxX, maxY };
}

/** Moore-neighbor boundary tracing over a binary mask, starting from its topmost-leftmost pixel. */
function traceBoundary(
  visited: Uint8Array,
  width: number,
  height: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): Point[] | null {
  const isForeground = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && visited[y * width + x] === 1;

  let start: Point | null = null;
  for (let y = minY; y <= maxY && !start; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (isForeground(x, y)) {
        start = { x, y };
        break;
      }
    }
  }
  if (!start) return null;

  const boundary: Point[] = [start];
  let current = start;
  let backtrackDir = 6; // West is guaranteed background relative to the topmost-leftmost pixel.
  const maxSteps = (maxX - minX + 1) * (maxY - minY + 1) * 4 + 64;

  for (let steps = 0; steps < maxSteps; steps++) {
    let foundDir = -1;
    for (let i = 0; i < 8; i++) {
      const dir = (backtrackDir + i) % 8;
      const [dx, dy] = DIRS[dir];
      if (isForeground(current.x + dx, current.y + dy)) {
        foundDir = dir;
        break;
      }
    }
    if (foundDir === -1) break;

    const [dx, dy] = DIRS[foundDir];
    const next = { x: current.x + dx, y: current.y + dy };
    if (next.x === start.x && next.y === start.y) break;

    boundary.push(next);
    current = next;
    backtrackDir = (foundDir + 5) % 8;
  }

  return boundary;
}

function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

function douglasPeucker(points: Point[], epsilon: number): Point[] {
  if (points.length < 3) return points;
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;
  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }
  if (maxDist > epsilon) {
    const left = douglasPeucker(points.slice(0, index + 1), epsilon);
    const right = douglasPeucker(points.slice(index), epsilon);
    return [...left.slice(0, -1), ...right];
  }
  return [points[0], points[end]];
}

/** Simplifies a closed boundary loop and drops the near-duplicate seam point where it wraps. */
function simplifyClosedPolygon(boundary: Point[], epsilon: number): Point[] {
  const simplified = douglasPeucker(boundary, epsilon);
  if (simplified.length > 3) {
    const first = simplified[0];
    const last = simplified[simplified.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < epsilon) {
      simplified.pop();
    }
  }
  return simplified;
}

/**
 * Offsets a closed polygon outward by `dist` (miter join at each vertex).
 * traceBoundary walks through the *centers* of the outermost room pixels, not
 * their outer edges, so the raw traced polygon is systematically about half a
 * pixel short of the true wall-inner-face boundary on every side — this
 * corrects that bias. Winding-agnostic: it reads the polygon's own signed
 * area to pick the outward direction, so it works regardless of which way
 * traceBoundary happened to walk.
 */
function inflatePolygon(points: Point[], dist: number): Point[] {
  const n = points.length;
  if (n < 3) return points;

  let signedArea = 0;
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    signedArea += a.x * b.y - b.x * a.y;
  }
  const sign = signedArea >= 0 ? 1 : -1;

  function outwardNormal(a: Point, b: Point): Point {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { x: 0, y: 0 };
    return { x: (sign * dy) / len, y: (-sign * dx) / len };
  }

  return points.map((v, i) => {
    const prev = points[(i - 1 + n) % n];
    const next = points[(i + 1) % n];
    const n1 = outwardNormal(prev, v);
    const n2 = outwardNormal(v, next);
    let bisector = { x: n1.x + n2.x, y: n1.y + n2.y };
    const blen = Math.hypot(bisector.x, bisector.y);
    bisector = blen < 1e-9 ? n1 : { x: bisector.x / blen, y: bisector.y / blen };
    const cos = bisector.x * n1.x + bisector.y * n1.y;
    const miter = cos > 0.1 ? dist / cos : dist; // guard against extreme miters at very sharp/concave corners
    return { x: v.x + bisector.x * miter, y: v.y + bisector.y * miter };
  });
}

/**
 * Detects the enclosed room polygon containing (seedX, seedY) in raster pixel space, and
 * returns it converted to PDF-native coordinates (dividing by pixelsPerPdfUnit). Returns null
 * when the seed isn't inside a plausible enclosed room (on a wall, open to the page edge, or
 * too small/large).
 */
export function detectRoomPolygon(
  imageData: ImageData,
  seedX: number,
  seedY: number,
  pixelsPerPdfUnit: number,
  covered?: Point[][],
): Point[] | null {
  // Zoomed far in, tiny gaps between drawn lines (a door line that doesn't quite touch the wall) become
  // several pixels wide and the fill leaks through them — it never does when zoomed out. So the detection
  // always works at a limited resolution: a coarser copy where a block counts as wall if any pixel in it is.
  const factor = Math.max(1, Math.ceil(pixelsPerPdfUnit / MAX_DETECT_PIXELS_PER_UNIT));
  const image = factor > 1 ? downscaleWalls(imageData, factor) : imageData;
  const scale = pixelsPerPdfUnit / factor;
  const blocked = covered && covered.length > 0 ? coveredMask(covered, image.width, image.height, scale) : undefined;

  const fill = floodFillRoom(image, Math.round(seedX / factor), Math.round(seedY / factor), blocked);
  if (!fill) return null;

  const boundary = traceBoundary(fill.visited, image.width, image.height, fill.minX, fill.minY, fill.maxX, fill.maxY);
  if (!boundary || boundary.length < 3) return null;

  const simplified = simplifyClosedPolygon(boundary, SIMPLIFY_EPSILON_PX);
  if (simplified.length < 3) return null;

  // Half a pixel for tracing through pixel centres, and the block that walls grew by when coarsened.
  const corrected = inflatePolygon(simplified, factor > 1 ? 1 : 0.5);

  return corrected.map((p) => ({ x: p.x / scale, y: p.y / scale }));
}

/** Coarser copy of the image (blocks of `factor` px): the darkest pixel of each block wins, so thin lines and small gaps in them stay closed. */
function downscaleWalls(imageData: ImageData, factor: number): ImageData {
  const { width, height, data } = imageData;
  const w = Math.ceil(width / factor);
  const h = Math.ceil(height / factor);
  const out = new Uint8ClampedArray(w * h * 4);
  out.fill(255);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      let darkest = 255;
      const yEnd = Math.min(height, (by + 1) * factor);
      const xEnd = Math.min(width, (bx + 1) * factor);
      for (let y = by * factor; y < yEnd && darkest > 0; y++) {
        for (let x = bx * factor; x < xEnd; x++) {
          const l = luminanceAt(data, width, x, y);
          if (l < darkest) darkest = l;
        }
      }
      const i = (by * w + bx) * 4;
      out[i] = out[i + 1] = out[i + 2] = darkest;
      out[i + 3] = 255;
    }
  }
  return { width: w, height: h, data: out, colorSpace: 'srgb' } as ImageData;
}

/**
 * Mask (1 = covered) of areas that are already marked, in raster pixels, grown by one pixel so the next
 * detection stops just short of them: a new pick then only gets what is not marked yet, and nothing is
 * counted twice. `polygons` are in PDF units.
 */
export function coveredMask(polygons: Point[][], width: number, height: number, pixelsPerPdfUnit: number): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const poly of polygons) {
    if (poly.length >= 3) fillPolygonMask(mask, width, height, poly.map((p) => ({ x: p.x * pixelsPerPdfUnit, y: p.y * pixelsPerPdfUnit })));
  }
  return windowPass(windowPass(mask, width, height, 1, false, false), width, height, 1, true, false);
}

/** Scanline even-odd fill of a polygon (already in mask pixel coordinates) into the mask. */
function fillPolygonMask(mask: Uint8Array, width: number, height: number, poly: Point[]) {
  const n = poly.length;
  for (let y = 0; y < height; y++) {
    const yc = y + 0.5;
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % n];
      if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) {
        xs.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
      }
    }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) {
      const from = Math.max(0, Math.ceil(xs[i] - 0.5));
      const to = Math.min(width - 1, Math.floor(xs[i + 1] - 0.5));
      for (let x = from; x <= to; x++) mask[y * width + x] = 1;
    }
  }
}

/**
 * One separable pass of a square-window dilation (`erode` = false) or erosion (`erode` = true)
 * of radius r, using running sums so the cost doesn't depend on r. Out-of-range counts as 0.
 */
function windowPass(src: Uint8Array, width: number, height: number, r: number, vertical: boolean, erode: boolean) {
  const out = new Uint8Array(src.length);
  const lines = vertical ? width : height;
  const len = vertical ? height : width;
  const at = (line: number, i: number) => (vertical ? i * width + line : line * width + i);
  const need = erode ? 2 * r + 1 : 1;
  for (let line = 0; line < lines; line++) {
    let sum = 0;
    for (let i = 0; i < Math.min(r, len); i++) sum += src[at(line, i)];
    for (let i = 0; i < len; i++) {
      if (i + r < len) sum += src[at(line, i + r)];
      if (i - r - 1 >= 0) sum -= src[at(line, i - r - 1)];
      out[at(line, i)] = sum >= need ? 1 : 0;
    }
  }
  return out;
}

/** Morphological closing: fills gaps up to ~2r px wide between (and inside) the filled shapes. */
function closeMask(mask: Uint8Array, width: number, height: number, r: number) {
  let m = windowPass(mask, width, height, r, false, false);
  m = windowPass(m, width, height, r, true, false);
  m = windowPass(m, width, height, r, false, true);
  return windowPass(m, width, height, r, true, true);
}

const MAX_MERGE_MASK_PIXELS = 16_000_000;

/**
 * Merges the areas picked for one room into as few outlines as possible. Areas whose outlines are
 * separated only by a thin gap (<= `gapPdfUnits`, e.g. the detail line of a door swing) are joined
 * into one polygon that includes the gap; areas further apart stay separate polygons.
 * Works by filling all areas into one raster mask, closing the gaps, and tracing each blob.
 */
export function mergeRegions(regions: Point[][], pixelsPerPdfUnit: number, gapPdfUnits: number): Point[][] {
  if (regions.length < 2) return regions;

  const all = regions.flat();
  const minX = Math.min(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxX = Math.max(...all.map((p) => p.x));
  const maxY = Math.max(...all.map((p) => p.y));

  const r = Math.max(1, Math.ceil((gapPdfUnits * pixelsPerPdfUnit) / 2) + 1);
  const pad = 2 * r + 4;
  const width = Math.ceil((maxX - minX) * pixelsPerPdfUnit) + 2 * pad;
  const height = Math.ceil((maxY - minY) * pixelsPerPdfUnit) + 2 * pad;
  if (width * height > MAX_MERGE_MASK_PIXELS) return regions;

  const toPx = (p: Point): Point => ({ x: (p.x - minX) * pixelsPerPdfUnit + pad, y: (p.y - minY) * pixelsPerPdfUnit + pad });
  const toPdf = (p: Point): Point => ({ x: (p.x - pad) / pixelsPerPdfUnit + minX, y: (p.y - pad) / pixelsPerPdfUnit + minY });

  const filled = new Uint8Array(width * height);
  for (const region of regions) fillPolygonMask(filled, width, height, region.map(toPx));
  const closed = closeMask(filled, width, height, r);

  const seen = new Uint8Array(width * height);
  const result: Point[][] = [];
  for (let start = 0; start < closed.length; start++) {
    if (!closed[start] || seen[start]) continue;

    // Collect this blob into its own mask (4-connected).
    const blob = new Uint8Array(width * height);
    const stack = [start];
    seen[start] = 1;
    let bMinX = width;
    let bMinY = height;
    let bMaxX = 0;
    let bMaxY = 0;
    while (stack.length > 0) {
      const idx = stack.pop()!;
      blob[idx] = 1;
      const y = Math.floor(idx / width);
      const x = idx - y * width;
      if (x < bMinX) bMinX = x;
      if (x > bMaxX) bMaxX = x;
      if (y < bMinY) bMinY = y;
      if (y > bMaxY) bMaxY = y;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const n = ny * width + nx;
        if (!closed[n] || seen[n]) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }

    const boundary = traceBoundary(blob, width, height, bMinX, bMinY, bMaxX, bMaxY);
    if (!boundary || boundary.length < 3) continue;
    const simplified = simplifyClosedPolygon(boundary, SIMPLIFY_EPSILON_PX);
    if (simplified.length < 3) continue;
    result.push(inflatePolygon(simplified, 0.5).map(toPdf));
  }

  // Never lose what the user picked if the raster merge produced nothing usable.
  return result.length > 0 ? result : regions;
}
