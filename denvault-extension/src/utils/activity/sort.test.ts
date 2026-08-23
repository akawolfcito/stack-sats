/**
 * Ordering the one list that shows both chains.
 *
 * The home view concatenated Stacks and Bitcoin activity and then sorted
 * with a comparator that only moved pending items to the front, returning 0
 * for everything else. Array.prototype.sort is stable, so confirmed items
 * kept the concatenation order: every Stacks transaction, then every Bitcoin
 * one.
 *
 * On 2026-08-17 that hid a Bitcoin send from its own sender. While it was
 * pending it sat at the top; the moment it confirmed it dropped below
 * contract calls from fifteen hours earlier, and the user reported it as
 * missing.
 */

import { describe, it, expect } from 'vitest';
import { sortActivityItems } from './sort';

const stx = (timestamp: number) => ({ id: `stx-${timestamp}`, status: 'success' as const, timestamp });
const btc = (timestamp: number) => ({ id: `btc-${timestamp}`, status: 'success' as const, timestamp });

describe('sortActivityItems', () => {
  it('puts the newest first regardless of which chain it came from', () => {
    // Concatenation order is Stacks then Bitcoin, so this is the case that
    // used to come out backwards.
    const sorted = sortActivityItems([stx(1_000), btc(9_000)]);

    expect(sorted.map((item) => item.id)).toEqual(['btc-9000', 'stx-1000']);
  });

  it('keeps pending ahead of anything confirmed, however old', () => {
    const pending = { id: 'pending', status: 'pending' as const, timestamp: undefined };
    const sorted = sortActivityItems([stx(9_000), pending]);

    expect(sorted[0].id).toBe('pending');
  });

  it('orders several pending items among themselves by time', () => {
    const older = { id: 'older', status: 'pending' as const, timestamp: 1_000 };
    const newer = { id: 'newer', status: 'pending' as const, timestamp: 5_000 };

    expect(sortActivityItems([older, newer]).map((i) => i.id)).toEqual([
      'newer',
      'older',
    ]);
  });

  it('sends an item with no timestamp to the back rather than the front', () => {
    // A missing time must not read as 1970 and jump the queue, nor as now.
    const undated = { id: 'undated', status: 'success' as const, timestamp: undefined };
    const sorted = sortActivityItems([undated, stx(1_000)]);

    expect(sorted.map((item) => item.id)).toEqual(['stx-1000', 'undated']);
  });

  it('does not mutate the array it was given', () => {
    const items = [stx(1_000), btc(9_000)];
    sortActivityItems(items);

    expect(items.map((item) => item.id)).toEqual(['stx-1000', 'btc-9000']);
  });

  it('handles an empty list', () => {
    expect(sortActivityItems([])).toEqual([]);
  });
});
