import { buildExportTables, makeBander, type ExportFileData, type RowStyle } from '@/lib/exportRows';
import type { BuildingComponentType, Project } from '@/types';

const HEADER_FILL = 'FF1F3A5F';
const MAX_COLUMN_WIDTH = 48;

// Colors that make the groups easy to tell apart: the rows alternate between two colors whenever the direction
// changes (light blue and white; a darker blue and grey for the sums per direction).
const DETAIL_FILLS: (string | undefined)[] = ['FFDCE9F7', undefined];
const DIRECTION_SUM_FILLS = ['FFA9C8EA', 'FFD0D0D0'];
const ROOM_SUM_FILL = 'FFC9D3DF';
const KIND_SUM_FILL = 'FFFFE9B8';
const ZEBRA_FILL = 'FFEAF1F8';

type Look = { fill?: string; bold?: boolean; white?: boolean };
const lookOf = (style: RowStyle | undefined): Look => {
  switch (style?.kind) {
    case 'detail':
      return { fill: DETAIL_FILLS[style.band ?? 1] };
    case 'directionSum':
      return { fill: DIRECTION_SUM_FILLS[style.band ?? 0], bold: true };
    case 'roomSum':
      return { fill: ROOM_SUM_FILL, bold: true };
    case 'kindSum':
      return { fill: KIND_SUM_FILL, bold: true };
    case 'total':
      return { fill: HEADER_FILL, bold: true, white: true };
    default:
      return {};
  }
};

/** Builds an .xlsx workbook (one styled sheet per table, titles in the frozen top row) and returns it as a Blob. */
export async function exportProjectExcel(
  project: Project,
  filesData: ExportFileData[],
  types: BuildingComponentType[] = [],
): Promise<Blob> {
  // Loaded on demand: the library is large and only needed when exporting.
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Enarea';
  workbook.created = new Date();

  for (const table of buildExportTables(project, filesData, types)) {
    const sheet = workbook.addWorksheet(table.title);
    sheet.addRow(table.headers);
    for (const row of table.rows) sheet.addRow(row);

    const header = sheet.getRow(1);
    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { vertical: 'middle', wrapText: true };
    header.height = 32;
    header.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    });

    // Fit each column to its longest value (capped), numbers right-aligned with 2 decimals.
    table.headers.forEach((title, c) => {
      const column = sheet.getColumn(c + 1);
      let longest = Math.min(title.length, 24);
      for (const row of table.rows) {
        const value = row[c];
        if (value !== null && value !== undefined) longest = Math.max(longest, String(value).length);
      }
      column.width = Math.min(MAX_COLUMN_WIDTH, longest + 3);
    });
    for (let r = 2; r <= sheet.rowCount; r++) {
      sheet.getRow(r).eachCell((cell) => {
        if (typeof cell.value === 'number' && !Number.isInteger(cell.value)) cell.numFmt = '0.00';
      });
    }

    // Rooms alternate between white and light blue (Rom); in the wall and opening sheets the colors alternate
    // whenever the direction changes, since that is what needs to be told apart.
    const fillRow = (rowNumber: number, argb: string) => {
      const row = sheet.getRow(rowNumber);
      for (let c = 1; c <= table.headers.length; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
    };
    if (table.groupBy) {
      let previous = '';
      let band = -1;
      table.rows.forEach((values, index) => {
        const key = table.groupBy!.map((c) => String(values[c] ?? '')).join('|');
        if (key !== previous) band++;
        previous = key;
        if (band % 2 === 1) fillRow(index + 2, ZEBRA_FILL);
      });
    }
    if (table.directionColumn !== undefined) {
      const bandFor = makeBander<number>();
      table.rows.forEach((values, index) => {
        const degrees = values[table.directionColumn!];
        if (typeof degrees !== 'number') return;
        const fill = DETAIL_FILLS[bandFor(degrees)];
        if (fill) fillRow(index + 2, fill);
      });
    }

    // The summaries go under the table, each after an empty row.
    for (const summary of table.summaries ?? []) {
      sheet.addRow([]);
      const title = sheet.addRow([summary.title]);
      title.font = { bold: true, size: 12 };
      const head = sheet.addRow(summary.headers);
      head.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      head.alignment = { wrapText: true };
      head.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      });
      summary.rows.forEach((values, index) => {
        const row = sheet.addRow(values);
        row.eachCell((cell) => {
          if (typeof cell.value === 'number' && !Number.isInteger(cell.value)) cell.numFmt = '0.00';
        });
        const look = lookOf(summary.styles?.[index]);
        if (look.bold) row.font = { bold: true, ...(look.white ? { color: { argb: 'FFFFFFFF' } } : {}) };
        // every cell gets the color, also empty ones, so a colored row is one unbroken band
        if (look.fill) {
          for (let c = 1; c <= summary.headers.length; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: look.fill } };
        }
      });
      summary.headers.forEach((header, c) => {
        const column = sheet.getColumn(c + 1);
        column.width = Math.max(column.width ?? 10, Math.min(MAX_COLUMN_WIDTH, header.length + 3));
      });
    }

    if (table.title === 'Prosjekt') {
      sheet.getColumn(1).font = { bold: true };
      sheet.getColumn(2).alignment = { horizontal: 'left' };
    }
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
    if (table.rows.length > 0 && table.title !== 'Prosjekt') {
      sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: table.headers.length } };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
