export const IMMEDIATE_EXPORT_ROW_LIMIT = 5_000;

export class ExportLimitError extends Error {
  constructor(limit = IMMEDIATE_EXPORT_ROW_LIMIT) {
    super(
      `La exportacion inmediata permite hasta ${limit.toLocaleString("es-PE")} filas. Refina filtros o genera un reporte en segundo plano.`,
    );
    this.name = "ExportLimitError";
  }
}

export function assertImmediateExportLimit(
  count: number,
  limit = IMMEDIATE_EXPORT_ROW_LIMIT,
) {
  if (count > limit) {
    throw new ExportLimitError(limit);
  }
}
