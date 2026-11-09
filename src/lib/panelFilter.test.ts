import { describe, expect, it } from 'vitest';
import { roomMatches, wallMatches } from '@/lib/panelFilter';
import type { Annotation } from '@/types';

const room = {
  id: 'a',
  name: 'Kontor',
  roomNumber: '101',
  points: [],
  edges: [{ wallType: 'external', heightMeters: 2.5 }, { wallType: 'partition' }],
} as unknown as Annotation;

describe('panel filter', () => {
  it('matches rooms on search text and on missing wall height', () => {
    expect(roomMatches(room, 'kontor', 'alle')).toBe(true);
    expect(roomMatches(room, 'bad', 'alle')).toBe(false);
    expect(roomMatches(room, '', 'vegghoyde')).toBe(true); // the partition wall has no height
  });

  it('with "mangler vegghøyde" only lists the walls that lack a height', () => {
    expect(wallMatches(room, room.edges![0], '', 'vegghoyde')).toBe(false);
    expect(wallMatches(room, room.edges![1], '', 'vegghoyde')).toBe(true);
    expect(wallMatches(room, room.edges![0], '', 'alle')).toBe(true);
  });
});
