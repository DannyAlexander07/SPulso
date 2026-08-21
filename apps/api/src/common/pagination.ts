export type CursorPage<T extends { id: string }> = {
  data: T[];
  hasNextPage: boolean;
  nextCursor: string | null;
};

export function toOptionalCursor(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string' && typeof value !== 'number') {
    return null;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

export function sliceCursorPage<T extends { id: string }>(
  items: T[],
  pageSize: number,
): CursorPage<T> {
  const hasNextPage = items.length > pageSize;
  const data = hasNextPage ? items.slice(0, pageSize) : items;
  const nextCursor = hasNextPage ? (data[data.length - 1]?.id ?? null) : null;

  return { data, hasNextPage, nextCursor };
}

export function buildPaginationMeta(input: {
  cursor?: string | null;
  hasNextPage?: boolean;
  mode?: 'cursor' | 'offset';
  nextCursor?: string | null;
  page: number;
  pageSize: number;
  total?: number | null;
}) {
  const isCursor = input.mode === 'cursor' || Boolean(input.cursor);
  const total = isCursor ? null : (input.total ?? 0);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    totalPages: isCursor
      ? null
      : Math.max(Math.ceil((total ?? 0) / input.pageSize), 1),
    nextCursor: input.nextCursor ?? null,
    hasNextPage: input.hasNextPage ?? false,
    mode: isCursor ? 'cursor' : 'offset',
  };
}
