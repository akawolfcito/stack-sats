/**
 * Multi-wallet management module
 * Now uses WalletVault for secure chrome.storage.local storage
 * Maintains backwards-compatible API with async wrappers
 */

import { type EncryptedData } from "../security/encryption";
import { secureLog } from "../security/logger";
import { walletVault, type VaultEntry, getVaultState, saveVaultState } from "../security/vault";

// Re-export types
export type { VaultEntry as WalletEntry };

// Legacy storage keys (for migration detection)
const LEGACY_WALLETS_KEY = "wallets";
const LEGACY_ACTIVE_KEY = "active_wallet_id";

/**
 * Initialize wallet system (call on app start)
 */
export async function initializeWallets(): Promise<void> {
  await walletVault.initialize();
}

/**
 * Get all wallets from storage (async)
 */
export async function getWalletsAsync(): Promise<VaultEntry[]> {
  const state = await getVaultState();
  return state.entries;
}

/**
 * Get all wallets from storage (sync - for backwards compatibility)
 * @deprecated Use getWalletsAsync() instead
 */
export function getWallets(): VaultEntry[] {
  // Fallback to localStorage for sync access during transition
  const stored = localStorage.getItem(LEGACY_WALLETS_KEY);
  if (!stored) return [];

  try {
    const wallets = JSON.parse(stored) as VaultEntry[];
    // Add version if missing (legacy data)
    return wallets.map(w => ({
      ...w,
      version: w.version || 1,
    }));
  } catch {
    return [];
  }
}

/**
 * Get active wallet ID (async)
 */
export async function getActiveWalletIdAsync(): Promise<string | null> {
  return walletVault.getActiveId();
}

/**
 * Get active wallet ID (sync - for backwards compatibility)
 * @deprecated Use getActiveWalletIdAsync() instead
 */
export function getActiveWalletId(): string | null {
  return localStorage.getItem(LEGACY_ACTIVE_KEY);
}

/**
 * Set active wallet ID (async)
 */
export async function setActiveWalletIdAsync(id: string): Promise<void> {
  await walletVault.setActiveId(id);
}

/**
 * Set active wallet ID (sync - for backwards compatibility)
 * @deprecated Use setActiveWalletIdAsync() instead
 */
export function setActiveWalletId(id: string): void {
  localStorage.setItem(LEGACY_ACTIVE_KEY, id);
}

/**
 * Get the active wallet entry (async)
 */
export async function getActiveWalletAsync(): Promise<VaultEntry | null> {
  return walletVault.getActiveEntry();
}

/**
 * Get the active wallet entry (sync - for backwards compatibility)
 * @deprecated Use getActiveWalletAsync() instead
 */
export function getActiveWallet(): VaultEntry | null {
  const wallets = getWallets();
  const activeId = getActiveWalletId();

  if (!activeId) {
    return wallets[0] || null;
  }

  return wallets.find((w) => w.id === activeId) || wallets[0] || null;
}

/**
 * Add a new wallet (async)
 */
export async function addWalletAsync(
  encryptedData: EncryptedData,
  name?: string
): Promise<VaultEntry> {
  const state = await getVaultState();
  const walletNumber = state.entries.length + 1;

  const newEntry: VaultEntry = {
    id: `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
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
 * Add a new wallet (sync - for backwards compatibility)
 * @deprecated Use addWalletAsync() instead
 */
export function addWallet(
  encryptedData: EncryptedData,
  name?: string
): VaultEntry {
  const wallets = getWallets();
  const walletNumber = wallets.length + 1;

  const newWallet: VaultEntry = {
    id: `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: name || `Wallet ${walletNumber}`,
    encryptedData,
    createdAt: Date.now(),
    version: 1,
  };

  wallets.push(newWallet);
  localStorage.setItem(LEGACY_WALLETS_KEY, JSON.stringify(wallets));

  // Set as active if it's the first wallet
  if (wallets.length === 1) {
    setActiveWalletId(newWallet.id);
  }

  // Also save to vault (async, fire-and-forget for sync API)
  saveVaultState({
    entries: wallets,
    activeId: getActiveWalletId(),
    version: 1,
  }).catch(() => {});

  secureLog("Wallet added", { id: newWallet.id, name: newWallet.name });
  return newWallet;
}

/**
 * Update a wallet's encrypted data (async)
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
 * Update a wallet's encrypted data (sync - for backwards compatibility)
 * @deprecated Use updateWalletAsync() instead
 */
export function updateWallet(
  id: string,
  encryptedData: EncryptedData
): boolean {
  const wallets = getWallets();
  const index = wallets.findIndex((w) => w.id === id);

  if (index === -1) return false;

  wallets[index].encryptedData = encryptedData;
  localStorage.setItem(LEGACY_WALLETS_KEY, JSON.stringify(wallets));
  return true;
}

/**
 * Rename a wallet (async)
 */
export async function renameWalletAsync(id: string, newName: string): Promise<boolean> {
  return walletVault.renameEntry(id, newName);
}

/**
 * Rename a wallet (sync - for backwards compatibility)
 * @deprecated Use renameWalletAsync() instead
 */
export function renameWallet(id: string, newName: string): boolean {
  const wallets = getWallets();
  const index = wallets.findIndex((w) => w.id === id);

  if (index === -1) return false;

  wallets[index].name = newName;
  localStorage.setItem(LEGACY_WALLETS_KEY, JSON.stringify(wallets));
  return true;
}

/**
 * Delete a wallet (async)
 */
export async function deleteWalletAsync(id: string): Promise<boolean> {
  return walletVault.deleteEntry(id);
}

/**
 * Delete a wallet (sync - for backwards compatibility)
 * @deprecated Use deleteWalletAsync() instead
 */
export function deleteWallet(id: string): boolean {
  const wallets = getWallets();
  const index = wallets.findIndex((w) => w.id === id);

  if (index === -1) return false;

  wallets.splice(index, 1);
  localStorage.setItem(LEGACY_WALLETS_KEY, JSON.stringify(wallets));

  const activeId = getActiveWalletId();
  if (activeId === id) {
    if (wallets.length > 0) {
      setActiveWalletId(wallets[0].id);
    } else {
      localStorage.removeItem(LEGACY_ACTIVE_KEY);
    }
  }

  secureLog("Wallet deleted", { id });
  return true;
}

/**
 * Check if there are any wallets (async)
 */
export async function hasWalletsAsync(): Promise<boolean> {
  return walletVault.hasEntries();
}

/**
 * Check if there are any wallets (sync - for backwards compatibility)
 * @deprecated Use hasWalletsAsync() instead
 */
export function hasWallets(): boolean {
  return getWallets().length > 0;
}

/**
 * Get wallet count (async)
 */
export async function getWalletCountAsync(): Promise<number> {
  const state = await getVaultState();
  return state.entries.length;
}

/**
 * Get wallet count (sync - for backwards compatibility)
 * @deprecated Use getWalletCountAsync() instead
 */
export function getWalletCount(): number {
  return getWallets().length;
}

/**
 * Import a wallet from backup (async)
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
 * Import a wallet from backup (sync - for backwards compatibility)
 * @deprecated Use importWalletAsync() instead
 */
export function importWallet(
  entry: VaultEntry,
  replaceExisting: boolean = false
): "added" | "replaced" | null {
  const wallets = getWallets();
  const existingIndex = wallets.findIndex((w) => w.id === entry.id);

  if (existingIndex !== -1) {
    if (!replaceExisting) {
      secureLog("Import failed: wallet ID already exists", { id: entry.id });
      return null;
    }
    wallets[existingIndex] = entry;
    localStorage.setItem(LEGACY_WALLETS_KEY, JSON.stringify(wallets));
    secureLog("Wallet replaced via import", { id: entry.id, name: entry.name });
    return "replaced";
  }

  wallets.push(entry);
  localStorage.setItem(LEGACY_WALLETS_KEY, JSON.stringify(wallets));

  if (wallets.length === 1) {
    setActiveWalletId(entry.id);
  }

  secureLog("Wallet imported", { id: entry.id, name: entry.name });
  return "added";
}

/**
 * Check if a wallet ID already exists (async)
 */
export async function walletExistsAsync(id: string): Promise<boolean> {
  const state = await getVaultState();
  return state.entries.some((e) => e.id === id);
}

/**
 * Check if a wallet ID already exists (sync - for backwards compatibility)
 * @deprecated Use walletExistsAsync() instead
 */
export function walletExists(id: string): boolean {
  return getWallets().some((w) => w.id === id);
}

/**
 * Delete all wallets (async)
 */
export async function deleteAllWalletsAsync(): Promise<void> {
  await walletVault.clearVault();
}

/**
 * Delete all wallets (sync - for backwards compatibility)
 * @deprecated Use deleteAllWalletsAsync() instead
 */
export function deleteAllWallets(): void {
  // Overwrite before removing (security measure)
  const wallets = getWallets();
  if (wallets.length > 0) {
    localStorage.setItem(LEGACY_WALLETS_KEY, "0".repeat(1000));
  }
  localStorage.removeItem(LEGACY_WALLETS_KEY);
  localStorage.removeItem(LEGACY_ACTIVE_KEY);

  // Also clear vault (async, fire-and-forget)
  walletVault.clearVault().catch(() => {});

  secureLog("All wallets deleted");
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
