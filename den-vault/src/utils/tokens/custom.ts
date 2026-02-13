/**
 * Custom Token Storage Module
 * Handles persistence and retrieval of user-added SIP-010 tokens
 */

import type { NetworkName } from "../network";

/**
 * Custom token definition (persisted)
 */
export interface CustomToken {
  type: "sip10";
  chainId: NetworkName;
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  color: string;
  image?: string;
  addedAt: number;
}

// Storage keys
const CUSTOM_TOKENS_KEY = "custom_tokens";
const ENABLED_TOKENS_KEY = "enabled_tokens";

/**
 * Generate a tokenKey for identity/lookup
 * Format: chainId:contractId
 */
export function getTokenKey(chainId: NetworkName, contractId: string): string {
  return `${chainId}:${contractId}`;
}

/**
 * Generate a random color for token display
 */
export function generateTokenColor(): string {
  const colors = [
    "#7c3aed", "#f97316", "#eab308", "#3b82f6",
    "#22c55e", "#ec4899", "#06b6d4", "#f7931a",
    "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Get all custom tokens from storage
 */
export function getCustomTokens(): CustomToken[] {
  try {
    const stored = localStorage.getItem(CUSTOM_TOKENS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as CustomToken[];
  } catch {
    return [];
  }
}

/**
 * Get custom tokens for a specific network
 */
export function getCustomTokensForNetwork(network: NetworkName): CustomToken[] {
  return getCustomTokens().filter((t) => t.chainId === network);
}

/**
 * Save custom tokens to storage
 */
export function saveCustomTokens(tokens: CustomToken[]): void {
  localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
}

/**
 * Add a new custom token
 * Returns the added token or null if it already exists
 */
export function addCustomToken(
  token: Omit<CustomToken, "type" | "color" | "addedAt">
): CustomToken | null {
  const tokens = getCustomTokens();
  const tokenKey = getTokenKey(token.chainId, token.contractId);

  // Check if already exists
  const exists = tokens.some(
    (t) => getTokenKey(t.chainId, t.contractId) === tokenKey
  );

  if (exists) {
    return null;
  }

  const newToken: CustomToken = {
    ...token,
    type: "sip10",
    color: generateTokenColor(),
    addedAt: Date.now(),
  };

  tokens.push(newToken);
  saveCustomTokens(tokens);

  // Auto-enable the token
  enableToken(token.contractId);

  return newToken;
}

/**
 * Remove a custom token
 */
export function removeCustomToken(
  chainId: NetworkName,
  contractId: string
): boolean {
  const tokens = getCustomTokens();
  const tokenKey = getTokenKey(chainId, contractId);

  const filtered = tokens.filter(
    (t) => getTokenKey(t.chainId, t.contractId) !== tokenKey
  );

  if (filtered.length === tokens.length) {
    return false; // Token not found
  }

  saveCustomTokens(filtered);

  // Also disable the token
  disableToken(contractId);

  return true;
}

/**
 * Get a custom token by key
 */
export function getCustomTokenByKey(
  chainId: NetworkName,
  contractId: string
): CustomToken | null {
  const tokenKey = getTokenKey(chainId, contractId);
  return (
    getCustomTokens().find(
      (t) => getTokenKey(t.chainId, t.contractId) === tokenKey
    ) || null
  );
}

/**
 * Get enabled tokens set
 */
export function getEnabledTokens(): Set<string> {
  try {
    const stored = localStorage.getItem(ENABLED_TOKENS_KEY);
    if (!stored) return new Set(["STX"]);
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    return new Set(["STX"]);
  }
}

/**
 * Save enabled tokens set
 */
export function saveEnabledTokens(tokens: Set<string>): void {
  localStorage.setItem(ENABLED_TOKENS_KEY, JSON.stringify(Array.from(tokens)));
}

/**
 * Enable a token (add to enabled set)
 */
export function enableToken(contractId: string): void {
  const enabled = getEnabledTokens();
  enabled.add(contractId);
  saveEnabledTokens(enabled);
}

/**
 * Disable a token (remove from enabled set)
 */
export function disableToken(contractId: string): void {
  const enabled = getEnabledTokens();
  enabled.delete(contractId);
  saveEnabledTokens(enabled);
}

/**
 * Check if a token is enabled
 */
export function isTokenEnabled(contractId: string): boolean {
  return getEnabledTokens().has(contractId);
}

/**
 * Toggle token enabled state
 */
export function toggleToken(contractId: string, enabled: boolean): void {
  if (enabled) {
    enableToken(contractId);
  } else {
    disableToken(contractId);
  }
}
