import { buildExportTables, type ExportFileData } from '@/lib/exportRows';
import type { Project } from '@/types';

const HEADER_FILL = 'FF1F3A5F';
const MAX_COLUMN_WIDTH = 48;

/** Builds an .xlsx workbook (one styled sheet per table, titles in the frozen top row) and returns it as a Blob. */
export async function exportProjectExcel(project: Project, filesData: ExportFileData[]): Promise<Blob> {
  // Loaded on demand: the library is large and only needed when exporting.
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Enarea';
  workbook.created = new Date();

  for (const table of buildExportTables(project, filesData)) {
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
