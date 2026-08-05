import { metersPerUnit } from '@/lib/calibration';
import { useViewportStore } from '@/store/viewportStore';
import type { Calibration } from '@/types';

const NICE_METERS = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];
const MIN_WIDTH_PX = 60;
const MAX_WIDTH_PX = 160;

type ScaleBarProps = {
  zoom: number;
  calibration: Calibration;
};

export default function ScaleBar({ zoom, calibration }: ScaleBarProps) {
  const unit = useViewportStore((s) => s.unit);
  if (!calibration) return null;

  const mpu = metersPerUnit(calibration);
  const pixelsPerMeter = mpu > 0 ? zoom / mpu : 0;
  if (!Number.isFinite(pixelsPerMeter) || pixelsPerMeter <= 0) return null;

  let meters = NICE_METERS[0];
  for (const candidate of NICE_METERS) {
    const width = candidate * pixelsPerMeter;
    if (width > MAX_WIDTH_PX) break;
    meters = candidate;
    if (width >= MIN_WIDTH_PX) break;
  }
  const widthPx = meters * pixelsPerMeter;

  const label = unit === 'mm' ? `${(meters * 1000).toLocaleString('nb-NO')} mm` : `${meters.toLocaleString('nb-NO')} m`;

  return (
    <div className="pointer-events-none absolute bottom-4 left-4 flex flex-col items-start gap-1 rounded-md bg-card/90 px-2.5 py-1.5 shadow-sm ring-1 ring-border">
      <div className="flex h-2.5 items-end" style={{ width: widthPx }}>
        <div className="h-1.5 w-full border-x border-t border-foreground/70" />
      </div>
      <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
    </div>
  );
}
