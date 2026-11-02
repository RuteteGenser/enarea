import { describe, expect, it } from 'vitest';
import { nextSelection } from '@/lib/rowSelection';

const order = ['a', 'b', 'c', 'd', 'e'];
const none = { shift: false, ctrl: false };

describe('nextSelection', () => {
  it('a plain click selects one row and sets the anchor', () => {
    expect(nextSelection(order, { selected: ['a', 'b'], anchor: 'a' }, 'c', none)).toEqual({ selected: ['c'], anchor: 'c' });
  });

  it('Ctrl toggles single rows', () => {
    const one = nextSelection(order, { selected: ['a'], anchor: 'a' }, 'c', { shift: false, ctrl: true });
    expect(one.selected).toEqual(['a', 'c']);
    expect(nextSelection(order, one, 'a', { shift: false, ctrl: true }).selected).toEqual(['c']);
  });

  it('Shift selects from the anchor in either direction and keeps the anchor', () => {
    expect(nextSelection(order, { selected: ['b'], anchor: 'b' }, 'd', { shift: true, ctrl: false }).selected).toEqual(['b', 'c', 'd']);
    expect(nextSelection(order, { selected: ['d'], anchor: 'd' }, 'b', { shift: true, ctrl: false })).toEqual({ selected: ['b', 'c', 'd'], anchor: 'd' });
  });

  it('Ctrl+Shift adds the range', () => {
    expect(nextSelection(order, { selected: ['a', 'd'], anchor: 'd' }, 'e', { shift: true, ctrl: true }).selected).toEqual(['a', 'd', 'e']);
  });
});
