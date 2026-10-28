import { cn } from '@/lib/utils';
import { useViewportStore } from '@/store/viewportStore';
import type { Unit } from '@/types';

const UNITS: Unit[] = ['m', 'mm'];

export default function UnitToggle() {
  const unit = useViewportStore((s) => s.calibrationUnit);
  const setUnit = useViewportStore((s) => s.setCalibrationUnit);

  return (
    <div title="Enhet for referanselinjen" className="flex h-8 items-center rounded-md bg-secondary p-0.5 text-xs font-medium">
      {UNITS.map((u) => (
        <button
          key={u}
          type="button"
          onClick={() => setUnit(u)}
          className={cn(
            'h-7 rounded-[5px] px-2.5 transition-colors',
            unit === u ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {u}
        </button>
      ))}
    </div>
  );
}
