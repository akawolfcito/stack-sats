/**
 * Bitcoin Balance utilities using Mempool.space API
 *
 * Supports both mainnet and testnet via different API endpoints.
 * Uses public Mempool.space API (no auth required).
 */

import { getSelectedNetwork, type NetworkName } from '../network';
import { secureLog } from '../security/logger';

/**
 * Mempool.space API URLs
 */
const MEMPOOL_URLS: Record<NetworkName, string> = {
  mainnet: 'https://mempool.space/api',
  testnet: 'https://mempool.space/testnet/api',
  devnet: 'https://mempool.space/testnet/api', // Devnet uses testnet for BTC
};

/**
 * Get the Mempool API URL for the current or specified network
 */
function getMempoolUrl(network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();
  return MEMPOOL_URLS[selectedNetwork];
}

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
  const apiUrl = getMempoolUrl(network);
  const url = `${apiUrl}/address/${address}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      // 400 means address not found or invalid - return empty balance
      if (response.status === 400) {
        secureLog('BTC address not found (new address)', { address: address.slice(0, 8) + '...' });
        return null;
      }
      secureLog('BTC balance fetch failed', { status: response.status, address: address.slice(0, 8) + '...' });
      return null;
    }

    const data = await response.json();
    secureLog('BTC balance fetched', { address: address.slice(0, 8) + '...' });
    return data as BtcAddressInfo;
  } catch (error) {
    secureLog('BTC balance fetch error', { error: String(error) });
    return null;
  }
}

/**
 * Fetch Bitcoin balance for an address
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
 * Get Mempool.space explorer URL for an address
 */
export function getBtcExplorerUrl(address: string, network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();

  if (selectedNetwork === 'mainnet') {
    return `https://mempool.space/address/${address}`;
  }

  return `https://mempool.space/testnet/address/${address}`;
}

/**
 * Get Mempool.space explorer URL for a transaction
 */
export function getBtcTxExplorerUrl(txid: string, network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();

  if (selectedNetwork === 'mainnet') {
    return `https://mempool.space/tx/${txid}`;
  }

  return `https://mempool.space/testnet/tx/${txid}`;
}
