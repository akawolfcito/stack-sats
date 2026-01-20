/**
 * Assets Registry - V82
 *
 * Centralized source of truth for all core assets supported by the wallet.
 * Used by both Home Assets list and Asset Detail screens.
 */

export type AssetKind = 'stacks' | 'bitcoin';

export interface AssetDefinition {
  /** Unique identifier (used in routes) */
  id: string;
  /** Display symbol (e.g., "STX", "BTC") */
  symbol: string;
  /** Full name (e.g., "Stacks", "Bitcoin") */
  name: string;
  /** Asset kind for grouping */
  kind: AssetKind;
  /** Whether the asset is currently available/implemented */
  available: boolean;
  /** Number of decimal places for display */
  decimals: number;
  /** Icon gradient color */
  iconColor: string;
  /** Explorer base URL pattern (use {address} or {txid} placeholders) */
  explorerAddressUrl?: string;
  /** Description shown in detail view when unavailable */
  unavailableMessage?: string;
}

/**
 * Core assets registry
 * Single source of truth for the asset list
 */
export const ASSETS_REGISTRY: AssetDefinition[] = [
  {
    id: 'stx',
    symbol: 'STX',
    name: 'Stacks',
    kind: 'stacks',
    available: true,
    decimals: 6,
    iconColor: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.1))',
    explorerAddressUrl: 'https://explorer.hiro.so/address/{address}',
  },
  {
    id: 'btc',
    symbol: 'BTC',
    name: 'Bitcoin',
    kind: 'bitcoin',
    available: false,
    decimals: 8,
    iconColor: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.1))',
    unavailableMessage: 'This asset is not supported in this release.',
  },
  {
    id: 'runes',
    symbol: 'R',
    name: 'Runes',
    kind: 'bitcoin',
    available: false,
    decimals: 0,
    iconColor: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(236, 72, 153, 0.1))',
    unavailableMessage: 'This asset is not supported in this release.',
  },
  {
    id: 'inscriptions',
    symbol: 'O',
    name: 'Inscriptions',
    kind: 'bitcoin',
    available: false,
    decimals: 0,
    iconColor: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(234, 179, 8, 0.1))',
    unavailableMessage: 'This asset is not supported in this release.',
  },
];

/**
 * Get asset definition by ID
 */
export function getAssetById(id: string): AssetDefinition | undefined {
  return ASSETS_REGISTRY.find((asset) => asset.id === id);
}

/**
 * Get all available assets
 */
export function getAvailableAssets(): AssetDefinition[] {
  return ASSETS_REGISTRY.filter((asset) => asset.available);
}

/**
 * Get all Stacks-kind assets
 */
export function getStacksAssets(): AssetDefinition[] {
  return ASSETS_REGISTRY.filter((asset) => asset.kind === 'stacks');
}

/**
 * Get all Bitcoin-kind assets
 */
export function getBitcoinAssets(): AssetDefinition[] {
  return ASSETS_REGISTRY.filter((asset) => asset.kind === 'bitcoin');
}

/**
 * Check if an asset ID is valid
 */
export function isValidAssetId(id: string): boolean {
  return ASSETS_REGISTRY.some((asset) => asset.id === id);
}
