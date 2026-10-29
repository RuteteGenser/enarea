import { describe, expect, it } from 'vitest';
import { AREA_TYPES, areaTypeForCategory, findAreaType, peopleForArea } from '@/lib/areaTypes';
import { DEFAULT_ROOM_TEMPLATES } from '@/lib/defaultRoomTemplates';

describe('peopleForArea', () => {
  it('rounds up', () => {
    expect(peopleForArea(40, 15)).toBe(3);
    expect(peopleForArea(30, 15)).toBe(2);
    expect(peopleForArea(10, 0.6)).toBe(17);
  });

  it('is at least one person', () => {
    expect(peopleForArea(0.5, 15)).toBe(1);
  });
});

describe('standard lists', () => {
  it('has the six area types and room types', () => {
    expect(AREA_TYPES).toHaveLength(6);
    expect(findAreaType('kontor')?.m2PerPerson).toBe(15);
    expect(DEFAULT_ROOM_TEMPLATES).toHaveLength(6);
    expect(DEFAULT_ROOM_TEMPLATES.find((t) => t.name === 'Kjellerrom')?.rate).toBe(2.5);
  });
});

describe('areaTypeForCategory', () => {
  it('maps matching building categories', () => {
    expect(areaTypeForCategory('kontorbygg')).toBe('kontor');
    expect(areaTypeForCategory('skolebygg')).toBe('undervisning');
    expect(areaTypeForCategory('barnehage')).toBe('undervisning');
    expect(areaTypeForCategory('forretningsbygg')).toBe('salg');
  });

  it('gives nothing for categories without a matching area type', () => {
    expect(areaTypeForCategory('smahus')).toBeUndefined();
    expect(areaTypeForCategory(undefined)).toBeUndefined();
  });
});
