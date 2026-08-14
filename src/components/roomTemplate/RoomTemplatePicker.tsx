import { useEffect, useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRoomTemplateStore } from '@/store/roomTemplateStore';
import { toRoomTemplateAssignment } from '@/lib/roomTemplateMatch';
import { VENTILATION_UNIT_LABELS } from '@/types';
import type { RoomTemplate, RoomTemplateAssignment, VentilationUnit } from '@/types';

const VENTILATION_UNITS = Object.keys(VENTILATION_UNIT_LABELS) as VentilationUnit[];
const DEFAULT_UNIT: VentilationUnit = 'm3h_per_m2';

type RoomTemplatePickerProps = {
  current?: RoomTemplateAssignment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (assignment: RoomTemplateAssignment | null) => void;
  children: React.ReactNode;
};

function ventilationLabel(rate?: number, unit?: VentilationUnit): string | undefined {
  if (rate === undefined) return undefined;
  return `${rate} ${VENTILATION_UNIT_LABELS[unit ?? DEFAULT_UNIT]}`;
}

export default function RoomTemplatePicker({ current, open, onOpenChange, onSelect, children }: RoomTemplatePickerProps) {
  const templates = useRoomTemplateStore((s) => s.templates);
  const createTemplate = useRoomTemplateStore((s) => s.createTemplate);
  const loaded = useRoomTemplateStore((s) => s.loaded);
  const loadTemplates = useRoomTemplateStore((s) => s.loadTemplates);

  useEffect(() => {
    if (!loaded) void loadTemplates();
  }, [loaded, loadTemplates]);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState<VentilationUnit>(DEFAULT_UNIT);

  const trimmedRate = rate.trim();
  const parsedRate = trimmedRate ? Number(trimmedRate.replace(',', '.')) : undefined;
  const rateValid = parsedRate === undefined || (Number.isFinite(parsedRate) && parsedRate > 0);
  const canSubmit = name.trim().length > 0 && rateValid;

  function resetForm() {
    setName('');
    setRate('');
    setUnit(DEFAULT_UNIT);
    setAdding(false);
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  async function handleCreate() {
    if (!canSubmit) return;
    const created = await createTemplate(name.trim(), parsedRate, parsedRate !== undefined ? unit : undefined);
    onSelect(toRoomTemplateAssignment(created, 'manual'));
    resetForm();
    onOpenChange(false);
  }

  function select(template: RoomTemplate) {
    onSelect(toRoomTemplateAssignment(template, 'manual'));
    onOpenChange(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-2">
        {!adding ? (
          <>
            <div className="max-h-64 overflow-y-auto">
              {templates.length === 0 && <div className="px-1 py-1 text-xs text-muted-foreground">Ingen romtyper ennå.</div>}
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => select(template)}
                  className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm hover:bg-secondary"
                >
                  <span className="truncate">{template.name}</span>
                  <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {ventilationLabel(template.ventilationRate, template.ventilationUnit)}
                    {current?.templateId === template.id && <Check className="size-3.5 text-primary" />}
                  </span>
                </button>
              ))}
            </div>

            {current && (
              <button
                type="button"
                onClick={() => {
                  onSelect(null);
                  onOpenChange(false);
                }}
                className="mt-1 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-secondary"
              >
                <X className="size-3.5" /> Fjern merking
              </button>
            )}

            <Button variant="ghost" size="sm" className="mt-1 w-full justify-start" onClick={() => setAdding(true)}>
              <Plus /> Legg til romtype
            </Button>
          </>
        ) : (
          <div className="grid gap-2">
            <Input autoFocus placeholder="Navn, f.eks. Møterom" value={name} onChange={(e) => setName(e.target.value)} className="h-8 text-sm" />
            <div className="flex gap-2">
              <Input
                inputMode="decimal"
                placeholder="Luftmengde (valgfritt)"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="h-8 flex-1 text-sm"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as VentilationUnit)}>
                <SelectTrigger className="h-8 w-28 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VENTILATION_UNITS.map((u) => (
                    <SelectItem key={u} value={u}>
                      {VENTILATION_UNIT_LABELS[u]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="flex-1" onClick={() => setAdding(false)}>
                Avbryt
              </Button>
              <Button size="sm" className="flex-1" disabled={!canSubmit} onClick={() => void handleCreate()}>
                Legg til
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
