/**
 * WalletVault Module
 * Secure storage for wallet data using chrome.storage.local
 * Provides encrypted at-rest storage with versioning and migration support
 */

import { type EncryptedData, decryptWithPIN, encryptWithPIN } from "./encryption";
import { secureLog } from "./logger";

// Storage keys
const VAULT_KEY = "wallet_vault";
const VAULT_VERSION_KEY = "vault_version";
const LEGACY_WALLETS_KEY = "wallets";
const LEGACY_ACTIVE_KEY = "active_wallet_id";

// Current vault version for future migrations
const CURRENT_VAULT_VERSION = 1;

/**
 * Vault entry stored in chrome.storage.local
 */
export interface VaultEntry {
  id: string;
  name: string;
  encryptedData: EncryptedData;
  createdAt: number;
  version: number;
}

/**
 * Vault state stored in chrome.storage.local
 */
export interface VaultState {
  entries: VaultEntry[];
  activeId: string | null;
  version: number;
}

/**
 * Migration result
 */
export interface MigrationResult {
  migrated: boolean;
  entriesCount: number;
  error?: string;
}

/**
 * Check if chrome.storage is available
 */
function isChromeStorageAvailable(): boolean {
  return typeof chrome !== "undefined" && chrome.storage?.local !== undefined;
}

/**
 * Get vault state from chrome.storage.local
 */
export async function getVaultState(): Promise<VaultState> {
  if (!isChromeStorageAvailable()) {
    // Fallback for non-extension context (development/testing)
    return getVaultStateFromLocalStorage();
  }

  return new Promise((resolve) => {
    chrome.storage.local.get([VAULT_KEY, VAULT_VERSION_KEY], (result) => {
      if (result[VAULT_KEY]) {
        resolve(result[VAULT_KEY] as VaultState);
      } else {
        resolve({
          entries: [],
          activeId: null,
          version: CURRENT_VAULT_VERSION,
        });
      }
    });
  });
}

/**
 * Fallback: Get vault state from localStorage (for dev/testing)
 */
function getVaultStateFromLocalStorage(): VaultState {
  const stored = localStorage.getItem(VAULT_KEY);
  if (stored) {
    try {
      return JSON.parse(stored) as VaultState;
    } catch {
      // Invalid JSON, return empty state
    }
  }
  return {
    entries: [],
    activeId: null,
    version: CURRENT_VAULT_VERSION,
  };
}

/**
 * Save vault state to chrome.storage.local
 */
export async function saveVaultState(state: VaultState): Promise<void> {
  if (!isChromeStorageAvailable()) {
    // Fallback for non-extension context
    localStorage.setItem(VAULT_KEY, JSON.stringify(state));
    return;
  }

  return new Promise((resolve, reject) => {
    chrome.storage.local.set(
      {
        [VAULT_KEY]: state,
        [VAULT_VERSION_KEY]: CURRENT_VAULT_VERSION,
      },
      () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const lastError = (chrome.runtime as any).lastError;
        if (lastError) {
          reject(new Error(lastError.message || "Storage error"));
        } else {
          resolve();
        }
      }
    );
  });
}

/**
 * WalletVault class - Main API for secure wallet storage
 */
class WalletVault {
  private _isLocked: boolean = true;
  private _activeEntryId: string | null = null;
  private _initialized: boolean = false;

  /**
   * Initialize the vault (must be called on app start)
   */
  async initialize(): Promise<void> {
    if (this._initialized) return;

    // Check for legacy data and migrate if needed
    const migrationResult = await this.migrateLegacyLocalStorage();
    if (migrationResult.migrated) {
      secureLog("Legacy migration completed", { count: migrationResult.entriesCount });
    }

    this._initialized = true;
  }

  /**
   * Check if vault has any entries
   */
  async hasEntries(): Promise<boolean> {
    const state = await getVaultState();
    return state.entries.length > 0;
  }

  /**
   * Get all vault entries (metadata only, no decrypted data)
   */
  async getEntries(): Promise<Omit<VaultEntry, "encryptedData">[]> {
    const state = await getVaultState();
    return state.entries.map(({ id, name, createdAt, version }) => ({
      id,
      name,
      createdAt,
      version,
    }));
  }

  /**
   * Get active entry ID
   */
  async getActiveId(): Promise<string | null> {
    const state = await getVaultState();
    return state.activeId;
  }

  /**
   * Get active entry (full, including encrypted data)
   */
  async getActiveEntry(): Promise<VaultEntry | null> {
    const state = await getVaultState();
    if (!state.activeId) {
      return state.entries[0] || null;
    }
    return state.entries.find((e) => e.id === state.activeId) || state.entries[0] || null;
  }

  /**
   * Set active entry
   */
  async setActiveId(id: string): Promise<void> {
    const state = await getVaultState();
    const exists = state.entries.some((e) => e.id === id);
    if (!exists) {
      throw new Error("Entry not found");
    }
    state.activeId = id;
    await saveVaultState(state);

    // Lock when switching for security
    this.lock();
  }

  /**
   * Add a new entry with encrypted mnemonic
   */
  async saveMnemonic(mnemonic: string, pin: string, name?: string): Promise<VaultEntry> {
    const encryptedData = await encryptWithPIN(mnemonic, pin);

    const entry: VaultEntry = {
      id: crypto.randomUUID(),
      name: name || `Wallet ${Date.now()}`,
      encryptedData,
      createdAt: Date.now(),
      version: CURRENT_VAULT_VERSION,
    };

    const state = await getVaultState();
    state.entries.push(entry);

    // Set as active if first entry
    if (state.entries.length === 1) {
      state.activeId = entry.id;
    }

    await saveVaultState(state);
    secureLog("Vault entry added", { id: entry.id, name: entry.name });

    return entry;
  }

  /**
   * Unlock the vault with PIN
   * Returns mnemonic if successful, null otherwise
   */
  async unlock(pin: string): Promise<string | null> {
    const entry = await this.getActiveEntry();
    if (!entry) {
      return null;
    }

    try {
      const mnemonic = await decryptWithPIN(entry.encryptedData, pin);
      this._isLocked = false;
      this._activeEntryId = entry.id;
      return mnemonic;
    } catch {
      return null;
    }
  }

  /**
   * Lock the vault
   */
  lock(): void {
    this._isLocked = true;
  }

  /**
   * Check if vault is locked
   */
  isLocked(): boolean {
    return this._isLocked;
  }

  /**
   * Update entry name
   */
  async renameEntry(id: string, newName: string): Promise<boolean> {
    const state = await getVaultState();
    const entry = state.entries.find((e) => e.id === id);
    if (!entry) return false;

    entry.name = newName;
    await saveVaultState(state);
    return true;
  }

  /**
   * Delete an entry
   */
  async deleteEntry(id: string): Promise<boolean> {
    const state = await getVaultState();
    const index = state.entries.findIndex((e) => e.id === id);
    if (index === -1) return false;

    state.entries.splice(index, 1);

    // Update active if deleted
    if (state.activeId === id) {
      state.activeId = state.entries[0]?.id || null;
    }

    await saveVaultState(state);
    secureLog("Vault entry deleted", { id });

    // Lock if we deleted the active entry
    if (this._activeEntryId === id) {
      this.lock();
    }

    return true;
  }

  /**
   * Clear entire vault
   */
  async clearVault(): Promise<void> {
    const emptyState: VaultState = {
      entries: [],
      activeId: null,
      version: CURRENT_VAULT_VERSION,
    };

    await saveVaultState(emptyState);
    this.lock();

    // Also clear legacy localStorage data
    this.clearLegacyData();

    secureLog("Vault cleared");
  }

  /**
   * Migrate legacy localStorage data to chrome.storage.local
   */
  async migrateLegacyLocalStorage(): Promise<MigrationResult> {
    // Check for legacy data in localStorage
    const legacyWallets = localStorage.getItem(LEGACY_WALLETS_KEY);
    if (!legacyWallets) {
      return { migrated: false, entriesCount: 0 };
    }

    try {
      const wallets = JSON.parse(legacyWallets) as Array<{
        id: string;
        name: string;
        encryptedData: EncryptedData;
        createdAt: number;
      }>;

      if (!Array.isArray(wallets) || wallets.length === 0) {
        return { migrated: false, entriesCount: 0 };
      }

      // Get current vault state
      const currentState = await getVaultState();

      // Check if already migrated (by checking if IDs exist)
      const existingIds = new Set(currentState.entries.map((e) => e.id));
      const newEntries = wallets.filter((w) => !existingIds.has(w.id));

      if (newEntries.length === 0) {
        // Already migrated, just clean up legacy
        this.clearLegacyData();
        return { migrated: true, entriesCount: 0 };
      }

      // Add entries with version
      const migratedEntries: VaultEntry[] = newEntries.map((w) => ({
        id: w.id,
        name: w.name,
        encryptedData: w.encryptedData,
        createdAt: w.createdAt,
        version: CURRENT_VAULT_VERSION,
      }));

      currentState.entries.push(...migratedEntries);

      // Migrate active wallet ID
      const legacyActiveId = localStorage.getItem(LEGACY_ACTIVE_KEY);
      if (legacyActiveId && migratedEntries.some((e) => e.id === legacyActiveId)) {
        currentState.activeId = legacyActiveId;
      } else if (!currentState.activeId && migratedEntries.length > 0) {
        currentState.activeId = migratedEntries[0].id;
      }

      // Save migrated state
      await saveVaultState(currentState);

      // Clear legacy data after successful migration
      this.clearLegacyData();

      return {
        migrated: true,
        entriesCount: migratedEntries.length,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      secureLog("Migration error", { error: errorMessage });
      return {
        migrated: false,
        entriesCount: 0,
        error: errorMessage,
      };
    }
  }

  /**
   * Clear legacy localStorage data
   */
  private clearLegacyData(): void {
    // Overwrite before removing (security measure)
    const legacyWallets = localStorage.getItem(LEGACY_WALLETS_KEY);
    if (legacyWallets) {
      localStorage.setItem(LEGACY_WALLETS_KEY, "0".repeat(legacyWallets.length));
    }
    localStorage.removeItem(LEGACY_WALLETS_KEY);
    localStorage.removeItem(LEGACY_ACTIVE_KEY);
  }

  /**
   * Check if there's legacy data that needs migration
   */
  hasLegacyData(): boolean {
    const legacyWallets = localStorage.getItem(LEGACY_WALLETS_KEY);
    if (!legacyWallets) return false;

    try {
      const wallets = JSON.parse(legacyWallets);
      return Array.isArray(wallets) && wallets.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Export vault entry for backup (encrypted)
   */
  async exportEntry(id: string): Promise<VaultEntry | null> {
    const state = await getVaultState();
    return state.entries.find((e) => e.id === id) || null;
  }

  /**
   * Import vault entry from backup
   */
  async importEntry(entry: VaultEntry, replaceExisting: boolean = false): Promise<boolean> {
    const state = await getVaultState();
    const existingIndex = state.entries.findIndex((e) => e.id === entry.id);

    if (existingIndex !== -1) {
      if (!replaceExisting) {
        return false;
      }
      state.entries[existingIndex] = entry;
    } else {
      state.entries.push(entry);
    }

    if (state.entries.length === 1 || !state.activeId) {
      state.activeId = entry.id;
    }

    await saveVaultState(state);
    return true;
  }
}

// Singleton instance
export const walletVault = new WalletVault();
