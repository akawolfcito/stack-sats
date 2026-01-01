/**
 * Account settings management per wallet
 * Stores account count and visibility preferences
 */

import { getActiveWalletId } from "../wallets";

const ACCOUNT_SETTINGS_KEY = "account_settings";

interface AccountSettings {
  count: number; // Number of accounts to generate
  hiddenIndices: number[]; // Accounts hidden by user
}

type WalletAccountSettings = Record<string, AccountSettings>;

const DEFAULT_ACCOUNT_COUNT = 5;
const MIN_ACCOUNT_COUNT = 1;
const MAX_ACCOUNT_COUNT = 100;

/**
 * Get all account settings from storage
 */
function getAllSettings(): WalletAccountSettings {
  const stored = localStorage.getItem(ACCOUNT_SETTINGS_KEY);
  if (!stored) return {};

  try {
    return JSON.parse(stored) as WalletAccountSettings;
  } catch {
    return {};
  }
}

/**
 * Save all account settings to storage
 */
function saveAllSettings(settings: WalletAccountSettings): void {
  localStorage.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify(settings));
}

/**
 * Get account settings for a specific wallet
 */
export function getAccountSettings(walletId?: string): AccountSettings {
  const id = walletId || getActiveWalletId();
  if (!id) {
    return { count: DEFAULT_ACCOUNT_COUNT, hiddenIndices: [] };
  }

  const allSettings = getAllSettings();
  return allSettings[id] || { count: DEFAULT_ACCOUNT_COUNT, hiddenIndices: [] };
}

/**
 * Get account count for active wallet
 */
export function getAccountCount(walletId?: string): number {
  return getAccountSettings(walletId).count;
}

/**
 * Set account count for active wallet
 */
export function setAccountCount(count: number, walletId?: string): void {
  const id = walletId || getActiveWalletId();
  if (!id) return;

  const clampedCount = Math.max(MIN_ACCOUNT_COUNT, Math.min(MAX_ACCOUNT_COUNT, count));
  const allSettings = getAllSettings();
  const currentSettings = allSettings[id] || { count: DEFAULT_ACCOUNT_COUNT, hiddenIndices: [] };

  allSettings[id] = {
    ...currentSettings,
    count: clampedCount,
  };

  saveAllSettings(allSettings);
}

/**
 * Add one more account
 */
export function addAccount(walletId?: string): number {
  const currentCount = getAccountCount(walletId);
  const newCount = Math.min(currentCount + 1, MAX_ACCOUNT_COUNT);
  setAccountCount(newCount, walletId);
  return newCount;
}

/**
 * Remove the last account (if more than minimum)
 */
export function removeLastAccount(walletId?: string): number {
  const currentCount = getAccountCount(walletId);
  const newCount = Math.max(currentCount - 1, MIN_ACCOUNT_COUNT);
  setAccountCount(newCount, walletId);
  return newCount;
}

/**
 * Check if an account is hidden
 */
export function isAccountHidden(index: number, walletId?: string): boolean {
  return getAccountSettings(walletId).hiddenIndices.includes(index);
}

/**
 * Hide an account (doesn't delete, just hides from view)
 */
export function hideAccount(index: number, walletId?: string): void {
  const id = walletId || getActiveWalletId();
  if (!id) return;

  const allSettings = getAllSettings();
  const currentSettings = allSettings[id] || { count: DEFAULT_ACCOUNT_COUNT, hiddenIndices: [] };

  if (!currentSettings.hiddenIndices.includes(index)) {
    currentSettings.hiddenIndices.push(index);
    allSettings[id] = currentSettings;
    saveAllSettings(allSettings);
  }
}

/**
 * Show a hidden account
 */
export function showAccount(index: number, walletId?: string): void {
  const id = walletId || getActiveWalletId();
  if (!id) return;

  const allSettings = getAllSettings();
  const currentSettings = allSettings[id] || { count: DEFAULT_ACCOUNT_COUNT, hiddenIndices: [] };

  const hiddenIndex = currentSettings.hiddenIndices.indexOf(index);
  if (hiddenIndex !== -1) {
    currentSettings.hiddenIndices.splice(hiddenIndex, 1);
    allSettings[id] = currentSettings;
    saveAllSettings(allSettings);
  }
}

/**
 * Get visible accounts count (total - hidden)
 */
export function getVisibleAccountCount(walletId?: string): number {
  const settings = getAccountSettings(walletId);
  return settings.count - settings.hiddenIndices.filter((i) => i < settings.count).length;
}

/**
 * Delete settings for a wallet (when wallet is deleted)
 */
export function deleteAccountSettings(walletId: string): void {
  const allSettings = getAllSettings();
  delete allSettings[walletId];
  saveAllSettings(allSettings);
}

export { DEFAULT_ACCOUNT_COUNT, MIN_ACCOUNT_COUNT, MAX_ACCOUNT_COUNT };
