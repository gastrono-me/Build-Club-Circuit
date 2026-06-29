/**
 * Split an array into chunks of at most `size`. Used to bound the id list in
 * PostgREST `.in(...)` filters so a busy feed can't produce an over-long request
 * URL. An empty input yields no chunks.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) return items.length ? [items] : []
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
