import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import RoomTemplateRow from '@/components/roomTemplate/RoomTemplateRow';
import { useRoomTemplateStore } from '@/store/roomTemplateStore';
import { VENTILATION_UNIT_LABELS } from '@/types';
import type { RoomTemplate, VentilationUnit } from '@/types';

const VENTILATION_UNITS = Object.keys(VENTILATION_UNIT_LABELS) as VentilationUnit[];
const DEFAULT_UNIT: VentilationUnit = 'm3h_per_m2';

export default function RoomTemplates() {
  const navigate = useNavigate();
  const templates = useRoomTemplateStore((s) => s.templates);
  const loadTemplates = useRoomTemplateStore((s) => s.loadTemplates);
  const createTemplate = useRoomTemplateStore((s) => s.createTemplate);
  const updateTemplate = useRoomTemplateStore((s) => s.updateTemplate);
  const deleteTemplate = useRoomTemplateStore((s) => s.deleteTemplate);

  useEffect(() => {
    void loadTemplates();
  }, [loadTemplates]);

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [unit, setUnit] = useState<VentilationUnit>(DEFAULT_UNIT);
  const [deleteTarget, setDeleteTarget] = useState<RoomTemplate | null>(null);

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

  function handleCreate() {
    if (!canSubmit) return;
    void createTemplate(name.trim(), parsedRate, parsedRate !== undefined ? unit : undefined);
    resetForm();
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center gap-3">
        <Button variant="ghost" size="icon-sm" onClick={() => navigate('/')} title="Til prosjektliste">
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold leading-none text-foreground">Romtyper (TEK17)</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Delt bibliotek av romtyper og TEK17-ventilasjonskrav. Romnavn matches automatisk mot disse ved navngivning.
          </p>
        </div>
      </header>

      {templates.length === 0 && !adding && <p className="mb-2 text-sm text-muted-foreground">Ingen romtyper ennå.</p>}

      {(templates.length > 0 || adding) && (
        <div className="divide-y divide-border rounded-md border border-border">
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            <span className="w-32 shrink-0">Navn</span>
            <span className="flex-1">Alias</span>
            <span className="w-24 shrink-0">Luftmengde</span>
            <span className="w-32 shrink-0">Enhet</span>
            <span className="flex-1">Notat</span>
            <span className="w-8 shrink-0" />
          </div>

          {templates.map((template) => (
            <RoomTemplateRow
              key={template.id}
              template={template}
              onUpdate={(patch) => void updateTemplate(template.id, patch)}
              onDelete={() => setDeleteTarget(template)}
            />
          ))}

          {adding && (
            <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
              <Input
                autoFocus
                placeholder="Navn, f.eks. Møterom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-7 w-32 shrink-0 px-1.5 py-0 text-sm"
              />
              <Input
                inputMode="decimal"
                placeholder="Luftmengde (valgfritt)"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                className="h-7 w-24 shrink-0 px-1.5 py-0 text-sm"
              />
              <Select value={unit} onValueChange={(v) => setUnit(v as VentilationUnit)}>
                <SelectTrigger className="h-7 w-32 shrink-0 text-xs">
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
              <Button size="sm" disabled={!canSubmit} onClick={handleCreate}>
                Legg til
              </Button>
              <Button size="sm" variant="outline" onClick={resetForm}>
                Avbryt
              </Button>
            </div>
          )}
        </div>
      )}

      {!adding && (
        <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAdding(true)}>
          <Plus /> Legg til romtype
        </Button>
      )}

      {deleteTarget && (
        <ConfirmDialog
          open={deleteTarget !== null}
          title={`Slette «${deleteTarget.name}»?`}
          description="Dette kan ikke angres."
          onOpenChange={(open) => !open && setDeleteTarget(null)}
          onConfirm={() => void deleteTemplate(deleteTarget.id)}
        />
      )}
    </div>
  );
}
