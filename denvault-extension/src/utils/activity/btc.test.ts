/**
 * The Bitcoin to Activity row mapping.
 *
 * It lived inside UserHomeView, so the Bitcoin asset detail screen could not
 * reuse it: loadTransactions returned early unless the asset was STX, and
 * /asset/btc showed "No activity yet" however many Bitcoin transactions the
 * wallet had. Extracted here so both screens tell the same story, and so
 * the story is checkable without a browser.
 */

import { describe, it, expect } from 'vitest';
import { toBtcActivityRows } from './btc';

const base = {
  txid: 'tx-1',
  isOutgoing: true,
  isSelfTransfer: false,
  amountSats: 50_000,
  feeSats: 1_000,
  confirmed: true,
  blockTime: 1_786_992_441,
  counterparty: 'mw7qXcn8GSjKHLXQZJ5YVzzGvyij3rLiVX',
};

describe('toBtcActivityRows', () => {
  it('describes an ordinary payment', () => {
    const [row] = toBtcActivityRows([base]);

    expect(row.title).toBe('Bitcoin Transfer');
    expect(row.subtitle).toMatch(/^To /);
    expect(row.amountText).toBe('0.0005 BTC');
    expect(row.isNeutral).toBe(false);
    expect(row.status).toBe('success');
    expect(row.timestamp).toBe(base.blockTime);
  });

  it('names a move between the wallet\'s own addresses', () => {
    const [row] = toBtcActivityRows([{ ...base, isSelfTransfer: true }]);

    expect(row.title).toBe('Moved Between Your Addresses');
    expect(row.subtitle).toMatch(/^To your /);
    // Neither in nor out, so the row shows no sign and no success colour.
    expect(row.isNeutral).toBe(true);
  });

  it('marks an unconfirmed transaction pending, with no timestamp to sort by', () => {
    const [row] = toBtcActivityRows([
      { ...base, confirmed: false, blockTime: undefined },
    ]);

    expect(row.status).toBe('pending');
    expect(row.timeText).toBe('Pending');
    expect(row.timestamp).toBeUndefined();
  });

  it('carries the unit, because a bare number is ambiguous in Bitcoin', () => {
    const [row] = toBtcActivityRows([{ ...base, amountSats: 90_000 }]);

    expect(row.amountText).toBe('0.0009 BTC');
  });

  it('leaves the subtitle out when there is no counterparty', () => {
    const [row] = toBtcActivityRows([{ ...base, counterparty: undefined }]);

    expect(row.subtitle).toBeUndefined();
  });

  it('maps an empty history to an empty list', () => {
    expect(toBtcActivityRows([])).toEqual([]);
  });
});
