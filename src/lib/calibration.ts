import { distance, polygonArea } from '@/lib/geometry';
import type { Calibration, Point, Unit } from '@/types';

/** Meters per single PDF-native (unscaled) unit. Falls back to 1 (uncalibrated). */
export function metersPerUnit(calibration: Calibration): number {
  if (!calibration) return 1;
  const pdfDistance = distance(calibration.pointA, calibration.pointB);
  if (pdfDistance === 0) return 1;
  return calibration.realMeters / pdfDistance;
}

// PDF-native units are points (72 per inch), a fixed physical size independent
// of on-screen zoom — the same unit baseWidth/baseHeight and annotation point
// coordinates are already stored in.
const POINTS_PER_INCH = 72;
const METERS_PER_INCH = 0.0254;

// Arbitrary reference distance (in PDF-native units) used to synthesize a
// two-point calibration from a pure scale ratio — the ratio is what matters,
// not which two points, since metersPerUnit only depends on realMeters/pdfDistance.
const REFERENCE_UNITS = 100;

/** Builds a Calibration equivalent to a known drawing scale (1:scale), with no drawn reference line. */
export function calibrationFromScale(scale: number): Calibration {
  const realMeters = (REFERENCE_UNITS / POINTS_PER_INCH) * METERS_PER_INCH * scale;
  return {
    pointA: { x: 0, y: 0 },
    pointB: { x: REFERENCE_UNITS, y: 0 },
    realMeters,
  };
}

/** Builds a Calibration from a drawn polygon's PDF-space area and its known real-world area. */
export function calibrationFromArea(points: Point[], realSquareMeters: number): Calibration {
  const pdfArea = polygonArea(points);
  if (pdfArea === 0) return null;
  const metersPerUnitValue = Math.sqrt(realSquareMeters / pdfArea);
  return {
    pointA: { x: 0, y: 0 },
    pointB: { x: REFERENCE_UNITS, y: 0 },
    realMeters: metersPerUnitValue * REFERENCE_UNITS,
  };
}

export function isCalibrated(calibration: Calibration): boolean {
  return calibration !== null;
}

export function formatLength(meters: number, unit: Unit): string {
  const value = unit === 'mm' ? meters * 1000 : meters;
  const decimals = unit === 'mm' ? 0 : 2;
  return `${value.toLocaleString('nb-NO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${unit}`;
}

export function formatArea(squareMeters: number, unit: Unit): string {
  if (unit === 'mm') {
    const value = squareMeters * 1_000_000;
    return `${value.toLocaleString('nb-NO', { maximumFractionDigits: 0 })} mm²`;
  }
  return `${squareMeters.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m²`;
}
