export type RowSelection = { selected: string[]; anchor: string | null };

/**
 * Windows-style list selection. A plain click selects just that row; Ctrl/Cmd toggles one row; Shift selects
 * everything from the anchor (the row last clicked without Shift) to this row, and Ctrl+Shift adds that range
 * to what is already selected.
 */
export function nextSelection(
  order: string[],
  current: RowSelection,
  key: string,
  { shift, ctrl }: { shift: boolean; ctrl: boolean },
): RowSelection {
  if (shift && current.anchor !== null) {
    const from = order.indexOf(current.anchor);
    const to = order.indexOf(key);
    if (from >= 0 && to >= 0) {
      const range = order.slice(Math.min(from, to), Math.max(from, to) + 1);
      return { selected: ctrl ? [...new Set([...current.selected, ...range])] : range, anchor: current.anchor };
    }
  }
  if (ctrl) {
    const selected = current.selected.includes(key) ? current.selected.filter((k) => k !== key) : [...current.selected, key];
    return { selected, anchor: key };
  }
  return { selected: [key], anchor: key };
}
