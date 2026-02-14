/**
 * Account settings management per wallet
 * Stores account count and visibility preferences
 * Now uses async wallet ID retrieval from chrome.storage.local
 */

import { getActiveWalletIdAsync } from "../wallets";

const ACCOUNT_SETTINGS_KEY = "account_settings";

interface AccountSettings {
  count: number; // Number of accounts to generate
  hiddenIndices: number[]; // Accounts hidden by user
  names: Record<number, string>; // Custom names for accounts (index -> name)
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
 * Get default settings object
 */
function getDefaultSettings(): AccountSettings {
  return { count: DEFAULT_ACCOUNT_COUNT, hiddenIndices: [], names: {} };
}

/**
 * Get account settings for a specific wallet (async)
 */
export async function getAccountSettings(walletId?: string): Promise<AccountSettings> {
  const id = walletId || await getActiveWalletIdAsync();
  if (!id) {
    return getDefaultSettings();
  }

  const allSettings = getAllSettings();
  const settings = allSettings[id];
  if (!settings) {
    return getDefaultSettings();
  }
  // Ensure names field exists for older stored settings
  return { ...getDefaultSettings(), ...settings };
}

/**
 * Get account count for active wallet (async)
 */
export async function getAccountCount(walletId?: string): Promise<number> {
  const settings = await getAccountSettings(walletId);
  return settings.count;
}

/**
 * Set account count for active wallet (async)
 */
export async function setAccountCount(count: number, walletId?: string): Promise<void> {
  const id = walletId || await getActiveWalletIdAsync();
  if (!id) return;

  const clampedCount = Math.max(MIN_ACCOUNT_COUNT, Math.min(MAX_ACCOUNT_COUNT, count));
  const allSettings = getAllSettings();
  const currentSettings = allSettings[id] || getDefaultSettings();

  allSettings[id] = {
    ...currentSettings,
    count: clampedCount,
  };

  saveAllSettings(allSettings);
}

/**
 * Add one more account (async)
 */
export async function addAccount(walletId?: string): Promise<number> {
  const currentCount = await getAccountCount(walletId);
  const newCount = Math.min(currentCount + 1, MAX_ACCOUNT_COUNT);
  await setAccountCount(newCount, walletId);
  return newCount;
}

/**
 * Remove the last account (if more than minimum) (async)
 */
export async function removeLastAccount(walletId?: string): Promise<number> {
  const currentCount = await getAccountCount(walletId);
  const newCount = Math.max(currentCount - 1, MIN_ACCOUNT_COUNT);
  await setAccountCount(newCount, walletId);
  return newCount;
}

/**
 * Check if an account is hidden (async)
 */
export async function isAccountHidden(index: number, walletId?: string): Promise<boolean> {
  const settings = await getAccountSettings(walletId);
  return settings.hiddenIndices.includes(index);
}

/**
 * Hide an account (doesn't delete, just hides from view) (async)
 */
export async function hideAccount(index: number, walletId?: string): Promise<void> {
  const id = walletId || await getActiveWalletIdAsync();
  if (!id) return;

  const allSettings = getAllSettings();
  const currentSettings = allSettings[id] || getDefaultSettings();

  if (!currentSettings.hiddenIndices.includes(index)) {
    currentSettings.hiddenIndices.push(index);
    allSettings[id] = currentSettings;
    saveAllSettings(allSettings);
  }
}

/**
 * Show a hidden account (async)
 */
export async function showAccount(index: number, walletId?: string): Promise<void> {
  const id = walletId || await getActiveWalletIdAsync();
  if (!id) return;

  const allSettings = getAllSettings();
  const currentSettings = allSettings[id] || getDefaultSettings();

  const hiddenIndex = currentSettings.hiddenIndices.indexOf(index);
  if (hiddenIndex !== -1) {
    currentSettings.hiddenIndices.splice(hiddenIndex, 1);
    allSettings[id] = currentSettings;
    saveAllSettings(allSettings);
  }
}

/**
 * Get visible accounts count (total - hidden) (async)
 */
export async function getVisibleAccountCount(walletId?: string): Promise<number> {
  const settings = await getAccountSettings(walletId);
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

/**
 * Get custom name for an account (or default "Account X") (async)
 */
export async function getAccountName(index: number, walletId?: string): Promise<string> {
  const settings = await getAccountSettings(walletId);
  return settings.names[index] || `Account ${index + 1}`;
}

/**
 * Get all account names for the active wallet (async)
 */
export async function getAllAccountNames(walletId?: string): Promise<Record<number, string>> {
  const settings = await getAccountSettings(walletId);
  return settings.names;
}

/**
 * Set custom name for an account (async)
 */
export async function setAccountName(index: number, name: string, walletId?: string): Promise<void> {
  const id = walletId || await getActiveWalletIdAsync();
  if (!id) return;

  const allSettings = getAllSettings();
  const currentSettings = allSettings[id] || getDefaultSettings();

  const trimmedName = name.trim();
  if (trimmedName) {
    currentSettings.names[index] = trimmedName;
  } else {
    // If empty, remove custom name (reverts to default)
    delete currentSettings.names[index];
  }

  allSettings[id] = currentSettings;
  saveAllSettings(allSettings);
}

/**
 * Clear custom name for an account (revert to default) (async)
 */
export async function clearAccountName(index: number, walletId?: string): Promise<void> {
  await setAccountName(index, "", walletId);
}

export { DEFAULT_ACCOUNT_COUNT, MIN_ACCOUNT_COUNT, MAX_ACCOUNT_COUNT };
