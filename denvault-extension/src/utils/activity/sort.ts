/**
 * Ordering for the single Activity list that shows Stacks and Bitcoin
 * together.
 *
 * The home view used to concatenate the two and sort with a comparator that
 * moved pending items to the front and returned 0 for everything else.
 * Array sort is stable, so confirmed rows kept the concatenation order:
 * every Stacks transaction first, then every Bitcoin one, whatever their
 * dates.
 *
 * A Bitcoin send therefore vanished from its own sender's history the
 * moment it confirmed, dropping below contract calls from fifteen hours
 * earlier. Pending it was at the top; confirmed it was out of sight.
 */

export interface SortableActivity {
  status: 'pending' | 'success' | 'failed';
  /** Seconds since the epoch. Absent while a transaction is unconfirmed. */
  timestamp?: number;
}

/**
 * @returns a new array: pending first, then newest to oldest. An item with
 * no timestamp goes last rather than being read as 1970 and jumping the
 * queue, or as now and pretending to be the latest thing that happened.
 */
export function sortActivityItems<T extends SortableActivity>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const aPending = a.status === 'pending';
    const bPending = b.status === 'pending';
    if (aPending !== bPending) return aPending ? -1 : 1;

    if (a.timestamp === undefined && b.timestamp === undefined) return 0;
    if (a.timestamp === undefined) return 1;
    if (b.timestamp === undefined) return -1;

    return b.timestamp - a.timestamp;
  });
}
