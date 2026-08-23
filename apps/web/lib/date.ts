export function formatCalendarDate(
  value: string,
  options: Intl.DateTimeFormatOptions = {},
) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
    // Calendar-only values are persisted at UTC midnight. Formatting them in
    // the browser timezone would move them to the previous day in Peru.
    timeZone: "UTC",
  }).format(new Date(value));
}
