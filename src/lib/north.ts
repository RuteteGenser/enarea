import type { Point } from '@/types';

/** Direction of the line a → b as degrees clockwise from "up" (0–360); y points down, like on the screen and the drawing. */
export function bearingBetween(a: Point, b: Point): number {
  const deg = (Math.atan2(b.x - a.x, -(b.y - a.y)) * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}

/**
 * North on the drawing, as degrees clockwise from the drawing's "up" (what the compass shows), from the same
 * wall measured twice: `screenshotBearing` against north on a screenshot where north is up, and
 * `drawingBearing` as it points on the drawing.
 */
export function northFromWall(drawingBearing: number, screenshotBearing: number): number {
  return (((drawingBearing - screenshotBearing) % 360) + 360) % 360;
}
