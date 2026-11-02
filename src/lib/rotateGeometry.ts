import type { Annotation, Calibration, Point } from '@/types';

/** One quarter turn clockwise of a point on a page that is `height` tall (y down): the page becomes `height` wide. */
export function rotatePointCw(p: Point, height: number): Point {
  return { x: height - p.y, y: p.x };
}

/** Turns all the geometry of an annotation a quarter turn clockwise together with the page. */
export function rotateAnnotationCw(annotation: Annotation, height: number): Annotation {
  const r = (p: Point) => rotatePointCw(p, height);
  return {
    ...annotation,
    points: annotation.points.map(r),
    regions: annotation.regions?.map((ring) => ring.map(r)),
    personMarkers: annotation.personMarkers?.map((m) => ({ ...m, ...r(m) })),
    labelPos: annotation.labelPos ? r(annotation.labelPos) : undefined,
  };
}

export function rotateCalibrationCw(calibration: Calibration, height: number): Calibration {
  return calibration
    ? { ...calibration, pointA: rotatePointCw(calibration.pointA, height), pointB: rotatePointCw(calibration.pointB, height) }
    : null;
}
