/**
 * Bitcoin history in the shape the shared Activity list renders.
 *
 * This lived inside UserHomeView, so the Bitcoin asset detail screen had no
 * way to reuse it and showed "No activity yet" no matter how many Bitcoin
 * transactions existed. Two screens describing the same history differently
 * is how a wallet ends up contradicting itself, so the mapping lives here
 * and both read from it.
 */

import type { BtcActivityItem } from '../bitcoin/activity';
import { formatBtcBalance } from '../bitcoin/balance';
import { formatRelativeTime, truncateAddress as truncateTxAddress } from '../transactions';

export interface BtcActivityRow {
  txId: string;
  status: 'pending' | 'success' | 'failed';
  title: string;
  subtitle?: string;
  amountText: string;
  timeText: string;
  /** Seconds since the epoch, for ordering. Absent while unconfirmed. */
  timestamp?: number;
  isOutgoing: boolean;
  /** Neither in nor out: the wallet paid itself. */
  isNeutral: boolean;
}

export function toBtcActivityRows(items: BtcActivityItem[]): BtcActivityRow[] {
  return items.map((item) => ({
    txId: item.txid,
    status: item.confirmed ? ('success' as const) : ('pending' as const),
    title: item.isSelfTransfer ? 'Moved Between Your Addresses' : 'Bitcoin Transfer',
    subtitle: item.counterparty
      ? item.isSelfTransfer
        ? `To your ${truncateTxAddress(item.counterparty, 4)}`
        : `${item.isOutgoing ? 'To' : 'From'} ${truncateTxAddress(item.counterparty, 4)}`
      : undefined,
    amountText: `${formatBtcBalance(item.amountSats)} BTC`,
    // Seconds, not milliseconds: formatRelativeTime compares against
    // Date.now() / 1000. Multiplying made every Bitcoin row read "Just now",
    // including one from hours earlier.
    timeText: item.blockTime ? formatRelativeTime(item.blockTime) : 'Pending',
    timestamp: item.blockTime,
    isOutgoing: item.isOutgoing,
    // A self transfer gets no sign at all: the money did not arrive and did
    // not leave, it only changed address.
    isNeutral: item.isSelfTransfer,
  }));
}
