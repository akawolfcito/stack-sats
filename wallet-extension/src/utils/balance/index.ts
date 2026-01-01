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
 * Fetch account balances from the Stacks API
 */
export async function fetchAccountBalances(
  address: string,
  network?: NetworkName
): Promise<AccountBalances | null> {
  const apiUrl = getApiUrl(network);
  const url = `${apiUrl}/extended/v1/address/${address}/balances`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      secureLog("Balance fetch failed", { status: response.status, address });
      return null;
    }

    const data = await response.json();
    secureLog("Balance fetched", { address: address.slice(0, 8) + "..." });
    return data as AccountBalances;
  } catch (error) {
    secureLog("Balance fetch error", { error: String(error) });
    return null;
  }
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
