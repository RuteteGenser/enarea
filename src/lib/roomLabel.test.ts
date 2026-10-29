import { describe, expect, it } from 'vitest';
import { findRoomLabel, isRoomName, isRoomNumber, type TextBox } from '@/lib/roomLabel';

const t = (str: string, x: number, y: number, w = str.length * 6, h = 10): TextBox => ({ str, x, y, w, h });
const at = (b: TextBox) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });

describe('what counts as number / name', () => {
  it('recognises room numbers', () => {
    for (const s of ['101', 'A101', '2.01', '1-12', '101a', 'B-204']) expect(isRoomNumber(s)).toBe(true);
    for (const s of ['Møterom', '12,5 m²', '12 m2', 'rom 1', '123456789']) expect(isRoomNumber(s)).toBe(false);
  });

  it('recognises room names', () => {
    for (const s of ['Møterom', 'WC', 'Kjøkken/stue']) expect(isRoomName(s)).toBe(true);
    for (const s of ['101', '12,5 m²', 'A']) expect(isRoomName(s)).toBe(false);
  });
});

describe('findRoomLabel', () => {
  it('number above name (the common layout): clicking either finds both', () => {
    const number = t('101', 100, 100);
    const name = t('Møterom', 90, 112, 42);
    for (const b of [number, name]) {
      const label = findRoomLabel([number, name], at(b));
      expect(label).toMatchObject({ number: '101', name: 'Møterom' });
    }
  });

  it('name above number works too', () => {
    const name = t('Kontor', 100, 100, 36);
    const number = t('2.05', 104, 112, 24);
    expect(findRoomLabel([name, number], at(number))).toMatchObject({ number: '2.05', name: 'Kontor' });
  });

  it('number and name on one line, as separate pieces', () => {
    const number = t('101', 100, 100);
    const name = t('Lager', 126, 100, 30);
    expect(findRoomLabel([number, name], at(name))).toMatchObject({ number: '101', name: 'Lager' });
  });

  it('number and name in one text', () => {
    expect(findRoomLabel([t('101 Møterom', 100, 100, 70)], { x: 120, y: 105 })).toMatchObject({ number: '101', name: 'Møterom' });
    expect(findRoomLabel([t('Møterom 101', 100, 100, 70)], { x: 120, y: 105 })).toMatchObject({ number: '101', name: 'Møterom' });
  });

  it('only a name, or only a number', () => {
    expect(findRoomLabel([t('Bad', 100, 100, 18)], { x: 108, y: 105 })).toEqual(expect.objectContaining({ name: 'Bad', number: undefined }));
    expect(findRoomLabel([t('305', 100, 100, 18)], { x: 108, y: 105 })).toEqual(expect.objectContaining({ number: '305', name: undefined }));
  });

  it('joins a name that wraps over two lines and ignores the area text', () => {
    const number = t('12', 100, 90, 12);
    const l1 = t('Kjøkken', 92, 102, 42);
    const l2 = t('og stue', 94, 114, 40);
    const area = t('24,5 m²', 94, 126, 40);
    const label = findRoomLabel([number, l1, l2, area], at(l1));
    expect(label).toMatchObject({ number: '12', name: 'Kjøkken og stue' });
  });

  it('does not pick up text from far away or text the caller rejects', () => {
    const near = t('Stue', 100, 100, 24);
    const far = t('Soverom', 100, 300, 42);
    expect(findRoomLabel([near, far], at(near))).toMatchObject({ name: 'Stue' });
    const other = t('Bad', 100, 112, 18);
    expect(findRoomLabel([near, other], at(near), (b) => b.str !== 'Bad')).toMatchObject({ name: 'Stue' });
  });

  it('returns null when the click is not on any text', () => {
    expect(findRoomLabel([t('Stue', 100, 100, 24)], { x: 300, y: 300 })).toBeNull();
    expect(findRoomLabel([t('12,5 m²', 100, 100, 40)], { x: 110, y: 105 })).toBeNull();
  });
});
