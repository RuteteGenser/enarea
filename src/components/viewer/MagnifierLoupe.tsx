import { useLayoutEffect, useRef, type RefObject } from 'react';
import { computeLoupePosition, computeMagnifierCrop } from '@/lib/magnifier';
import { useViewportStore } from '@/store/viewportStore';

const LOUPE_SIZE = 150;
const MAGNIFICATION = 3;
const OFFSET = 24;

type MagnifierLoupeProps = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
};

export default function MagnifierLoupe({ canvasRef }: MagnifierLoupeProps) {
  const screenPos = useViewportStore((s) => s.magnifierScreenPos);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  // Layout effect: draw before paint so the loupe never shows a stale/blank frame.
  useLayoutEffect(() => {
    if (!screenPos) return;
    const mainCanvas = canvasRef.current;
    const loupeCanvas = loupeCanvasRef.current;
    if (!mainCanvas || !loupeCanvas) return;
    const ctx = loupeCanvas.getContext('2d');
    if (!ctx) return;

    const canvasRect = mainCanvas.getBoundingClientRect();
    const { sx, sy, sSize } = computeMagnifierCrop(
      screenPos,
      canvasRect,
      mainCanvas.width,
      mainCanvas.height,
      LOUPE_SIZE,
      MAGNIFICATION,
    );

    ctx.clearRect(0, 0, LOUPE_SIZE, LOUPE_SIZE);
    ctx.drawImage(mainCanvas, sx, sy, sSize, sSize, 0, 0, LOUPE_SIZE, LOUPE_SIZE);

    const center = LOUPE_SIZE / 2;
    ctx.strokeStyle = '#e11d48';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(center - 8, center);
    ctx.lineTo(center + 8, center);
    ctx.moveTo(center, center - 8);
    ctx.lineTo(center, center + 8);
    ctx.stroke();
  }, [screenPos, canvasRef]);

  // The canvas stays mounted (just hidden) so showing the loupe costs no element creation.
  const { left, top } = screenPos
    ? computeLoupePosition(screenPos, LOUPE_SIZE, OFFSET, OFFSET, window.innerWidth, window.innerHeight)
    : { left: 0, top: 0 };

  return (
    <canvas
      ref={loupeCanvasRef}
      width={LOUPE_SIZE}
      height={LOUPE_SIZE}
      className="pointer-events-none fixed z-50 rounded-full shadow-lg ring-2 ring-border"
      style={{ left, top, display: screenPos ? 'block' : 'none' }}
    />
  );
}
