export type AreaType = { id: string; label: string; m2PerPerson: number };

/** Floor area per person for the standard area types (used to suggest the number of people in a room). */
export const AREA_TYPES: AreaType[] = [
  { id: 'kontor', label: 'Kontorbygning', m2PerPerson: 15 },
  { id: 'salg', label: 'Salgslokaler', m2PerPerson: 2 },
  { id: 'undervisning', label: 'Undervisningsrom og oppholdsrom i skoler og barnehager', m2PerPerson: 2 },
  { id: 'forsamling', label: 'Forsamlingslokaler uten faste sitteplasser', m2PerPerson: 0.6 },
  { id: 'staaplasser', label: 'Rom med ståplasser', m2PerPerson: 0.3 },
  { id: 'servering', label: 'Serveringssteder med stoler og bord', m2PerPerson: 1.4 },
];

export function findAreaType(id: string | undefined): AreaType | undefined {
  return AREA_TYPES.find((t) => t.id === id);
}

/** Number of people for a room of `squareMeters`, rounded up, at least 1. */
export function peopleForArea(squareMeters: number, m2PerPerson: number): number {
  return Math.max(1, Math.ceil(squareMeters / m2PerPerson));
}
