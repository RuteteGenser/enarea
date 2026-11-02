import { buildExportTables, compassIndex, type ExportFileData, type RowStyle } from '@/lib/exportRows';
import type { BuildingComponentType, Project } from '@/types';

const HEADER_FILL = 'FF1F3A5F';
const MAX_COLUMN_WIDTH = 48;

// Colors that make the groups easy to tell apart. Each compass direction has its own color, so the same
// direction looks the same in every room and sheet; the last entry is for rows without a direction.
const DIRECTION_FILLS = ['FFD6E6F7', 'FFD3EFEA', 'FFDDF0CB', 'FFF3F0C5', 'FFFCE3BF', 'FFF8D3CF', 'FFE8D6F0', 'FFD9DCF4', 'FFEDEDED'];
const DIRECTION_SUM_FILLS = ['FF9CC2EA', 'FF98DDD2', 'FFB9E097', 'FFE8E28C', 'FFF9C985', 'FFF1A9A2', 'FFD2AEE3', 'FFAEB6E8', 'FFC8C8C8'];
const ROOM_SUM_FILL = 'FFC9D3DF';
const KIND_SUM_FILL = 'FFFFE9B8';
const ZEBRA_FILL = 'FFEAF1F8';

type Look = { fill?: string; bold?: boolean; white?: boolean };
const lookOf = (style: RowStyle | undefined): Look => {
  switch (style?.kind) {
    case 'detail':
      return style.direction === undefined ? {} : { fill: DIRECTION_FILLS[style.direction] };
    case 'directionSum':
      return { fill: DIRECTION_SUM_FILLS[style.direction ?? 8], bold: true };
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

/** Compass index (0–7, north first) for a direction in degrees; 8 when there is no direction. */
const directionIndex = (degrees: unknown) => (typeof degrees === 'number' ? compassIndex(degrees) : 8);

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

    // Rooms alternate between white and light blue (Rom); in the wall and opening sheets the rows are colored by
    // direction instead, since that is what needs to be told apart.
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
      table.rows.forEach((values, index) => {
        const degrees = values[table.directionColumn!];
        if (typeof degrees === 'number') fillRow(index + 2, DIRECTION_FILLS[directionIndex(degrees)]);
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
