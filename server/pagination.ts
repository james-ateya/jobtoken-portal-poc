export type PageParams = {
  page: number;
  pageSize: number;
  from: number;
  to: number;
};

export function parsePageParams(
  query: Record<string, unknown>,
  defaults: { page?: number; pageSize?: number; maxPageSize?: number } = {}
): PageParams {
  const defaultPage = defaults.page ?? 1;
  const defaultPageSize = defaults.pageSize ?? 25;
  const maxPageSize = defaults.maxPageSize ?? 100;

  const page = Math.max(1, parseInt(String(query.page ?? defaultPage), 10) || defaultPage);
  const pageSize = Math.min(
    maxPageSize,
    Math.max(1, parseInt(String(query.pageSize ?? defaultPageSize), 10) || defaultPageSize)
  );
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  return { page, pageSize, from, to };
}

export function paginationMeta(total: number, page: number, pageSize: number) {
  return {
    total,
    page,
    pageSize,
    totalPages: total > 0 ? Math.ceil(total / pageSize) : 0,
  };
}
