import { describe, expect, it } from 'vitest';
import { rotateAnnotationCw, rotateCalibrationCw, rotatePointCw } from '@/lib/rotateGeometry';
import type { Annotation } from '@/types';

describe('rotatePointCw', () => {
  it('moves the top-left corner to the top-right and the bottom-left to the top-left', () => {
    // page 200 wide, 100 tall → after the turn 100 wide, 200 tall
    expect(rotatePointCw({ x: 0, y: 0 }, 100)).toEqual({ x: 100, y: 0 });
    expect(rotatePointCw({ x: 0, y: 100 }, 100)).toEqual({ x: 0, y: 0 });
    expect(rotatePointCw({ x: 200, y: 100 }, 100)).toEqual({ x: 0, y: 200 });
  });

  it('four turns bring a point back', () => {
    let p = { x: 30, y: 70 };
    let [w, h] = [200, 100];
    for (let i = 0; i < 4; i++) {
      p = rotatePointCw(p, h);
      [w, h] = [h, w];
    }
    expect(p).toEqual({ x: 30, y: 70 });
  });
});

describe('rotating what is drawn', () => {
  it('turns points, regions, people and label together and keeps the area', () => {
    const area = {
      points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }, { x: 0, y: 20 }],
      regions: [[{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }]],
      personMarkers: [{ id: 'm', x: 5, y: 10 }],
      labelPos: { x: 5, y: 10 },
    } as unknown as Annotation;
    const out = rotateAnnotationCw(area, 100);
    expect(out.points[0]).toEqual({ x: 100, y: 0 });
    expect(out.points[2]).toEqual({ x: 80, y: 10 });
    expect(out.regions?.[0][0]).toEqual({ x: 99, y: 1 });
    expect(out.personMarkers?.[0]).toEqual({ id: 'm', x: 90, y: 5 });
    expect(out.labelPos).toEqual({ x: 90, y: 5 });
  });

  it('turns the calibration points and keeps the real length', () => {
    const cal = rotateCalibrationCw({ pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 0 }, realMeters: 3 }, 100);
    expect(cal).toEqual({ pointA: { x: 100, y: 0 }, pointB: { x: 100, y: 10 }, realMeters: 3 });
    expect(rotateCalibrationCw(null, 100)).toBeNull();
  });
});
