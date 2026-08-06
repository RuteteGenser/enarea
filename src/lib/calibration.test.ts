import { describe, expect, it } from 'vitest';
import { calibrationFromArea, formatArea, formatLength, isCalibrated, metersPerUnit } from '@/lib/calibration';

describe('metersPerUnit', () => {
  it('returns 1 when uncalibrated', () => {
    expect(metersPerUnit(null)).toBe(1);
  });

  it('computes meters per PDF-unit from a calibration line', () => {
    const calibration = { pointA: { x: 0, y: 0 }, pointB: { x: 200, y: 0 }, realMeters: 5 };
    expect(metersPerUnit(calibration)).toBe(0.025);
  });

  it('falls back to 1 when the calibration line has zero length', () => {
    const calibration = { pointA: { x: 5, y: 5 }, pointB: { x: 5, y: 5 }, realMeters: 5 };
    expect(metersPerUnit(calibration)).toBe(1);
  });
});

describe('calibrationFromArea', () => {
  it('derives meters-per-unit as the square root of the area ratio', () => {
    const square = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const calibration = calibrationFromArea(square, 25);
    expect(metersPerUnit(calibration)).toBeCloseTo(0.5, 10);
  });

  it('returns null for a degenerate (zero-area) polygon', () => {
    const collinear = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
    ];
    expect(calibrationFromArea(collinear, 25)).toBeNull();
  });

  it('returns null for fewer than 3 points', () => {
    expect(calibrationFromArea([{ x: 0, y: 0 }, { x: 1, y: 1 }], 25)).toBeNull();
  });
});

describe('isCalibrated', () => {
  it('is false for null', () => {
    expect(isCalibrated(null)).toBe(false);
  });

  it('is true for a calibration object', () => {
    expect(isCalibrated({ pointA: { x: 0, y: 0 }, pointB: { x: 1, y: 0 }, realMeters: 1 })).toBe(true);
  });
});

describe('formatLength', () => {
  it('formats meters with the unit suffix and 2 decimals of precision', () => {
    const result = formatLength(6.2, 'm');
    expect(result.endsWith('m')).toBe(true);
    expect(Number(result.replace(/[^\d,.-]/g, '').replace(',', '.'))).toBeCloseTo(6.2, 2);
  });

  it('converts meters to whole millimeters', () => {
    const result = formatLength(1.234, 'mm');
    expect(result.endsWith('mm')).toBe(true);
    expect(Number(result.replace(/\D/g, ''))).toBe(1234);
  });
});

describe('formatArea', () => {
  it('formats square meters with the m² suffix', () => {
    const result = formatArea(22.47, 'm');
    expect(result.endsWith('m²')).toBe(true);
    expect(Number(result.replace(/[^\d,.-]/g, '').replace(',', '.'))).toBeCloseTo(22.47, 2);
  });

  it('converts square meters to whole square millimeters', () => {
    const result = formatArea(0.5, 'mm');
    expect(result.endsWith('mm²')).toBe(true);
    expect(Number(result.replace(/\D/g, ''))).toBe(500000);
  });
});
