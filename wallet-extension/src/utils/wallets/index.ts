/**
 * Multi-wallet management module
 * Handles storing, switching, and managing multiple wallet entries
 */

import { type EncryptedData } from "../security/encryption";
import { secureLog } from "../security/logger";

// Storage keys
const WALLETS_KEY = "wallets";
const ACTIVE_WALLET_KEY = "active_wallet_id";
const LEGACY_WALLET_KEY = "wallet_encrypted";

/**
 * Wallet entry stored in localStorage
 */
export interface WalletEntry {
  id: string;
  name: string;
  encryptedData: EncryptedData;
  createdAt: number;
}

/**
 * Generate a unique wallet ID
 */
function generateWalletId(): string {
  return `wallet_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get all wallets from storage
 */
export function getWallets(): WalletEntry[] {
  const stored = localStorage.getItem(WALLETS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as WalletEntry[];
  } catch {
    return [];
  }
}

/**
 * Save wallets to storage
 */
function saveWallets(wallets: WalletEntry[]): void {
  localStorage.setItem(WALLETS_KEY, JSON.stringify(wallets));
}

/**
 * Get active wallet ID
 */
export function getActiveWalletId(): string | null {
  return localStorage.getItem(ACTIVE_WALLET_KEY);
}

/**
 * Set active wallet ID
 */
export function setActiveWalletId(id: string): void {
  localStorage.setItem(ACTIVE_WALLET_KEY, id);
}

/**
 * Get the active wallet entry
 */
export function getActiveWallet(): WalletEntry | null {
  const wallets = getWallets();
  const activeId = getActiveWalletId();

  if (!activeId) {
    // Return first wallet if no active set
    return wallets[0] || null;
  }

  return wallets.find((w) => w.id === activeId) || wallets[0] || null;
}

/**
 * Add a new wallet
 */
export function addWallet(
  encryptedData: EncryptedData,
  name?: string
): WalletEntry {
  const wallets = getWallets();
  const walletNumber = wallets.length + 1;

  const newWallet: WalletEntry = {
    id: generateWalletId(),
    name: name || `Wallet ${walletNumber}`,
    encryptedData,
    createdAt: Date.now(),
  };

  wallets.push(newWallet);
  saveWallets(wallets);

  // Set as active if it's the first wallet
  if (wallets.length === 1) {
    setActiveWalletId(newWallet.id);
  }

  secureLog("Wallet added", { id: newWallet.id, name: newWallet.name });
  return newWallet;
}

/**
 * Update a wallet's encrypted data (e.g., when changing PIN)
 */
export function updateWallet(
  id: string,
  encryptedData: EncryptedData
): boolean {
  const wallets = getWallets();
  const index = wallets.findIndex((w) => w.id === id);

  if (index === -1) return false;

  wallets[index].encryptedData = encryptedData;
  saveWallets(wallets);
  return true;
}

/**
 * Rename a wallet
 */
export function renameWallet(id: string, newName: string): boolean {
  const wallets = getWallets();
  const index = wallets.findIndex((w) => w.id === id);

  if (index === -1) return false;

  wallets[index].name = newName;
  saveWallets(wallets);
  return true;
}

/**
 * Delete a wallet
 */
export function deleteWallet(id: string): boolean {
  const wallets = getWallets();
  const index = wallets.findIndex((w) => w.id === id);

  if (index === -1) return false;

  // Remove the wallet
  wallets.splice(index, 1);
  saveWallets(wallets);

  // If we deleted the active wallet, switch to another
  const activeId = getActiveWalletId();
  if (activeId === id) {
    if (wallets.length > 0) {
      setActiveWalletId(wallets[0].id);
    } else {
      localStorage.removeItem(ACTIVE_WALLET_KEY);
    }
  }

  secureLog("Wallet deleted", { id });
  return true;
}

/**
 * Check if there are any wallets
 */
export function hasWallets(): boolean {
  return getWallets().length > 0;
}

/**
 * Get wallet count
 */
export function getWalletCount(): number {
  return getWallets().length;
}

/**
 * Migrate from legacy single wallet format to multi-wallet format
 * This handles the transition from wallet_encrypted to the new wallets array
 */
export function migrateLegacyWallet(): boolean {
  // Check if already migrated
  if (getWallets().length > 0) {
    return false;
  }

  // Check for legacy wallet
  const legacyData = localStorage.getItem(LEGACY_WALLET_KEY);
  if (!legacyData) {
    return false;
  }

  try {
    const encryptedData = JSON.parse(legacyData) as EncryptedData;

    // Create wallet entry from legacy data
    const migratedWallet: WalletEntry = {
      id: generateWalletId(),
      name: "Wallet 1",
      encryptedData,
      createdAt: Date.now(),
    };

    saveWallets([migratedWallet]);
    setActiveWalletId(migratedWallet.id);

    // Remove legacy key after successful migration
    localStorage.removeItem(LEGACY_WALLET_KEY);

    secureLog("Legacy wallet migrated", { id: migratedWallet.id });
    return true;
  } catch {
    secureLog("Legacy wallet migration failed");
    return false;
  }
}

/**
 * Import a wallet from backup
 * Returns: "added" if new, "replaced" if existing ID was replaced, null if failed
 */
export function importWallet(
  entry: WalletEntry,
  replaceExisting: boolean = false
): "added" | "replaced" | null {
  const wallets = getWallets();
  const existingIndex = wallets.findIndex((w) => w.id === entry.id);

  if (existingIndex !== -1) {
    if (!replaceExisting) {
      secureLog("Import failed: wallet ID already exists", { id: entry.id });
      return null;
    }
    // Replace existing wallet
    wallets[existingIndex] = entry;
    saveWallets(wallets);
    secureLog("Wallet replaced via import", { id: entry.id, name: entry.name });
    return "replaced";
  }

  // Add as new wallet
  wallets.push(entry);
  saveWallets(wallets);

  // Set as active if it's the first wallet
  if (wallets.length === 1) {
    setActiveWalletId(entry.id);
  }

  secureLog("Wallet imported", { id: entry.id, name: entry.name });
  return "added";
}

/**
 * Check if a wallet ID already exists
 */
export function walletExists(id: string): boolean {
  return getWallets().some((w) => w.id === id);
}

/**
 * Delete all wallets (used when user wants to start fresh)
 */
export function deleteAllWallets(): void {
  // Overwrite before removing
  const wallets = getWallets();
  if (wallets.length > 0) {
    localStorage.setItem(WALLETS_KEY, "0".repeat(1000));
  }
  localStorage.removeItem(WALLETS_KEY);
  localStorage.removeItem(ACTIVE_WALLET_KEY);
  localStorage.removeItem(LEGACY_WALLET_KEY);

  // Also remove legacy unencrypted mnemonic if exists
  const legacyMnemonic = localStorage.getItem("mnemonic");
  if (legacyMnemonic) {
    localStorage.setItem("mnemonic", "0".repeat(legacyMnemonic.length));
    localStorage.removeItem("mnemonic");
  }

  secureLog("All wallets deleted");
}
