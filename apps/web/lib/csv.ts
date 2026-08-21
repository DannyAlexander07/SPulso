const SPREADSHEET_FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/;

export function escapeCsvValue(value: string) {
  const safeValue = SPREADSHEET_FORMULA_PREFIX.test(value) ? `'${value}` : value;
  return `"${safeValue.replaceAll('"', '""')}"`;
}
