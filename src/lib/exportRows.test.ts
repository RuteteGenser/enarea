import { describe, expect, it } from 'vitest';
import { buildExportTables, makeBander, ventilationTotal } from '@/lib/exportRows';
import { ventilationBreakdown } from '@/lib/ventilation';
import type { Annotation, PdfFile, Project } from '@/types';

const project: Project = { id: 'p', name: 'Testbygg', northDirection: 0, createdAt: 1, updatedAt: 1 };
const file = (calibrated: boolean): PdfFile => ({
  id: 'f',
  projectId: 'p',
  name: 'plan.pdf',
  order: 0,
  pdfBlob: new Blob(),
  calibration: calibrated ? { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realMeters: 10 } : null,
  createdAt: 1,
});
const room: Annotation = {
  id: 'a',
  fileId: 'f',
  type: 'rectangle',
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 200 },
    { x: 0, y: 200 },
  ],
  edges: [{ openings: [{ id: 'o', component: { typeId: 't', category: 'vindu', name: 'Vindu', uValue: 0.8 }, area: 2.4 }] }, {}, {}, {}],
  name: 'Kontor',
  roomNumber: '101',
  people: 3,
  color: 'blue',
  locked: false,
  visible: true,
  createdAt: 1,
  updatedAt: 1,
};

describe('buildExportTables', () => {
  it('makes one table per sheet with titles on top', () => {
    const tables = buildExportTables(project, [{ file: file(true), annotations: [room] }]);
    expect(tables.map((t) => t.title)).toEqual(['Prosjekt', 'Rom', 'Vegger', 'Vinduer og dører']);
    for (const t of tables) for (const row of t.rows) expect(row).toHaveLength(t.headers.length);
  });

  it('exports real-world area and the opening', () => {
    const tables = buildExportTables(project, [{ file: file(true), annotations: [room] }]);
    const rooms = tables[1];
    expect(rooms.rows[0][rooms.headers.indexOf('Areal (m²)')]).toBe(200); // 100x200 units at 0.1 m/unit
    expect(rooms.rows[0][rooms.headers.indexOf('Total vegglengde (m)')]).toBe(60); // 2 x (100 + 200) units at 0.1 m/unit
    expect(rooms.rows[0][rooms.headers.indexOf('Personer')]).toBe(3);
    expect(tables[2].rows).toHaveLength(0); // no side is marked as an outer wall
    expect(tables[3].rows[0][6]).toBe('Vindu'); // building type name
    expect(tables[3].rows[0][5]).toBe(2.4); // area
  });

  it('leaves measures empty for uncalibrated files', () => {
    const rooms = buildExportTables(project, [{ file: file(false), annotations: [room] }])[1];
    expect(rooms.rows[0][rooms.headers.indexOf('Areal (m²)')]).toBeNull();
  });
});

describe('Vindu/Dør items', () => {
  it('lists every placed window/door with size, area, type and wall — not types that are not placed', () => {
    const f = {
      ...file(true),
      openings: [
        { id: 'o1', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1200, heightMm: 1500, typeId: 't' },
        { id: 'o2', kind: 'dor' as const, name: 'Dør 2' },
      ],
      placedOpenings: [{ id: 'p1', openingId: 'o1', annotationId: 'a', edgeIndex: 1, t: 0.5 }],
    };
    const types = [{ id: 't', category: 'vindu' as const, name: 'Vindu 3-lags', uValue: 0.8, createdAt: 1, updatedAt: 1 }];
    const sheet = buildExportTables(project, [{ file: f, annotations: [room] }], types)[3];
    const named = sheet.rows.filter((r) => r[1] !== null);
    expect(named).toHaveLength(1); // Dør 2 is not placed on any wall, so it is not listed
    expect(named[0].slice(1, 8)).toEqual(['Vindu 1', 'Vindu', 1200, 1500, 1.8, 'Vindu 3-lags', 0.8]);
    expect(named[0][10]).toBe(2); // wall number
    const rooms = buildExportTables(project, [{ file: f, annotations: [room] }], types)[1];
    expect(rooms.rows[0][rooms.headers.indexOf('Vindu (antall)')]).toBe(2); // 1 material-picker window + placed Vindu 1
    expect(rooms.rows[0][rooms.headers.indexOf('Vindu (m²)')]).toBeCloseTo(4.2); // 2.4 + 1.8
    expect(rooms.rows[0][rooms.headers.indexOf('Dør (antall)')]).toBeNull(); // Dør 2 isn't placed
  });
});

describe('windows and doors are counted separately', () => {
  it('splits count and area per kind in Rom and Vegger', () => {
    const f = {
      ...file(true),
      openings: [
        { id: 'w', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1000, heightMm: 1000 },
        { id: 'd', kind: 'dor' as const, name: 'Dør 2', widthMm: 900, heightMm: 2100 },
      ],
      placedOpenings: [
        { id: 'pw', openingId: 'w', annotationId: 'a', edgeIndex: 2, t: 0.5 },
        { id: 'pd', openingId: 'd', annotationId: 'a', edgeIndex: 2, t: 0.8 },
      ],
    };
    const [, rooms, walls] = buildExportTables(project, [{ file: f, annotations: [{ ...room, edges: [{}, {}, { wallType: 'external' }, {}] }] }]);
    const r = rooms.rows[0];
    expect(r[rooms.headers.indexOf('Vindu (antall)')]).toBe(1);
    expect(r[rooms.headers.indexOf('Vindu (m²)')]).toBe(1);
    expect(r[rooms.headers.indexOf('Dør (antall)')]).toBe(1);
    expect(r[rooms.headers.indexOf('Dør (m²)')]).toBeCloseTo(1.89);
    const w = walls.rows[0]; // wall 3 is the only outer wall
    expect(w[walls.headers.indexOf('Vindu (antall)')]).toBe(1);
    expect(w[walls.headers.indexOf('Dør (antall)')]).toBe(1);
  });
});

describe('wall direction in degrees', () => {
  it('writes the compass bearing of outer walls', () => {
    const outer = { ...room, edges: [{ wallType: 'external' as const }, {}, {}, {}] };
    const north90 = { ...project, northDirection: 90 };
    const walls = buildExportTables(north90, [{ file: file(true), annotations: [outer] }])[2];
    const col = walls.headers.indexOf('Himmelretning (°)');
    expect(walls.rows).toHaveLength(1); // only the outer wall is listed
    expect(walls.rows[0][col]).toBe(270); // top wall, compass turned 90° to the right
  });
});

describe('one type placed many times', () => {
  it('counts every placed copy and writes one row per copy', () => {
    const f = {
      ...file(true),
      openings: [{ id: 'w', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1000, heightMm: 1000 }],
      placedOpenings: [
        { id: 'p1', openingId: 'w', annotationId: 'a', edgeIndex: 0, t: 0.2 },
        { id: 'p2', openingId: 'w', annotationId: 'a', edgeIndex: 0, t: 0.5 },
        { id: 'p3', openingId: 'w', annotationId: 'a', edgeIndex: 2, t: 0.5 },
      ],
    };
    const [, rooms, walls, sheet] = buildExportTables(project, [
      { file: f, annotations: [{ ...room, edges: [{ wallType: 'external' }, {}, { wallType: 'external' }, {}] }] },
    ]);
    expect(sheet.rows).toHaveLength(3);
    expect(sheet.rows.every((r) => r[1] === 'Vindu 1')).toBe(true);
    expect(rooms.rows[0][rooms.headers.indexOf('Vindu (antall)')]).toBe(3);
    expect(rooms.rows[0][rooms.headers.indexOf('Vindu (m²)')]).toBe(3);
    expect(walls.rows[0][walls.headers.indexOf('Vindu (antall)')]).toBe(2);
  });
});

describe('Vegger sheet only has outer walls', () => {
  it('leaves out internal walls and unmarked sides', () => {
    const marked = { ...room, edges: [{ wallType: 'external' as const }, { wallType: 'internal' as const }, {}, { wallType: 'external' as const }] };
    const walls = buildExportTables(project, [{ file: file(true), annotations: [marked] }])[2];
    expect(walls.rows.map((r) => r[walls.headers.indexOf('Vegg nr')])).toEqual([1, 4]);
    expect(walls.rows.every((r) => r[walls.headers.indexOf('Yttervegg/innervegg')] === 'Yttervegg')).toBe(true);
  });

  it('a room without any marked wall has no wall rows', () => {
    const walls = buildExportTables(project, [{ file: file(true), annotations: [{ ...room, edges: [{}, {}, {}, {}] }] }])[2];
    expect(walls.rows).toHaveLength(0);
  });

  it('keeps the wall numbers of the sides, so they match the drawing', () => {
    const walls = buildExportTables(project, [{ file: file(true), annotations: [{ ...room, edges: [{}, {}, {}, { wallType: 'external' }] }] }])[2];
    expect(walls.rows[0][walls.headers.indexOf('Vegg nr')]).toBe(4);
  });
});

describe('lines', () => {
  it('are not exported (no Linjer sheet, no rows from lines)', () => {
    const line = { ...room, id: 'l', type: 'line' as const, points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], edges: undefined };
    const tables = buildExportTables(project, [{ file: file(true), annotations: [line] }]);
    expect(tables.map((x) => x.title)).not.toContain('Linjer');
    expect(tables[1].rows).toHaveLength(0);
  });
});

describe('ventilationTotal', () => {
  it('derives m³/h where possible', () => {
    expect(ventilationTotal(2.5, 'm3h_per_m2', 20, undefined)).toBe(50);
    expect(ventilationTotal(26, 'm3h_per_person', 20, 4)).toBe(104);
    expect(ventilationTotal(54, 'm3h_per_shower', 20, 4)).toBeNull();
    expect(ventilationTotal(undefined, undefined, 20, 4)).toBeNull();
  });

  it('adds 26 m³/h per person on top of the area part for rooms in use', () => {
    expect(ventilationTotal(2.5, 'm3h_per_m2', 40, 3, 26)).toBe(2.5 * 40 + 26 * 3); // 178
    expect(ventilationTotal(0.7, 'm3h_per_m2', 40, 3)).toBeCloseTo(28); // not in use: area only
    expect(ventilationTotal(2.5, 'm3h_per_m2', 40, undefined, 26)).toBe(100); // no people entered
  });
});

describe('ventilationBreakdown', () => {
  it('spells out area part plus people part', () => {
    expect(ventilationBreakdown(2.5, 'm3h_per_m2', 40, 3, 26)).toBe('2,5 m³/h × 40 m² + 26 m³/h × 3 personer');
    expect(ventilationBreakdown(0.7, 'm3h_per_m2', 40, 3)).toBe('0,7 m³/h × 40 m²');
    expect(ventilationBreakdown(2.5, 'm3h_per_m2', 10, 1, 26)).toBe('2,5 m³/h × 10 m² + 26 m³/h × 1 person');
    expect(ventilationBreakdown(undefined, undefined, 10, 1)).toBeNull();
  });
});

describe('wall height, area, names and direction summary', () => {
  const f = {
    ...file(true),
    openings: [{ id: 'w', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1000, heightMm: 1000, typeId: 'bt' }],
    placedOpenings: [
      { id: 'p1', openingId: 'w', annotationId: 'a', edgeIndex: 0, t: 0.2 },
      { id: 'p2', openingId: 'w', annotationId: 'a', edgeIndex: 0, t: 0.5 },
    ],
  };
  const types = [{ id: 'bt', category: 'vindu' as const, name: 'Trevindu', createdAt: 1, updatedAt: 1 }];
  const outer = {
    ...room,
    edges: [{ wallType: 'external' as const, heightMeters: 2.5 }, { wallType: 'external' as const }, {}, {}],
  };
  const [, rooms, walls] = buildExportTables(project, [{ file: f, annotations: [outer] }], types);

  it('writes height and wall area after the length', () => {
    expect(walls.headers.slice(4, 7)).toEqual(['Lengde (m)', 'Vegghøyde (m)', 'Veggareal (m²)']);
    expect(walls.rows[0][walls.headers.indexOf('Veggareal (m²)')]).toBe(25); // 10 m × 2.5 m
    expect(walls.rows[1][walls.headers.indexOf('Vegghøyde (m)')]).toBeNull(); // no height entered
    expect(walls.rows[1][walls.headers.indexOf('Veggareal (m²)')]).toBeNull();
  });

  it('names the window and door types used', () => {
    expect(walls.rows[0][walls.headers.indexOf('Vinduer og dører (navn)')]).toBe('2 × Vindu 1 (Trevindu)');
    expect(rooms.rows[0][rooms.headers.indexOf('Vinduer og dører (navn)')]).toContain('2 × Vindu 1 (Trevindu)');
  });

  it('writes the count even when there is only one', () => {
    const one = { ...f, placedOpenings: [f.placedOpenings[0]] };
    const [, , w] = buildExportTables(project, [{ file: one, annotations: [outer] }], types);
    expect(w.rows[0][w.headers.indexOf('Vinduer og dører (navn)')]).toBe('1 × Vindu 1 (Trevindu)');
  });

  it('sums the outer walls room by room, then per compass direction, with the degrees', () => {
    const summary = walls.summaries![0];
    const rows = summary.rows;
    expect(summary.title).toBe('Oppsummering: yttervegger per rom og himmelretning (grader)');
    expect(summary.headers.slice(0, 5)).toEqual(['Fil', 'Rom nr', 'Rom', 'Himmelretning', 'Grader (°)']);
    // the room comes first: its north and east walls, the room sum; then the sums per direction and the total
    expect(rows.map((r) => r[3])).toEqual(['Nord', 'Øst', null, 'Nord', 'Øst', null]);
    expect(rows.map((r) => r[0])).toEqual(['plan.pdf', 'plan.pdf', 'Sum 101 Kontor', 'Sum 0°', 'Sum 90°', 'Sum alle']);
    expect(rows[0].slice(0, 8)).toEqual(['plan.pdf', '101', 'Kontor', 'Nord', 0, 1, 10, 25]);
    expect(rows[1].slice(3, 5)).toEqual(['Øst', 90]);
    expect(rows[1][7]).toBeNull(); // no height on the east wall
    expect(rows[2].slice(5, 7)).toEqual([2, 30]); // 10 m + 20 m
    expect(rows[5].slice(5, 7)).toEqual([2, 30]);
  });

  it('has a second summary with the total wall length per zone', () => {
    const zones = walls.summaries![1];
    expect(zones.title).toBe('Oppsummering: total vegglengde per sone');
    expect(zones.rows[0]).toEqual(['plan.pdf', '101', 'Kontor', 2, 30, 25, 60]); // 2 outer walls = 30 m, all four sides = 60 m
    expect(zones.rows[1][0]).toBe('Sum');
  });
});

describe('summary of windows and doors per room, direction and type', () => {
  const f = {
    ...file(true),
    openings: [
      { id: 'w1', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1200, heightMm: 1500, typeId: 'bt' },
      { id: 'w2', kind: 'vindu' as const, name: 'Vindu 2', widthMm: 600, heightMm: 600 },
      { id: 'd1', kind: 'dor' as const, name: 'Dør 1', widthMm: 900, heightMm: 2100 },
      { id: 'unused', kind: 'dor' as const, name: 'Dør 2', widthMm: 1000, heightMm: 2100 },
    ],
    placedOpenings: [
      { id: 'p1', openingId: 'w1', annotationId: 'a', edgeIndex: 0, t: 0.2 }, // top wall: north
      { id: 'p2', openingId: 'w1', annotationId: 'a', edgeIndex: 0, t: 0.6 },
      { id: 'p3', openingId: 'w2', annotationId: 'a', edgeIndex: 1, t: 0.5 }, // right wall: east
      { id: 'p4', openingId: 'd1', annotationId: 'a', edgeIndex: 0, t: 0.9 },
      { id: 'p5', openingId: 'd1', annotationId: 'a', edgeIndex: 2, t: 0.5 }, // bottom wall is not an outer wall
    ],
  };
  const types = [{ id: 'bt', category: 'vindu' as const, name: 'Trevindu', uValue: 1.1, createdAt: 1, updatedAt: 1 }];
  const outer = { ...room, edges: [{ wallType: 'external' as const }, { wallType: 'external' as const }, {}, {}] };
  const tables = buildExportTables(project, [{ file: f, annotations: [outer] }], types);
  const summary = tables[3].summaries![0]; // in the Vinduer og dører sheet
  const labels = summary.rows.map((r) => r[0]);

  it('is in the Vinduer og dører sheet, not in Vegger', () => {
    expect(summary.title).toBe('Oppsummering: vinduer og dører per rom, himmelretning (grader) og type');
    expect(tables[2].summaries!.some((s) => s.title.includes('vinduer og dører'))).toBe(false);
  });

  it('goes room first, then compass direction, with size, count and total area', () => {
    expect(summary.headers.slice(0, 7)).toEqual(['Fil', 'Rom nr', 'Rom', 'Himmelretning', 'Grader (°)', 'Navn / type', 'Vindu/dør']);
    expect(summary.rows.map((r) => r[3]).slice(0, 4)).toEqual(['Nord', 'Nord', 'Øst', 'Ikke på yttervegg']);
    expect(labels.slice(4)).toEqual(['Sum 101 Kontor', 'Sum 0°', 'Sum 90°', 'Sum ikke på yttervegg', 'Sum vindu', 'Sum dør', 'Sum alle']);
    // north: 2 × Vindu 1 then 1 × Dør 1 (windows before doors)
    expect(summary.rows[0]).toEqual(['plan.pdf', '101', 'Kontor', 'Nord', 0, 'Vindu 1', 'Vindu', 1200, 1500, 1.8, 'Trevindu', 1.1, 2, 3.6]);
    expect(summary.rows[1].slice(5, 7)).toEqual(['Dør 1', 'Dør']);
    expect(summary.rows[2].slice(5, 9)).toEqual(['Vindu 2', 'Vindu', 600, 600]);
  });

  it('has sums per room, direction, kind and in total, and leaves out types that are not placed', () => {
    const at = (label: string) => summary.rows[labels.indexOf(label)].slice(12);
    expect(at('Sum 101 Kontor')).toEqual([5, 7.74]);
    expect(at('Sum 0°')).toEqual([3, 5.49]);
    expect(at('Sum vindu')).toEqual([3, 3.96]); // 2 × 1,8 + 1 × 0,36
    expect(at('Sum dør')).toEqual([2, 3.78]); // Dør 2 isn't placed
    expect(at('Sum alle')).toEqual([5, 7.74]);
  });
});

describe('summary of windows and doors is split on room first', () => {
  const f = {
    ...file(true),
    openings: [{ id: 'w1', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1000, heightMm: 1000 }],
    placedOpenings: [
      { id: 'p1', openingId: 'w1', annotationId: 'a', edgeIndex: 0, t: 0.5 },
      { id: 'p2', openingId: 'w1', annotationId: 'a', edgeIndex: 1, t: 0.5 },
      { id: 'p3', openingId: 'w1', annotationId: 'b', edgeIndex: 0, t: 0.5 },
      { id: 'p4', openingId: 'w1', annotationId: 'b', edgeIndex: 0, t: 0.8 },
    ],
  };
  const edges = [{ wallType: 'external' as const }, { wallType: 'external' as const }, {}, {}];
  const rooms = [
    { ...room, edges },
    { ...room, id: 'b', name: 'Lager', roomNumber: '102', edges },
  ];
  const summary = buildExportTables(project, [{ file: f, annotations: rooms }])[3].summaries![0];

  it('lists each room with its directions, then a room sum, before any direction sums', () => {
    expect(summary.rows.map((r) => r[0])).toEqual([
      'plan.pdf', 'plan.pdf', 'Sum 101 Kontor', // Kontor: north, east
      'plan.pdf', 'Sum 102 Lager', // Lager: north
      'Sum 0°', 'Sum 90°', 'Sum vindu', 'Sum alle',
    ]);
    expect(summary.rows[0].slice(1, 5)).toEqual(['101', 'Kontor', 'Nord', 0]);
    expect(summary.rows[1].slice(3, 4)).toEqual(['Øst']);
    expect(summary.rows[3].slice(1, 5)).toEqual(['102', 'Lager', 'Nord', 0]);
    expect(summary.rows[3].slice(12)).toEqual([2, 2]);
    expect(summary.rows[2].slice(12)).toEqual([2, 2]);
    expect(summary.rows[5].slice(12)).toEqual([3, 3]); // all north windows, both rooms
  });
});

describe('directions are never rounded to a compass point', () => {
  // five outer walls facing five different directions, all of them "Sørvest" or close to it
  const pentagon: Annotation = {
    ...room,
    points: [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 130, y: 60 },
      { x: 80, y: 120 },
      { x: -20, y: 70 },
    ],
    edges: [1, 2, 3, 4, 5].map(() => ({ wallType: 'external' as const })),
  };
  const f = {
    ...file(true),
    openings: [{ id: 'w', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1000, heightMm: 1000 }],
    placedOpenings: [0, 1, 2, 3, 4].map((i) => ({ id: `p${i}`, openingId: 'w', annotationId: 'a', edgeIndex: i, t: 0.5 })),
  };
  const tables = buildExportTables(project, [{ file: f, annotations: [pentagon] }]);

  it('gives walls with different degrees a row each, even when they share a compass name', () => {
    const rows = tables[2].summaries![0].rows.filter((r) => r[2] === 'Kontor');
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r[4])).size).toBe(5);
    expect(rows.every((r) => typeof r[4] === 'number')).toBe(true);
  });

  it('does the same for windows and doors', () => {
    const rows = tables[3].summaries![0].rows.filter((r) => r[2] === 'Kontor');
    expect(rows).toHaveLength(5);
    expect(new Set(rows.map((r) => r[4])).size).toBe(5);
  });
});

describe('row styles for the colored Excel groups', () => {
  const edges = [{ wallType: 'external' as const }, { wallType: 'external' as const }, {}, {}];
  const rooms = [
    { ...room, edges },
    { ...room, id: 'b', name: 'Lager', roomNumber: '102', edges },
  ];
  const [, , walls, sheet] = buildExportTables(project, [{ file: file(true), annotations: rooms }]);

  it('alternates the two colors whenever the direction changes, and marks room sums, direction sums and the total', () => {
    const { styles, rows } = walls.summaries![0];
    expect(styles).toHaveLength(rows.length);
    // Kontor: north, east; Lager: north, east (the colors keep alternating as the direction changes)
    expect(styles).toEqual([
      { kind: 'detail', band: 0 },
      { kind: 'detail', band: 1 },
      { kind: 'roomSum' },
      { kind: 'detail', band: 0 },
      { kind: 'detail', band: 1 },
      { kind: 'roomSum' },
      { kind: 'directionSum', band: 0 },
      { kind: 'directionSum', band: 1 },
      { kind: 'total' },
    ]);
  });

  it('colors the rows of the wall and opening sheets by the column with the direction', () => {
    expect(walls.headers[walls.directionColumn!]).toBe('Himmelretning (°)');
    expect(sheet.headers[sheet.directionColumn!]).toBe('Himmelretning (°)');
  });

  it('makeBander gives the same color to equal values in a row and the other color when the value changes', () => {
    const band = makeBander<number>();
    expect([207, 207, 219, 223, 223, 207].map(band)).toEqual([0, 0, 1, 0, 0, 1]);
  });
});
