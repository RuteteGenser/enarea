import type { Point } from '@/types';

const WALL_LUMINANCE_THRESHOLD = 200;
const MAX_FILL_PIXELS = 4_000_000;
const MIN_FILL_PIXELS = 100;
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
): { visited: Uint8Array; minX: number; minY: number; maxX: number; maxY: number } | null {
  const { width, height, data } = imageData;
  if (seedX < 0 || seedY < 0 || seedX >= width || seedY >= height) return null;
  if (luminanceAt(data, width, seedX, seedY) < WALL_LUMINANCE_THRESHOLD) return null;

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
): Point[] | null {
  const fill = floodFillRoom(imageData, Math.round(seedX), Math.round(seedY));
  if (!fill) return null;

  const boundary = traceBoundary(fill.visited, imageData.width, imageData.height, fill.minX, fill.minY, fill.maxX, fill.maxY);
  if (!boundary || boundary.length < 3) return null;

  const simplified = simplifyClosedPolygon(boundary, SIMPLIFY_EPSILON_PX);
  if (simplified.length < 3) return null;

  return simplified.map((p) => ({ x: p.x / pixelsPerPdfUnit, y: p.y / pixelsPerPdfUnit }));
}
