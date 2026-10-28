import type { VentilationUnit } from '@/types';

export type DefaultRoomTemplate = { name: string; rate: number; unit: VentilationUnit };

/** Exhaust air volumes for the standard room types, seeded into the Romtyper library on first use. */
export const DEFAULT_ROOM_TEMPLATES: DefaultRoomTemplate[] = [
  { name: 'Bad/dusj', rate: 54, unit: 'm3h_per_shower' },
  { name: 'Toalett', rate: 36, unit: 'm3h_per_toilet' },
  { name: 'Heissjakt', rate: 30, unit: 'm3h_per_m2' },
  { name: 'Kjellerrom', rate: 2.5, unit: 'm3h_per_m2' },
  { name: 'Garasje for langtidsparkering', rate: 3, unit: 'm3h_per_m2' },
  { name: 'Garasje for korttidsparkering', rate: 6, unit: 'm3h_per_m2' },
];
