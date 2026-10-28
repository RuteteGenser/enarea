import { describe, expect, it } from 'vitest';
import { detectRoomPolygon, mergeRegions } from '@/lib/roomDetection';
import { polygonArea } from '@/lib/geometry';

function makeCanvasImage(width: number, height: number): { data: Uint8ClampedArray; setPixel: (x: number, y: number, dark: boolean) => void } {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(255); // white background, opaque
  function setPixel(x: number, y: number, dark: boolean) {
    const i = (y * width + x) * 4;
    const v = dark ? 0 : 255;
    data[i] = v;
    data[i + 1] = v;
    data[i + 2] = v;
    data[i + 3] = 255;
  }
  return { data, setPixel };
}

function toImageData(width: number, height: number, data: Uint8ClampedArray): ImageData {
  return { width, height, data, colorSpace: 'srgb' } as ImageData;
}

/** Draws a 1px-thick rectangular wall outline (inclusive bounds) into the image. */
function drawRectWalls(setPixel: (x: number, y: number, dark: boolean) => void, x0: number, y0: number, x1: number, y1: number) {
  for (let x = x0; x <= x1; x++) {
    setPixel(x, y0, true);
    setPixel(x, y1, true);
  }
  for (let y = y0; y <= y1; y++) {
    setPixel(x0, y, true);
    setPixel(x1, y, true);
  }
}

describe('detectRoomPolygon', () => {
  it('traces the interior of an enclosed rectangular room', () => {
    const width = 50;
    const height = 50;
    const { data, setPixel } = makeCanvasImage(width, height);
    drawRectWalls(setPixel, 10, 10, 39, 34);
    const imageData = toImageData(width, height, data);

    const result = detectRoomPolygon(imageData, 25, 22, 1);

    expect(result).not.toBeNull();
    expect(result!.length).toBe(4);
    // Walls occupy x=10, x=39, y=10, y=34; the true open interior spans the
    // full pixels 11..38 (28px) by 11..33 (23px) — i.e. up to each wall's
    // inner *edge*, not just to the center of the innermost open pixel.
    expect(polygonArea(result!)).toBeCloseTo(28 * 23, 0);
  });

  it('returns null when the seed point is on a wall', () => {
    const width = 50;
    const height = 50;
    const { data, setPixel } = makeCanvasImage(width, height);
    drawRectWalls(setPixel, 10, 10, 39, 34);
    const imageData = toImageData(width, height, data);

    expect(detectRoomPolygon(imageData, 10, 20, 1)).toBeNull();
  });

  it('returns null when the open region reaches the raster edge (not enclosed)', () => {
    const width = 50;
    const height = 50;
    const { data, setPixel } = makeCanvasImage(width, height);
    // Only 3 sides walled — the region is open to the right, so flood fill reaches the edge.
    for (let x = 10; x <= 39; x++) setPixel(x, 10, true);
    for (let y = 10; y <= 34; y++) setPixel(10, y, true);
    for (let x = 10; x <= 39; x++) setPixel(x, 34, true);
    const imageData = toImageData(width, height, data);

    expect(detectRoomPolygon(imageData, 25, 22, 1)).toBeNull();
  });

  it('converts pixel coordinates to PDF-space using pixelsPerPdfUnit', () => {
    const width = 50;
    const height = 50;
    const { data, setPixel } = makeCanvasImage(width, height);
    drawRectWalls(setPixel, 10, 10, 39, 34);
    const imageData = toImageData(width, height, data);

    const atScale1 = detectRoomPolygon(imageData, 25, 22, 1)!;
    const atScale2 = detectRoomPolygon(imageData, 25, 22, 2)!;

    expect(polygonArea(atScale2)).toBeCloseTo(polygonArea(atScale1) / 4, 0);
  });
});

describe('mergeRegions', () => {
  const rect = (x0: number, y0: number, x1: number, y1: number) => [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];

  it('joins two areas separated by a thin line into one polygon including the gap', () => {
    const merged = mergeRegions([rect(0, 0, 100, 100), rect(102, 0, 200, 100)], 1, 4);
    expect(merged).toHaveLength(1);
    expect(Math.abs(polygonArea(merged[0]))).toBeGreaterThan(19500);
    expect(Math.abs(polygonArea(merged[0]))).toBeLessThan(20500);
  });

  it('keeps areas that are far apart as separate polygons', () => {
    const merged = mergeRegions([rect(0, 0, 100, 100), rect(140, 0, 240, 100)], 1, 4);
    expect(merged).toHaveLength(2);
  });

  it('joins a curved door-swing sector to the room across a thin arc', () => {
    // Sector of radius 60 centered at (0,0) in the room's corner, room wraps around it 2px away.
    const sector = [{ x: 0, y: 0 }];
    for (let a = 0; a <= 90; a += 5) {
      const rad = (a * Math.PI) / 180;
      sector.push({ x: 60 * Math.cos(rad), y: 60 * Math.sin(rad) });
    }
    const room = [
      { x: 0, y: 63 },
      { x: 63, y: 0 },
      { x: 200, y: 0 },
      { x: 200, y: 200 },
      { x: 0, y: 200 },
    ];
    const merged = mergeRegions([room, sector], 1, 4);
    expect(merged).toHaveLength(1);
  });

  it('returns a single area unchanged', () => {
    const only = rect(0, 0, 50, 50);
    expect(mergeRegions([only], 1, 4)).toEqual([only]);
  });
});
