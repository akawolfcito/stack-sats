/**
 * Multi-wallet management module
 * Uses WalletVault for secure chrome.storage.local storage
 */

import { type EncryptedData } from "../security/encryption";
import { secureLog } from "../security/logger";
import { walletVault, type VaultEntry, getVaultState, saveVaultState } from "../security/vault";

// Re-export types
export type { VaultEntry as WalletEntry };

/**
 * Initialize wallet system (call on app start)
 */
export async function initializeWallets(): Promise<void> {
  await walletVault.initialize();
}

/**
 * Get all wallets from storage
 */
export async function getWalletsAsync(): Promise<VaultEntry[]> {
  const state = await getVaultState();
  return state.entries;
}

/**
 * Get active wallet ID
 */
export async function getActiveWalletIdAsync(): Promise<string | null> {
  return walletVault.getActiveId();
}

/**
 * Set active wallet ID
 */
export async function setActiveWalletIdAsync(id: string): Promise<void> {
  await walletVault.setActiveId(id);
}

/**
 * Get the active wallet entry
 */
export async function getActiveWalletAsync(): Promise<VaultEntry | null> {
  return walletVault.getActiveEntry();
}

/**
 * Add a new wallet
 */
export async function addWalletAsync(
  encryptedData: EncryptedData,
  name?: string
): Promise<VaultEntry> {
  const state = await getVaultState();
  const walletNumber = state.entries.length + 1;

  const newEntry: VaultEntry = {
    id: crypto.randomUUID(),
    name: name || `Wallet ${walletNumber}`,
    encryptedData,
    createdAt: Date.now(),
    version: 1,
  };

  state.entries.push(newEntry);

  // Set as active if it's the first wallet
  if (state.entries.length === 1) {
    state.activeId = newEntry.id;
  }

  await saveVaultState(state);
  secureLog("Wallet added", { id: newEntry.id, name: newEntry.name });

  return newEntry;
}

/**
 * Update a wallet's encrypted data
 */
export async function updateWalletAsync(
  id: string,
  encryptedData: EncryptedData
): Promise<boolean> {
  const state = await getVaultState();
  const entry = state.entries.find((e) => e.id === id);
  if (!entry) return false;

  entry.encryptedData = encryptedData;
  await saveVaultState(state);
  return true;
}

/**
 * Rename a wallet
 */
export async function renameWalletAsync(id: string, newName: string): Promise<boolean> {
  return walletVault.renameEntry(id, newName);
}

/**
 * Delete a wallet
 */
export async function deleteWalletAsync(id: string): Promise<boolean> {
  return walletVault.deleteEntry(id);
}

/**
 * Check if there are any wallets
 */
export async function hasWalletsAsync(): Promise<boolean> {
  return walletVault.hasEntries();
}

/**
 * Get wallet count
 */
export async function getWalletCountAsync(): Promise<number> {
  const state = await getVaultState();
  return state.entries.length;
}

/**
 * Import a wallet from backup
 */
export async function importWalletAsync(
  entry: VaultEntry,
  replaceExisting: boolean = false
): Promise<"added" | "replaced" | null> {
  const success = await walletVault.importEntry(entry, replaceExisting);
  if (!success) return null;
  return replaceExisting ? "replaced" : "added";
}

/**
 * Check if a wallet ID already exists
 */
export async function walletExistsAsync(id: string): Promise<boolean> {
  const state = await getVaultState();
  return state.entries.some((e) => e.id === id);
}

/**
 * Delete all wallets
 */
export async function deleteAllWalletsAsync(): Promise<void> {
  await walletVault.clearVault();
}

/**
 * Migrate legacy localStorage data to chrome.storage.local
 */
export async function migrateLegacyStorage(): Promise<{
  migrated: boolean;
  count: number;
}> {
  const result = await walletVault.migrateLegacyLocalStorage();
  return {
    migrated: result.migrated,
    count: result.entriesCount,
  };
}

/**
 * Check if there's legacy data that needs migration
 */
export function hasLegacyData(): boolean {
  return walletVault.hasLegacyData();
}
