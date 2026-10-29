import type { VentilationUnit } from '@/types';

export type DefaultRoomTemplate = {
  name: string;
  rate: number;
  unit: VentilationUnit;
  /** Extra air volume per person in m³/h, added on top of the area part (Personer × this). */
  perPerson?: number;
};

/** Air volume per person, m³/h. */
export const AIR_PER_PERSON_M3H = 26;

/** Standard room types seeded into the Romtyper library: ventilation per m² floor area, in use or not. */
export const DEFAULT_ROOM_TEMPLATES: DefaultRoomTemplate[] = [
  { name: 'Rom i bruk', rate: 2.5, unit: 'm3h_per_m2', perPerson: AIR_PER_PERSON_M3H },
  { name: 'Rom ikke i bruk', rate: 0.7, unit: 'm3h_per_m2' },
];

/** The earlier default room types (name, rate) that are removed from existing libraries once. */
export const LEGACY_ROOM_TEMPLATES: { name: string; rate: number }[] = [
  { name: 'Bad/dusj', rate: 54 },
  { name: 'Toalett', rate: 36 },
  { name: 'Heissjakt', rate: 30 },
  { name: 'Kjellerrom', rate: 2.5 },
  { name: 'Garasje for langtidsparkering', rate: 3 },
  { name: 'Garasje for korttidsparkering', rate: 6 },
];
