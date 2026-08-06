import { describe, expect, it } from 'vitest';
import { computeLoupePosition, computeMagnifierCrop } from '@/lib/magnifier';

describe('computeMagnifierCrop', () => {
  it('centers the crop on the cursor when canvas pixels match CSS pixels 1:1', () => {
    const screenPos = { x: 150, y: 100 };
    const canvasRect = { left: 50, top: 50, width: 400, height: 300 };
    // Cursor is at canvas-local CSS point (100, 50).
    const crop = computeMagnifierCrop(screenPos, canvasRect, 400, 300, 150, 3);
    // cssCropSize = 150 / 3 = 50; scale = 1 (400/400); sSize = 50.
    expect(crop.sSize).toBeCloseTo(50, 5);
    expect(crop.sx).toBeCloseTo(100 - 25, 5); // canvasX - sSize/2
    expect(crop.sy).toBeCloseTo(50 - 25, 5);
  });

  it('scales the crop size when the canvas backing store is higher-resolution than its CSS size', () => {
    const screenPos = { x: 100, y: 100 };
    const canvasRect = { left: 0, top: 0, width: 400, height: 300 };
    // Backing store is 2x CSS size (e.g. supersampled render).
    const crop = computeMagnifierCrop(screenPos, canvasRect, 800, 600, 150, 3);
    // scale = 800/400 = 2; cssCropSize = 50; sSize = 50 * 2 = 100.
    expect(crop.sSize).toBeCloseTo(100, 5);
    // canvasX = (100-0)*2 = 200; sx = 200 - 100/2 = 150.
    expect(crop.sx).toBeCloseTo(150, 5);
    expect(crop.sy).toBeCloseTo(150, 5);
  });
});

describe('computeLoupePosition', () => {
  it('offsets the loupe up and to the right of the cursor when there is room', () => {
    const pos = computeLoupePosition({ x: 500, y: 500 }, 150, 24, 24, 1920, 1080);
    // left = 500 + 24 = 524; top = 500 - 24 - 150 = 326.
    expect(pos.left).toBeCloseTo(524, 5);
    expect(pos.top).toBeCloseTo(326, 5);
  });

  it('clamps to stay on-screen near the top-left corner', () => {
    const pos = computeLoupePosition({ x: 5, y: 5 }, 150, 24, 24, 1920, 1080);
    expect(pos.left).toBeGreaterThanOrEqual(0);
    expect(pos.top).toBeGreaterThanOrEqual(0);
  });

  it('clamps to stay on-screen near the bottom-right corner', () => {
    const pos = computeLoupePosition({ x: 1918, y: 1078 }, 150, 24, 24, 1920, 1080);
    expect(pos.left).toBeLessThanOrEqual(1920 - 150);
    expect(pos.top).toBeLessThanOrEqual(1080 - 150);
  });
});
