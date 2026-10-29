import { describe, expect, it } from 'vitest';
import { buildExportTables, ventilationTotal } from '@/lib/exportRows';
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
    expect(tables.map((t) => t.title)).toEqual(['Prosjekt', 'Rom', 'Vegger', 'Vinduer og dører', 'Linjer']);
    for (const t of tables) for (const row of t.rows) expect(row).toHaveLength(t.headers.length);
  });

  it('exports real-world area and the opening', () => {
    const tables = buildExportTables(project, [{ file: file(true), annotations: [room] }]);
    const rooms = tables[1];
    expect(rooms.rows[0][rooms.headers.indexOf('Areal (m²)')]).toBe(200); // 100x200 units at 0.1 m/unit
    expect(rooms.rows[0][rooms.headers.indexOf('Personer')]).toBe(3);
    expect(tables[2].rows).toHaveLength(4);
    expect(tables[3].rows[0][6]).toBe('Vindu'); // building type name
    expect(tables[3].rows[0][5]).toBe(2.4); // area
  });

  it('leaves measures empty for uncalibrated files', () => {
    const rooms = buildExportTables(project, [{ file: file(false), annotations: [room] }])[1];
    expect(rooms.rows[0][rooms.headers.indexOf('Areal (m²)')]).toBeNull();
  });
});

describe('Vindu/Dør items', () => {
  it('lists placed and unplaced items with size, area, type and room', () => {
    const f = {
      ...file(true),
      openings: [
        { id: 'o1', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1200, heightMm: 1500, typeId: 't', placement: { annotationId: 'a', edgeIndex: 1, t: 0.5 } },
        { id: 'o2', kind: 'dor' as const, name: 'Dør 2' },
      ],
    };
    const types = [{ id: 't', category: 'vindu' as const, name: 'Vindu 3-lags', uValue: 0.8, createdAt: 1, updatedAt: 1 }];
    const sheet = buildExportTables(project, [{ file: f, annotations: [room] }], types)[3];
    const named = sheet.rows.filter((r) => r[1] !== null);
    expect(named).toHaveLength(2);
    expect(named[0].slice(1, 8)).toEqual(['Vindu 1', 'Vindu', 1200, 1500, 1.8, 'Vindu 3-lags', 0.8]);
    expect(named[0][10]).toBe(2); // wall number
    expect(named[1].slice(1, 3)).toEqual(['Dør 2', 'Dør']);
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
        { id: 'w', kind: 'vindu' as const, name: 'Vindu 1', widthMm: 1000, heightMm: 1000, placement: { annotationId: 'a', edgeIndex: 2, t: 0.5 } },
        { id: 'd', kind: 'dor' as const, name: 'Dør 2', widthMm: 900, heightMm: 2100, placement: { annotationId: 'a', edgeIndex: 2, t: 0.8 } },
      ],
    };
    const [, rooms, walls] = buildExportTables(project, [{ file: f, annotations: [{ ...room, edges: [{}, {}, {}, {}] }] }]);
    const r = rooms.rows[0];
    expect(r[rooms.headers.indexOf('Vindu (antall)')]).toBe(1);
    expect(r[rooms.headers.indexOf('Vindu (m²)')]).toBe(1);
    expect(r[rooms.headers.indexOf('Dør (antall)')]).toBe(1);
    expect(r[rooms.headers.indexOf('Dør (m²)')]).toBeCloseTo(1.89);
    const w = walls.rows[2]; // wall 3
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
    expect(walls.rows[0][col]).toBe(270); // top wall, compass turned 90° to the right
    expect(walls.rows[1][col]).toBeNull(); // not an outer wall
  });
});

describe('ventilationTotal', () => {
  it('derives m³/h where possible', () => {
    expect(ventilationTotal(2.5, 'm3h_per_m2', 20, undefined)).toBe(50);
    expect(ventilationTotal(26, 'm3h_per_person', 20, 4)).toBe(104);
    expect(ventilationTotal(54, 'm3h_per_shower', 20, 4)).toBeNull();
    expect(ventilationTotal(undefined, undefined, 20, 4)).toBeNull();
  });
});
