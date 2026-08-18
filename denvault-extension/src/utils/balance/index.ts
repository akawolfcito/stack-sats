/**
 * Balance utilities for fetching STX and token balances
 */

import { getSelectedNetwork, type NetworkName } from "../network";
import { secureLog } from "../security/logger";

/**
 * API base URLs for each network
 */
const API_URLS: Record<NetworkName, string> = {
  mainnet: "https://api.hiro.so",
  testnet: "https://api.testnet.hiro.so",
  devnet: "", // Will use Platform Hiro API key
};

/**
 * Get the API URL for the current or specified network
 */
function getApiUrl(network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();

  if (selectedNetwork === "devnet") {
    // Use Platform Hiro API for devnet
    const apiKey = import.meta.env.VITE_PLATFORM_HIRO_API_KEY;
    if (apiKey) {
      return `https://api.platform.hiro.so/v1/ext/${apiKey}/stacks-blockchain-api`;
    }
    // Fallback to testnet API if no key
    return API_URLS.testnet;
  }

  return API_URLS[selectedNetwork];
}

/**
 * STX Balance response from API
 */
export interface StxBalance {
  balance: string; // In microSTX
  total_sent: string;
  total_received: string;
  lock_height: number;
  lock_tx_id: string;
  locked: string;
}

/**
 * Full balance response from API
 */
export interface AccountBalances {
  stx: StxBalance;
  fungible_tokens: Record<string, { balance: string; total_sent: string; total_received: string }>;
  non_fungible_tokens: Record<string, { count: string; total_sent: string; total_received: string }>;
}

/**
 * How long one answer stands in for the same question.
 *
 * Both callers of this endpoint run back to back: loadBalance goes through
 * fetchStxBalance and loadTokens through fetchFungibleTokens, so every
 * mount, account switch, network change and refresh asked Hiro twice for
 * the same document. Long enough to collapse that pair, short enough that
 * pressing refresh a second time still reaches the chain.
 */
export const BALANCE_CACHE_MS = 3_000;

/** How long to leave a rate limited API alone when it sends no Retry-After. */
export const RATE_LIMIT_COOLDOWN_MS = 10_000;

interface CachedBalances {
  at: number;
  data: AccountBalances;
}

/** Keyed by API URL and address: never serve one account's balance as another's. */
const balanceCache = new Map<string, CachedBalances>();
/** Callers that arrive while a request is open wait on that request. */
const inFlight = new Map<string, Promise<AccountBalances | null>>();
/** Keyed by API URL: mainnet answering 429 says nothing about testnet. */
const cooldownUntil = new Map<string, number>();

/** Drop every cached answer and cooldown. For tests and for a wallet switch. */
export function resetBalanceCache(): void {
  balanceCache.clear();
  inFlight.clear();
  cooldownUntil.clear();
}

/**
 * How long to wait after a 429, from the header when the server sends one.
 * Retry-After may be seconds or an HTTP date; anything unreadable falls back
 * to the default rather than to zero, which would resume the hammering.
 */
function cooldownFrom(response: { headers?: { get(name: string): string | null } }): number {
  const header = response.headers?.get("retry-after");
  if (!header) return RATE_LIMIT_COOLDOWN_MS;

  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;

  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.max(date - Date.now(), 0);

  return RATE_LIMIT_COOLDOWN_MS;
}

/**
 * Fetch account balances from the Stacks API
 */
export async function fetchAccountBalances(
  address: string,
  network?: NetworkName
): Promise<AccountBalances | null> {
  const apiUrl = getApiUrl(network);
  const url = `${apiUrl}/extended/v1/address/${address}/balances`;
  const now = Date.now();

  const cached = balanceCache.get(url);
  if (cached && now - cached.at < BALANCE_CACHE_MS) {
    return cached.data;
  }

  const cooling = cooldownUntil.get(apiUrl);
  if (cooling !== undefined && now < cooling) {
    // Asking again is what got us limited. The caller reports "unavailable".
    return null;
  }

  const open = inFlight.get(url);
  if (open) return open;

  const request = (async (): Promise<AccountBalances | null> => {
    try {
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 429) {
          cooldownUntil.set(apiUrl, Date.now() + cooldownFrom(response));
        }
        secureLog("Balance fetch failed", { status: response.status, address });
        return null;
      }

      const data = (await response.json()) as AccountBalances;
      balanceCache.set(url, { at: Date.now(), data });
      secureLog("Balance fetched", { address: address.slice(0, 8) + "..." });
      return data;
    } catch (error) {
      secureLog("Balance fetch error", { error: String(error) });
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();

  inFlight.set(url, request);
  return request;
}

/**
 * Fetch only STX balance (simpler response)
 */
export async function fetchStxBalance(
  address: string,
  network?: NetworkName
): Promise<string | null> {
  const balances = await fetchAccountBalances(address, network);
  if (!balances) return null;
  return balances.stx.balance;
}

/**
 * Fungible token balance type
 */
export interface FungibleTokenBalance {
  balance: string;
  total_sent: string;
  total_received: string;
}

/**
 * Fetch fungible tokens for an address
 */
export async function fetchFungibleTokens(
  address: string,
  network?: NetworkName
): Promise<Record<string, FungibleTokenBalance> | null> {
  const balances = await fetchAccountBalances(address, network);
  if (!balances) return null;
  return balances.fungible_tokens;
}

/**
 * Convert microSTX to STX (divide by 1,000,000)
 */
export function microStxToStx(microStx: string | number): number {
  const micro = typeof microStx === "string" ? BigInt(microStx) : BigInt(microStx);
  // Convert to number with 6 decimal places
  return Number(micro) / 1_000_000;
}

/**
 * Format STX balance for display
 */
export function formatStxBalance(microStx: string | number): string {
  const stx = microStxToStx(microStx);

  // Format with up to 6 decimal places, removing trailing zeros
  if (stx === 0) return "0";

  if (stx >= 1_000_000) {
    return (stx / 1_000_000).toFixed(2) + "M";
  }

  if (stx >= 1_000) {
    return (stx / 1_000).toFixed(2) + "K";
  }

  // Show up to 6 decimal places
  const formatted = stx.toFixed(6);
  // Remove trailing zeros
  return formatted.replace(/\.?0+$/, "");
}

/**
 * Format USD value
 */
export function formatUsdValue(value: number): string {
  if (value >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "M";
  }
  if (value >= 1_000) {
    return "$" + (value / 1_000).toFixed(2) + "K";
  }
  return "$" + value.toFixed(2);
}
