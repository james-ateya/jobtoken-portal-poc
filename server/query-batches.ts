/** Split an array into fixed-size chunks for batched Supabase `.in()` queries. */
export function chunkIds<T>(items: T[], size = 50): T[][] {
  if (size < 1) throw new Error("chunk size must be positive");
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Run a Supabase query for each ID chunk and merge row results. */
export async function fetchRowsInIdBatches<T>(
  ids: string[],
  fetchChunk: (
    chunk: string[]
  ) => PromiseLike<{ data: T[] | null; error: { message?: string } | null }>,
  batchSize = 50
): Promise<T[]> {
  if (ids.length === 0) return [];
  const rows: T[] = [];
  for (const chunk of chunkIds(ids, batchSize)) {
    const { data, error } = await fetchChunk(chunk);
    if (error) throw error;
    if (data?.length) rows.push(...data);
  }
  return rows;
}
