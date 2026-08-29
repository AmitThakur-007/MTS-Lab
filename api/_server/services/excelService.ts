import * as XLSX from 'xlsx';

export function createExcelBuffer(sheetName: string, data: any[]): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

export function parseExcelBuffer(buffer: Buffer): any[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = wb.SheetNames[0];
  const ws = wb.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(ws, { defval: '' });
}
