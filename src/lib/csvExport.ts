// CSV export for list views. Escapes spreadsheet formulas (values starting with
// = + - @ tab or carriage return get a leading apostrophe) so an exported file
// can't run formulas when opened in Excel or Google Sheets.

const HIDDEN_KEY = /(json|hash|cipher|secret|token|password)$/i;

export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Plain columns only: drops internal JSON blobs, hashes, secrets and tokens. */
export function exportableColumns(rows: Array<Record<string, unknown>>): string[] {
  const columns: string[] = [];
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (columns.includes(key) || HIDDEN_KEY.test(key)) continue;
      if (value !== null && typeof value === "object" && !(value instanceof Date)) continue;
      columns.push(key);
    }
  }
  return columns;
}

export function rowsToCsv(
  rows: Array<Record<string, unknown>>,
  columns = exportableColumns(rows),
  headerLabels: Record<string, string> = {}
): string {
  const header = columns.map((c) => escapeCsvCell(headerLabels[c] || c)).join(",");
  const body = rows.map((row) => columns.map((c) => escapeCsvCell(row[c])).join(","));
  return [header, ...body].join("\r\n");
}

export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
