import { distance } from '@/lib/geometry';
import type { Calibration, Unit } from '@/types';

/** Meters per single PDF-native (unscaled) unit. Falls back to 1 (uncalibrated). */
export function metersPerUnit(calibration: Calibration): number {
  if (!calibration) return 1;
  const pdfDistance = distance(calibration.pointA, calibration.pointB);
  if (pdfDistance === 0) return 1;
  return calibration.realMeters / pdfDistance;
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
