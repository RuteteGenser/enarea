import { useState, type KeyboardEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BuildingComponentType } from '@/types';

type EditableField = 'name' | 'uValue' | 'wallThickness' | null;

type BuildingComponentTypeRowProps = {
  type: BuildingComponentType;
  onUpdate: (patch: Partial<Pick<BuildingComponentType, 'name' | 'uValue' | 'wallThickness'>>) => void;
  onDelete: () => void;
};

export default function BuildingComponentTypeRow({ type, onUpdate, onDelete }: BuildingComponentTypeRowProps) {
  const [editing, setEditing] = useState<EditableField>(null);
  const [draft, setDraft] = useState('');

  function startEdit(field: EditableField, initial: string) {
    setDraft(initial);
    setEditing(field);
  }

  function commitName() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== type.name) onUpdate({ name: trimmed });
    setEditing(null);
  }

  function commitNumber(field: 'uValue' | 'wallThickness') {
    const trimmed = draft.trim();
    if (!trimmed) {
      onUpdate({ [field]: undefined });
      setEditing(null);
      return;
    }
    const parsed = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(parsed) && parsed > 0) {
      onUpdate({ [field]: parsed });
    }
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
          onKeyDown={(e) => handleKeyDown(e, commitName, type.name)}
          className="h-7 flex-1 px-1.5 py-0 text-sm"
        />
      ) : (
        <span className="flex-1 truncate text-foreground" onDoubleClick={() => startEdit('name', type.name)}>
          {type.name}
        </span>
      )}

      {editing === 'uValue' ? (
        <Input
          autoFocus
          inputMode="decimal"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => commitNumber('uValue')}
          onKeyDown={(e) => handleKeyDown(e, () => commitNumber('uValue'), String(type.uValue ?? ''))}
          className="h-7 w-24 px-1.5 py-0 text-sm"
        />
      ) : (
        <span
          className="w-24 shrink-0 tabular-nums text-muted-foreground"
          onDoubleClick={() => startEdit('uValue', String(type.uValue ?? ''))}
        >
          {type.uValue !== undefined ? `${type.uValue} W/m²K` : '—'}
        </span>
      )}

      {type.category === 'yttervegg' &&
        (editing === 'wallThickness' ? (
          <Input
            autoFocus
            inputMode="decimal"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => commitNumber('wallThickness')}
            onKeyDown={(e) =>
              handleKeyDown(e, () => commitNumber('wallThickness'), String(type.wallThickness ?? ''))
            }
            className="h-7 w-28 px-1.5 py-0 text-sm"
          />
        ) : (
          <span
            className="w-28 shrink-0 tabular-nums text-muted-foreground"
            onDoubleClick={() => startEdit('wallThickness', String(type.wallThickness ?? ''))}
          >
            {type.wallThickness ?? '—'} mm
          </span>
        ))}

      <Button variant="ghost" size="icon-sm" onClick={onDelete}>
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}
