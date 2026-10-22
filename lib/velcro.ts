// Shared helpers for the Velcro customer-operations surface.

export type VelcroCaseLike = {
  priority: number;
  status: string;
  createdAt: Date | string;
};

// Work-queue order for cases: open ones first, then manual priority
// (high → low), then newest first within the same priority. This is the
// order the API returns for `?order=priority` (the CLI worklist) and the
// order the Cases tab shows.
export function compareCasesForWork<T extends VelcroCaseLike>(
  a: T,
  b: T,
): number {
  const openDelta =
    (b.status === "open" ? 1 : 0) - (a.status === "open" ? 1 : 0);
  if (openDelta !== 0) return openDelta;
  if (b.priority !== a.priority) return b.priority - a.priority;
  return +new Date(b.createdAt) - +new Date(a.createdAt);
}
