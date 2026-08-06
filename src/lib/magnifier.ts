export type ScreenPoint = { x: number; y: number };
export type Rect = { left: number; top: number; width: number; height: number };

export function computeMagnifierCrop(
  screenPos: ScreenPoint,
  canvasRect: Rect,
  canvasPixelWidth: number,
  canvasPixelHeight: number,
  loupeSize: number,
  magnification: number,
): { sx: number; sy: number; sSize: number } {
  const scaleX = canvasPixelWidth / canvasRect.width;
  const scaleY = canvasPixelHeight / canvasRect.height;
  const canvasX = (screenPos.x - canvasRect.left) * scaleX;
  const canvasY = (screenPos.y - canvasRect.top) * scaleY;
  const cssCropSize = loupeSize / magnification;
  const sSize = cssCropSize * scaleX;
  return { sx: canvasX - sSize / 2, sy: canvasY - sSize / 2, sSize };
}

export function computeLoupePosition(
  screenPos: ScreenPoint,
  loupeSize: number,
  offsetX: number,
  offsetY: number,
  viewportWidth: number,
  viewportHeight: number,
): { left: number; top: number } {
  const desiredLeft = screenPos.x + offsetX;
  const desiredTop = screenPos.y - offsetY - loupeSize;
  const left = Math.min(Math.max(desiredLeft, 0), Math.max(0, viewportWidth - loupeSize));
  const top = Math.min(Math.max(desiredTop, 0), Math.max(0, viewportHeight - loupeSize));
  return { left, top };
}
