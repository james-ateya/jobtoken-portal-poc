export function AdminPagination({
  page,
  totalPages,
  total,
  loading,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1 && (total ?? 0) <= 0) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-1">
      <p className="text-xs text-zinc-500">
        {total != null ? (
          <>
            Showing page {page} of {Math.max(1, totalPages)} · {total} total
          </>
        ) : (
          <>
            Page {page} of {Math.max(1, totalPages)}
          </>
        )}
      </p>
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page >= totalPages || loading}
          onClick={() => onPageChange(page + 1)}
          className="px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 disabled:opacity-30"
        >
          Next
        </button>
      </div>
    </div>
  );
}
