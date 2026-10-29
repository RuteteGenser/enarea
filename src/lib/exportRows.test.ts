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
    expect(tables[3].rows[0][5]).toBe('Vindu');
    expect(tables[3].rows[0][7]).toBe(2.4);
  });

  it('leaves measures empty for uncalibrated files', () => {
    const rooms = buildExportTables(project, [{ file: file(false), annotations: [room] }])[1];
    expect(rooms.rows[0][rooms.headers.indexOf('Areal (m²)')]).toBeNull();
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
