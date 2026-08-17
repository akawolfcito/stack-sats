/**
 * Bitcoin Balance utilities using Mempool.space API
 *
 * Supports both mainnet and testnet via different API endpoints.
 * Uses public Mempool.space API (no auth required).
 */

import { getSelectedNetwork, type NetworkName } from '../network';
import { secureLog } from '../security/logger';
import { esploraFetch, getBtcExplorerBase } from './endpoints';

/**
 * Bitcoin address info from Mempool.space API
 */
export interface BtcAddressInfo {
  address: string;
  chain_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
  mempool_stats: {
    funded_txo_count: number;
    funded_txo_sum: number;
    spent_txo_count: number;
    spent_txo_sum: number;
    tx_count: number;
  };
}

/**
 * Simplified Bitcoin balance
 */
export interface BtcBalance {
  /** Confirmed balance in satoshis */
  confirmed: number;
  /** Unconfirmed (mempool) balance in satoshis */
  unconfirmed: number;
  /** Total balance (confirmed + unconfirmed) in satoshis */
  total: number;
  /** Total transactions */
  txCount: number;
}

/**
 * Fetch Bitcoin address info from Mempool.space
 */
export async function fetchBtcAddressInfo(
  address: string,
  network?: NetworkName
): Promise<BtcAddressInfo | null> {
  const selectedNetwork = network || getSelectedNetwork();

  try {
    const response = await esploraFetch(`/address/${address}`, {
      network: selectedNetwork,
    });

    if (!response.ok) {
      // An address the indexer has never seen is an answer: it is empty.
      // Blockstream replies 200 with zeroed stats, mempool.space replies
      // 400, so both shapes end up here as "nothing to report".
      if (response.status === 400 || response.status === 404) {
        secureLog('BTC address not found (new address)', { address: address.slice(0, 8) + '...' });
        return null;
      }
      throw new Error(`Bitcoin API answered ${response.status}`);
    }

    const data = await response.json();
    secureLog('BTC balance fetched', { address: address.slice(0, 8) + '...' });
    return data as BtcAddressInfo;
  } catch (error) {
    // Deliberately not swallowed. Returning zero here is what made an
    // unreachable network look exactly like an empty wallet, and a wallet
    // must not state a balance it does not know.
    secureLog('BTC balance fetch error', { error: String(error) });
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Has a Bitcoin transaction been mined?
 *
 * @returns true once it is in a block, false while it sits in the
 * mempool, and null when the chain could not be asked. The result screen
 * used to skip this call entirely and declare success after three
 * seconds, which told the user a transaction had confirmed when nobody
 * had checked.
 */
export async function fetchBtcTxConfirmed(
  txid: string,
  network?: NetworkName
): Promise<boolean | null> {
  const selectedNetwork = network || getSelectedNetwork();

  try {
    const response = await esploraFetch(`/tx/${txid}/status`, {
      network: selectedNetwork,
    });
    if (!response.ok) return null;

    const status = (await response.json()) as { confirmed?: boolean };
    return status.confirmed === true;
  } catch (error) {
    secureLog('BTC tx status fetch error', { error: String(error) });
    return null;
  }
}

/**
 * Fetch the Bitcoin balance of an address.
 *
 * @throws when the balance could not be read. An empty address resolves to
 * zero; an unreachable indexer does not, because those two are not the
 * same thing and the UI has to say which one it is.
 */
export async function fetchBtcBalance(
  address: string,
  network?: NetworkName
): Promise<BtcBalance> {
  const info = await fetchBtcAddressInfo(address, network);

  if (!info) {
    // Return zero balance for new/empty addresses
    return {
      confirmed: 0,
      unconfirmed: 0,
      total: 0,
      txCount: 0,
    };
  }

  const confirmed = info.chain_stats.funded_txo_sum - info.chain_stats.spent_txo_sum;
  const unconfirmed = info.mempool_stats.funded_txo_sum - info.mempool_stats.spent_txo_sum;

  return {
    confirmed,
    unconfirmed,
    total: confirmed + unconfirmed,
    txCount: info.chain_stats.tx_count + info.mempool_stats.tx_count,
  };
}

/**
 * Fetch combined BTC balance for multiple addresses (P2PKH + P2TR)
 */
export async function fetchCombinedBtcBalance(
  addresses: string[],
  network?: NetworkName
): Promise<BtcBalance> {
  const balances = await Promise.all(
    addresses.map((addr) => fetchBtcBalance(addr, network))
  );

  return balances.reduce(
    (acc, bal) => ({
      confirmed: acc.confirmed + bal.confirmed,
      unconfirmed: acc.unconfirmed + bal.unconfirmed,
      total: acc.total + bal.total,
      txCount: acc.txCount + bal.txCount,
    }),
    { confirmed: 0, unconfirmed: 0, total: 0, txCount: 0 }
  );
}

/**
 * Convert satoshis to BTC (divide by 100,000,000)
 */
export function satoshisToBtc(satoshis: number): number {
  return satoshis / 100_000_000;
}

/**
 * Format BTC balance for display
 */
export function formatBtcBalance(satoshis: number): string {
  const btc = satoshisToBtc(satoshis);

  if (btc === 0) return '0';

  // For very small amounts, show more decimals
  if (btc < 0.00001) {
    return btc.toFixed(8).replace(/\.?0+$/, '');
  }

  if (btc < 0.001) {
    return btc.toFixed(6).replace(/\.?0+$/, '');
  }

  if (btc >= 1000) {
    return btc.toFixed(2);
  }

  // Standard display: up to 8 decimals, trim trailing zeros
  return btc.toFixed(8).replace(/\.?0+$/, '');
}

/**
 * Explorer URL for an address, on the host the wallet can reach.
 */
export function getBtcExplorerUrl(address: string, network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();
  return `${getBtcExplorerBase(selectedNetwork)}/address/${address}`;
}

/**
 * Explorer URL for a transaction, on the host the wallet can reach.
 */
export function getBtcTxExplorerUrl(txid: string, network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();
  return `${getBtcExplorerBase(selectedNetwork)}/tx/${txid}`;
}
