/**
 * SIP-010 Fungible Token utilities
 * Handles fetching token metadata and formatting balances
 */

import { getSelectedNetwork, type NetworkName } from "../network";
import { secureLog } from "../security/logger";

/**
 * Metadata API URLs
 */
const METADATA_API_URLS: Record<NetworkName, string> = {
  mainnet: "https://api.hiro.so/metadata/v1",
  testnet: "https://api.testnet.hiro.so/metadata/v1",
  devnet: "https://api.testnet.hiro.so/metadata/v1", // Devnet uses testnet metadata
};

/**
 * Token metadata from Hiro API
 */
export interface TokenMetadata {
  name: string;
  symbol: string;
  decimals: number;
  total_supply?: string;
  token_uri?: string;
  image_uri?: string;
  image_thumbnail_uri?: string;
  description?: string;
}

/**
 * Combined token info for UI display
 */
export interface TokenInfo {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: string;
  formattedBalance: string;
  imageUri?: string;
}

/**
 * Fungible token balance from balances API
 */
export interface FungibleTokenBalance {
  balance: string;
  total_sent: string;
  total_received: string;
}

/**
 * In-memory cache for token metadata
 */
const metadataCache = new Map<string, TokenMetadata>();

/**
 * Parse token contract ID from the full key format.
 *
 * @param fullKey - The full token identifier from the balances API
 * @returns Object with contract address and token name
 *
 * @example
 * ```ts
 * const { address, tokenName } = parseTokenContractId(
 *   "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token::fari"
 * );
 * // address: "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token"
 * // tokenName: "fari"
 * ```
 */
export function parseTokenContractId(fullKey: string): {
  address: string;
  tokenName: string;
} {
  const parts = fullKey.split("::");
  return {
    address: parts[0] || fullKey,
    tokenName: parts[1] || "",
  };
}

/**
 * Extract just the contract name from a full contract ID.
 *
 * @param contractAddress - Full contract address (e.g., "SP...XYZ.contract-name")
 * @returns The contract name portion after the dot
 *
 * @example
 * ```ts
 * const name = extractContractName("SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token");
 * // name: "fari-token"
 * ```
 */
export function extractContractName(contractAddress: string): string {
  const parts = contractAddress.split(".");
  return parts[1] || contractAddress;
}

/**
 * Format a token balance with proper decimal placement and thousand separators.
 *
 * @param balance - Raw balance string (in smallest unit, e.g., microunits)
 * @param decimals - Number of decimal places for the token
 * @returns Formatted balance string with decimals and commas
 *
 * @example
 * ```ts
 * formatTokenBalance("1500000", 6);  // "1.5"
 * formatTokenBalance("1234567890", 6);  // "1,234.56789"
 * formatTokenBalance("0", 6);  // "0"
 * ```
 */
export function formatTokenBalance(balance: string, decimals: number): string {
  if (!balance || balance === "0") return "0";

  try {
    const balanceBigInt = BigInt(balance);
    if (balanceBigInt === 0n) return "0";

    const divisor = BigInt(10 ** decimals);
    const wholePart = balanceBigInt / divisor;
    const fractionalPart = balanceBigInt % divisor;

    if (fractionalPart === 0n) {
      return formatWithCommas(wholePart.toString());
    }

    // Pad fractional part with leading zeros
    const fractionalStr = fractionalPart.toString().padStart(decimals, "0");
    // Remove trailing zeros
    const trimmedFractional = fractionalStr.replace(/0+$/, "");

    if (!trimmedFractional) {
      return formatWithCommas(wholePart.toString());
    }

    return `${formatWithCommas(wholePart.toString())}.${trimmedFractional}`;
  } catch {
    return "0";
  }
}

/**
 * Add thousand separators to number string
 */
function formatWithCommas(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Fetch SIP-010 token metadata from the Hiro Metadata API.
 * Results are cached in memory to avoid repeated API calls.
 *
 * @param contractAddress - The token contract address (e.g., "SP...XYZ.token-contract")
 * @param network - Optional network override (defaults to selected network)
 * @returns Token metadata or null if fetch fails
 *
 * @example
 * ```ts
 * const metadata = await fetchTokenMetadata("SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token");
 * if (metadata) {
 *   console.log(metadata.symbol, metadata.decimals);
 * }
 * ```
 */
export async function fetchTokenMetadata(
  contractAddress: string,
  network?: NetworkName
): Promise<TokenMetadata | null> {
  // Check cache first
  const cacheKey = `${network || getSelectedNetwork()}-${contractAddress}`;
  const cached = metadataCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const selectedNetwork = network || getSelectedNetwork();
  const apiUrl = METADATA_API_URLS[selectedNetwork];
  const url = `${apiUrl}/ft/${contractAddress}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      secureLog("Token metadata fetch failed", {
        status: response.status,
        contract: contractAddress.slice(0, 20) + "...",
      });
      return null;
    }

    const data = (await response.json()) as TokenMetadata;

    // Cache the result
    metadataCache.set(cacheKey, data);

    secureLog("Token metadata fetched", {
      symbol: data.symbol,
      contract: contractAddress.slice(0, 20) + "...",
    });

    return data;
  } catch (error) {
    secureLog("Token metadata fetch error", { error: String(error) });
    return null;
  }
}

/**
 * Build a TokenInfo object from raw balance data and optional metadata.
 * Falls back to contract info if metadata is unavailable.
 *
 * @param contractId - Full contract identifier (with :: separator)
 * @param balance - Balance data from the balances API
 * @param metadata - Optional token metadata from the metadata API
 * @returns Complete TokenInfo object for UI display
 *
 * @example
 * ```ts
 * const tokenInfo = buildTokenInfo(
 *   "SP...XYZ.token::tkn",
 *   { balance: "1000000", total_sent: "0", total_received: "1000000" },
 *   { name: "My Token", symbol: "TKN", decimals: 6 }
 * );
 * ```
 */
export function buildTokenInfo(
  contractId: string,
  balance: FungibleTokenBalance,
  metadata: TokenMetadata | null
): TokenInfo {
  const { address, tokenName } = parseTokenContractId(contractId);
  const contractName = extractContractName(address);

  // Use metadata if available, otherwise fallback to contract info
  const name = metadata?.name || contractName;
  const symbol = metadata?.symbol || tokenName || contractName;
  const decimals = metadata?.decimals ?? 6; // Default to 6 decimals like STX

  return {
    contractId,
    name,
    symbol,
    decimals,
    balance: balance.balance,
    formattedBalance: formatTokenBalance(balance.balance, decimals),
    imageUri: metadata?.image_uri || metadata?.image_thumbnail_uri,
  };
}

/**
 * Fetch metadata and build TokenInfo for all fungible tokens.
 * Limits to first 20 tokens for performance. Fetches metadata in parallel.
 *
 * @param fungibleTokens - Record of token balances keyed by contract ID
 * @param network - Optional network override (defaults to selected network)
 * @returns Array of TokenInfo objects ready for UI display
 *
 * @example
 * ```ts
 * const balances = await fetchAccountBalances(address);
 * const tokens = await fetchAllTokenInfo(balances.fungible_tokens);
 * tokens.forEach(t => console.log(t.symbol, t.formattedBalance));
 * ```
 */
export async function fetchAllTokenInfo(
  fungibleTokens: Record<string, FungibleTokenBalance>,
  network?: NetworkName
): Promise<TokenInfo[]> {
  const contractIds = Object.keys(fungibleTokens);

  // Limit to first 20 tokens for performance
  const limitedIds = contractIds.slice(0, 20);

  // Fetch metadata in parallel
  const metadataPromises = limitedIds.map(async (contractId) => {
    const { address } = parseTokenContractId(contractId);
    const metadata = await fetchTokenMetadata(address, network);
    return { contractId, metadata };
  });

  const results = await Promise.all(metadataPromises);

  // Build TokenInfo for each token
  return results.map(({ contractId, metadata }) => {
    const balance = fungibleTokens[contractId];
    return buildTokenInfo(contractId, balance, metadata);
  });
}

/**
 * Clear the in-memory token metadata cache.
 * Useful for testing or forcing a refresh of token data.
 *
 * @example
 * ```ts
 * clearTokenMetadataCache();
 * // Next fetchTokenMetadata call will hit the API
 * ```
 */
export function clearTokenMetadataCache(): void {
  metadataCache.clear();
}
