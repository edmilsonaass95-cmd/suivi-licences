import * as XLSX from "xlsx";

export function exportToExcel(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[]
) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, filename);
}

export function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
