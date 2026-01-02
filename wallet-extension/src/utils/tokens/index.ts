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
 * Parse token contract ID from the full key format
 * Input: "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token::fari"
 * Output: { address: "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token", tokenName: "fari" }
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
 * Extract just the contract name from full contract ID
 * Input: "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token"
 * Output: "fari-token"
 */
export function extractContractName(contractAddress: string): string {
  const parts = contractAddress.split(".");
  return parts[1] || contractAddress;
}

/**
 * Format token balance with proper decimals
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
 * Fetch token metadata from Hiro API
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
 * Build TokenInfo from balance and metadata
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
 * Fetch all token info for a list of fungible tokens
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
 * Clear the metadata cache (useful for testing or refresh)
 */
export function clearTokenMetadataCache(): void {
  metadataCache.clear();
}
