import { describe, expect, it } from 'vitest';
import { matchRoomTemplate, normalize } from '@/lib/roomTemplateMatch';
import type { RoomTemplate } from '@/types';

function template(overrides: Partial<RoomTemplate> = {}): RoomTemplate {
  return {
    id: 'template-1',
    name: 'Møterom',
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe('normalize', () => {
  it('trims, lowercases, and collapses whitespace', () => {
    expect(normalize('  Møterom   2. etasje  ')).toBe('møterom 2. etasje');
  });
});

describe('matchRoomTemplate', () => {
  it('returns null when there are no templates', () => {
    expect(matchRoomTemplate('Møterom', [])).toBeNull();
  });

  it('returns null when nothing matches', () => {
    expect(matchRoomTemplate('Bad', [template()])).toBeNull();
  });

  it('matches exactly, case-insensitively', () => {
    const t = template();
    const result = matchRoomTemplate('møterom', [t]);
    expect(result).toEqual({ template: t, matchType: 'exact' });
  });

  it('matches an alias exactly', () => {
    const t = template({ aliases: ['konferanserom'] });
    const result = matchRoomTemplate('Konferanserom', [t]);
    expect(result).toEqual({ template: t, matchType: 'exact' });
  });

  it('falls back to a fuzzy substring match', () => {
    const t = template();
    const result = matchRoomTemplate('Møterom 2. etasje', [t]);
    expect(result).toEqual({ template: t, matchType: 'fuzzy' });
  });

  it('matches when the room name is a substring of the template keyword', () => {
    const t = template({ name: 'Stort møterom' });
    const result = matchRoomTemplate('møterom', [t]);
    expect(result).toEqual({ template: t, matchType: 'fuzzy' });
  });

  it('ignores very short keywords to avoid noisy matches', () => {
    const t = template({ name: 'WC' });
    expect(matchRoomTemplate('WC 2. etasje', [t])).toBeNull();
  });

  it('prefers the longest matching keyword across templates', () => {
    const room = template({ id: 'room', name: 'Rom' });
    const bigMeetingRoom = template({ id: 'big', name: 'Stort møterom' });
    const result = matchRoomTemplate('Stort møterom 2. etasje', [room, bigMeetingRoom]);
    expect(result).toEqual({ template: bigMeetingRoom, matchType: 'fuzzy' });
  });

  it('prefers an exact match over a fuzzy match on another template', () => {
    const meetingRoom = template({ id: 'exact', name: 'Møterom' });
    const bigMeetingRoom = template({ id: 'fuzzy', name: 'Stort møterom' });
    const result = matchRoomTemplate('Møterom', [bigMeetingRoom, meetingRoom]);
    expect(result).toEqual({ template: meetingRoom, matchType: 'exact' });
  });
});
