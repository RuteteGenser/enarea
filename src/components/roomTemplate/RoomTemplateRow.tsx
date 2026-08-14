import { useState, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { VENTILATION_UNIT_LABELS } from '@/types';
import type { RoomTemplate, VentilationUnit } from '@/types';

const VENTILATION_UNITS = Object.keys(VENTILATION_UNIT_LABELS) as VentilationUnit[];

type EditableField = 'name' | 'aliases' | 'ventilationRate' | 'note' | null;

type RoomTemplateRowProps = {
  template: RoomTemplate;
  onUpdate: (patch: Partial<Pick<RoomTemplate, 'name' | 'aliases' | 'ventilationRate' | 'ventilationUnit' | 'note'>>) => void;
  onDelete: () => void;
};

function aliasesToText(aliases?: string[]): string {
  return (aliases ?? []).join(', ');
}

function aliasesFromText(text: string): string[] | undefined {
  const parsed = text
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : undefined;
}

export default function RoomTemplateRow({ template, onUpdate, onDelete }: RoomTemplateRowProps) {
  const [editing, setEditing] = useState<EditableField>(null);
  const [draft, setDraft] = useState('');

  function startEdit(field: EditableField, initial: string) {
    setDraft(initial);
    setEditing(field);
  }

  function commitName() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== template.name) onUpdate({ name: trimmed });
    setEditing(null);
  }

  function commitAliases() {
    onUpdate({ aliases: aliasesFromText(draft) });
    setEditing(null);
  }

  function commitVentilationRate() {
    const trimmed = draft.trim();
    if (!trimmed) {
      onUpdate({ ventilationRate: undefined });
      setEditing(null);
      return;
    }
    const parsed = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) onUpdate({ ventilationRate: parsed });
    setEditing(null);
  }

  function commitNote() {
    onUpdate({ note: draft.trim() || undefined });
    setEditing(null);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, commit: () => void, revertTo: string) {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') {
      setDraft(revertTo);
      setEditing(null);
    }
  }

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 text-sm">
      {editing === 'name' ? (
        <Input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => handleKeyDown(e, commitName, template.name)}
          className="h-7 w-32 shrink-0 px-1.5 py-0 text-sm"
        />
      ) : (
        <span className="w-32 shrink-0 truncate text-foreground" onDoubleClick={() => startEdit('name', template.name)}>
          {template.name}
        </span>
      )}

      {editing === 'aliases' ? (
        <Input
          autoFocus
          placeholder="Alias, kommaseparert"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitAliases}
          onKeyDown={(e) => handleKeyDown(e, commitAliases, aliasesToText(template.aliases))}
          className="h-7 flex-1 px-1.5 py-0 text-sm"
        />
      ) : (
        <span
          className="flex-1 truncate text-muted-foreground"
          onDoubleClick={() => startEdit('aliases', aliasesToText(template.aliases))}
        >
          {aliasesToText(template.aliases) || '—'}
        </span>
      )}

      {editing === 'ventilationRate' ? (
        <Input
          autoFocus
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitVentilationRate}
          onKeyDown={(e) => handleKeyDown(e, commitVentilationRate, String(template.ventilationRate ?? ''))}
          className="h-7 w-24 shrink-0 px-1.5 py-0 text-sm"
        />
      ) : (
        <span
          className="w-24 shrink-0 tabular-nums text-muted-foreground"
          onDoubleClick={() => startEdit('ventilationRate', String(template.ventilationRate ?? ''))}
        >
          {template.ventilationRate ?? '—'}
        </span>
      )}

      <Select
        value={template.ventilationUnit ?? 'm3h_per_m2'}
        onValueChange={(v) => onUpdate({ ventilationUnit: v as VentilationUnit })}
      >
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

      {editing === 'note' ? (
        <Input
          autoFocus
          placeholder="Notat"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitNote}
          onKeyDown={(e) => handleKeyDown(e, commitNote, template.note ?? '')}
          className="h-7 flex-1 px-1.5 py-0 text-sm"
        />
      ) : (
        <span className="flex-1 truncate text-muted-foreground" onDoubleClick={() => startEdit('note', template.note ?? '')}>
          {template.note || '—'}
        </span>
      )}

      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
