/**
 * Bitcoin transaction history.
 *
 * The Activity list was Stacks only, so a Bitcoin send vanished from the
 * wallet the moment the result screen was dismissed: broadcast, visible
 * on a block explorer, and nowhere in the app that sent it.
 *
 * Esplora returns whole transactions rather than a per-address ledger, so
 * direction and amount are worked out here by comparing inputs and
 * outputs against the addresses this wallet controls.
 */

import type { NetworkName } from '../network';
import { getSelectedNetwork } from '../network';
import { secureLog } from '../security/logger';
import { esploraFetch } from './endpoints';

interface EsploraVout {
  scriptpubkey_address?: string;
  value: number;
}

interface EsploraVin {
  prevout?: EsploraVout | null;
}

interface EsploraTx {
  txid: string;
  fee: number;
  vin: EsploraVin[];
  vout: EsploraVout[];
  status: {
    confirmed: boolean;
    block_time?: number;
  };
}

export interface BtcActivityItem {
  txid: string;
  /** True when this wallet spent, false when it received. */
  isOutgoing: boolean;
  /** Sats sent to someone else, or sats received. Never the raw net. */
  amountSats: number;
  /** Miner fee, only meaningful on outgoing transactions. */
  feeSats: number;
  confirmed: boolean;
  /** Seconds since the epoch, or undefined while unconfirmed. */
  blockTime?: number;
  /** The other party: where it went, or where it came from. */
  counterparty?: string;
}

/**
 * Classify one transaction from the point of view of a set of addresses.
 *
 * Exported for tests: the input/output arithmetic is the part worth
 * pinning, and it is easy to get subtly wrong in a way that misreports
 * someone's own history back to them.
 */
export function describeBtcTx(
  tx: EsploraTx,
  owned: Set<string>
): BtcActivityItem {
  const spent = tx.vin.reduce((total, input) => {
    const address = input.prevout?.scriptpubkey_address;
    return address && owned.has(address) ? total + (input.prevout?.value ?? 0) : total;
  }, 0);

  const isOutgoing = spent > 0;

  if (isOutgoing) {
    // What actually left the wallet, change excluded. The fee is reported
    // separately rather than folded in, so the number matches what the
    // user typed into the amount field.
    const toOthers = tx.vout.filter(
      (output) => !output.scriptpubkey_address || !owned.has(output.scriptpubkey_address)
    );
    const amountSats = toOthers.reduce((total, output) => total + output.value, 0);

    return {
      txid: tx.txid,
      isOutgoing: true,
      amountSats,
      feeSats: tx.fee ?? 0,
      confirmed: tx.status.confirmed,
      blockTime: tx.status.block_time,
      counterparty: toOthers[0]?.scriptpubkey_address,
    };
  }

  const received = tx.vout.filter(
    (output) => output.scriptpubkey_address && owned.has(output.scriptpubkey_address)
  );

  return {
    txid: tx.txid,
    isOutgoing: false,
    amountSats: received.reduce((total, output) => total + output.value, 0),
    feeSats: 0,
    confirmed: tx.status.confirmed,
    blockTime: tx.status.block_time,
    counterparty: tx.vin[0]?.prevout?.scriptpubkey_address,
  };
}

/**
 * Recent Bitcoin transactions across every address of an account.
 *
 * @returns newest first, unconfirmed ahead of confirmed. Returns an empty
 * list when the indexer cannot be reached: a missing history is a gap in
 * the view, not a claim about the wallet, and the balance beside it says
 * plainly when it could not be read.
 */
export async function fetchBtcActivity(
  addresses: string[],
  network?: NetworkName,
  limit = 20
): Promise<BtcActivityItem[]> {
  if (addresses.length === 0) return [];

  const selectedNetwork = network || getSelectedNetwork();
  const owned = new Set(addresses);
  const byTxid = new Map<string, BtcActivityItem>();

  for (const address of addresses) {
    try {
      const response = await esploraFetch(`/address/${address}/txs`, {
        network: selectedNetwork,
      });
      if (!response.ok) continue;

      const txs = (await response.json()) as EsploraTx[];
      for (const tx of txs) {
        // The same transaction can touch both of our addresses.
        if (!byTxid.has(tx.txid)) {
          byTxid.set(tx.txid, describeBtcTx(tx, owned));
        }
      }
    } catch (error) {
      secureLog('BTC activity fetch failed', { error: String(error) });
    }
  }

  return [...byTxid.values()]
    .sort((a, b) => {
      // Unconfirmed first: it is the thing the user just did.
      if (a.confirmed !== b.confirmed) return a.confirmed ? 1 : -1;
      return (b.blockTime ?? 0) - (a.blockTime ?? 0);
    })
    .slice(0, limit);
}
