/**
 * Session management module
 * Handles wallet lock/unlock state and auto-lock timeout
 * Now uses WalletVault for secure chrome.storage.local access
 *
 * Snapshot Mode: When __UI_SNAPSHOT_MODE__ is set in localStorage,
 * the session auto-unlocks with a test mnemonic for visual regression tests.
 */

import { ref, type Ref } from "vue";
import { decryptWithPIN, isValidPIN } from "./encryption";
import {
  getActiveWallet,
  getActiveWalletAsync,
  hasWallets,
  hasWalletsAsync,
  deleteAllWallets,
  deleteAllWalletsAsync,
  addWallet,
  addWalletAsync,
  setActiveWalletId,
  setActiveWalletIdAsync,
  initializeWallets,
  migrateLegacyStorage,
  hasLegacyData,
  type WalletEntry,
} from "../wallets";
import { scheduleCleanup } from "./memory";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_UNLOCK_ATTEMPTS = 3;

// Snapshot mode storage keys (for UI visual regression tests)
const SNAPSHOT_MODE_KEY = "__UI_SNAPSHOT_MODE__";
const SNAPSHOT_MNEMONIC_KEY = "__UI_SNAPSHOT_MNEMONIC__";

export interface SessionState {
  isLocked: Ref<boolean>;
  hasWallet: Ref<boolean>;
  failedAttempts: Ref<number>;
  isInitialized: Ref<boolean>;
}

class SessionManager {
  private _isLocked = ref(true);
  private _hasWallet = ref(false);
  private _failedAttempts = ref(0);
  private _isInitialized = ref(false);
  private _lastActivity: number = Date.now();
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;
  private _decryptedMnemonic: string | null = null;
  private _activeWalletId: string | null = null;

  constructor() {
    // Don't auto-initialize - wait for explicit init call
    this.setupActivityListeners();
  }

  /**
   * Initialize the session manager (must be called on app start)
   * Handles migration from localStorage to chrome.storage.local
   *
   * In snapshot mode (UI visual regression tests), auto-unlocks with mock data.
   */
  async initialize(): Promise<void> {
    if (this._isInitialized.value) return;

    try {
      // Check for snapshot mode FIRST (UI visual regression tests)
      const snapshotMode = localStorage.getItem(SNAPSHOT_MODE_KEY);
      if (snapshotMode === "true" || snapshotMode === "1") {
        const snapshotMnemonic = localStorage.getItem(SNAPSHOT_MNEMONIC_KEY);
        if (snapshotMnemonic) {
          // Auto-unlock for snapshots - bypass normal auth flow
          this._hasWallet.value = true;
          this._isLocked.value = false;
          this._decryptedMnemonic = snapshotMnemonic;
          this._activeWalletId = "snapshot_test_wallet";
          this._isInitialized.value = true;
          console.log("[SessionManager] Snapshot mode - auto-unlocked with test wallet");
          return;
        }
      }

      // Normal initialization flow
      // Initialize wallet system (includes migration)
      await initializeWallets();

      // Check if migration was needed
      if (hasLegacyData()) {
        const result = await migrateLegacyStorage();
        if (result.migrated) {
          console.log(`[SessionManager] Migrated ${result.count} wallet(s) to secure storage`);
        }
      }

      // Check wallet exists (async)
      this._hasWallet.value = await hasWalletsAsync();
      this._isInitialized.value = true;
    } catch (error) {
      console.error("[SessionManager] Initialization error:", error);
      // Fallback to sync check
      this._hasWallet.value = hasWallets();
      this._isInitialized.value = true;
    }
  }

  get state(): SessionState {
    return {
      isLocked: this._isLocked,
      hasWallet: this._hasWallet,
      failedAttempts: this._failedAttempts,
      isInitialized: this._isInitialized,
    };
  }

  get isLocked(): boolean {
    return this._isLocked.value;
  }

  get hasWallet(): boolean {
    return this._hasWallet.value;
  }

  get failedAttempts(): number {
    return this._failedAttempts.value;
  }

  get attemptsRemaining(): number {
    return MAX_UNLOCK_ATTEMPTS - this._failedAttempts.value;
  }

  get activeWalletId(): string | null {
    return this._activeWalletId;
  }

  get isInitialized(): boolean {
    return this._isInitialized.value;
  }

  /**
   * Check if wallet exists in storage (async)
   */
  async checkWalletExistsAsync(): Promise<boolean> {
    this._hasWallet.value = await hasWalletsAsync();
    return this._hasWallet.value;
  }

  /**
   * Check if wallet exists in storage (sync - for backwards compatibility)
   * @deprecated Use checkWalletExistsAsync() instead
   */
  checkWalletExists(): boolean {
    this._hasWallet.value = hasWallets();
    return this._hasWallet.value;
  }

  /**
   * Get active wallet entry (async)
   */
  async getActiveWalletEntryAsync(): Promise<WalletEntry | null> {
    return getActiveWalletAsync();
  }

  /**
   * Get active wallet entry (sync - for backwards compatibility)
   * @deprecated Use getActiveWalletEntryAsync() instead
   */
  getActiveWalletEntry(): WalletEntry | null {
    return getActiveWallet();
  }

  /**
   * Save new encrypted wallet to storage (async)
   */
  async saveEncryptedWalletAsync(
    encryptedData: import("./encryption").EncryptedData,
    name?: string
  ): Promise<WalletEntry> {
    const wallet = await addWalletAsync(encryptedData, name);
    this._hasWallet.value = true;
    return wallet;
  }

  /**
   * Save new encrypted wallet to storage (sync - for backwards compatibility)
   * @deprecated Use saveEncryptedWalletAsync() instead
   */
  saveEncryptedWallet(
    encryptedData: import("./encryption").EncryptedData,
    name?: string
  ): WalletEntry {
    const wallet = addWallet(encryptedData, name);
    this._hasWallet.value = true;
    return wallet;
  }

  /**
   * Switch to a different wallet (async)
   */
  async switchWalletAsync(walletId: string): Promise<void> {
    await setActiveWalletIdAsync(walletId);
    // Lock when switching wallets for security
    this.lock();
  }

  /**
   * Switch to a different wallet (sync - for backwards compatibility)
   * @deprecated Use switchWalletAsync() instead
   */
  switchWallet(walletId: string): void {
    setActiveWalletId(walletId);
    // Lock when switching wallets for security
    this.lock();
  }

  /**
   * Attempt to unlock wallet with PIN (async - preferred)
   * Returns decrypted mnemonic if successful, null otherwise
   */
  async unlock(pin: string): Promise<string | null> {
    if (!isValidPIN(pin)) {
      return null;
    }

    // Try async first (chrome.storage.local)
    let activeWallet = await getActiveWalletAsync();

    // Fallback to sync if async returns null
    if (!activeWallet) {
      activeWallet = getActiveWallet();
    }

    if (!activeWallet) {
      return null;
    }

    try {
      const mnemonic = await decryptWithPIN(activeWallet.encryptedData, pin);
      this._isLocked.value = false;
      this._failedAttempts.value = 0;
      this._decryptedMnemonic = mnemonic;
      this._activeWalletId = activeWallet.id;
      this.resetActivity();
      this.startAutoLockTimer();
      return mnemonic;
    } catch {
      this._failedAttempts.value++;

      // If max attempts reached, lock out
      if (this._failedAttempts.value >= MAX_UNLOCK_ATTEMPTS) {
        // Could implement temporary lockout here
      }

      return null;
    }
  }

  /**
   * Lock the wallet
   */
  lock(): void {
    this._isLocked.value = true;
    this._decryptedMnemonic = null;
    this.clearAutoLockTimer();
    scheduleCleanup();
  }

  /**
   * Get the decrypted mnemonic (only available when unlocked)
   */
  getMnemonic(): string | null {
    if (this._isLocked.value) {
      return null;
    }
    return this._decryptedMnemonic;
  }

  /**
   * Clear mnemonic from memory
   */
  clearMnemonic(): void {
    this._decryptedMnemonic = null;
    scheduleCleanup();
  }

  /**
   * Reset activity timer
   */
  resetActivity(): void {
    this._lastActivity = Date.now();
  }

  /**
   * Check if session has timed out
   */
  checkTimeout(): boolean {
    const elapsed = Date.now() - this._lastActivity;
    if (elapsed >= TIMEOUT_MS) {
      this.lock();
      return true;
    }
    return false;
  }

  /**
   * Start auto-lock timer
   */
  private startAutoLockTimer(): void {
    this.clearAutoLockTimer();

    this._timeoutId = setTimeout(() => {
      this.lock();
    }, TIMEOUT_MS);
  }

  /**
   * Clear auto-lock timer
   */
  private clearAutoLockTimer(): void {
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }
  }

  /**
   * Setup activity listeners for auto-lock reset
   */
  private setupActivityListeners(): void {
    const events = ["click", "keydown", "mousemove", "scroll"];

    const resetHandler = () => {
      if (!this._isLocked.value) {
        this.resetActivity();
        this.startAutoLockTimer();
      }
    };

    events.forEach((event) => {
      document.addEventListener(event, resetHandler, { passive: true });
    });
  }

  /**
   * Delete all wallets completely (async)
   */
  async deleteWalletAsync(): Promise<void> {
    await deleteAllWalletsAsync();

    this._hasWallet.value = false;
    this._isLocked.value = true;
    this._decryptedMnemonic = null;
    this._activeWalletId = null;
    this._failedAttempts.value = 0;
    scheduleCleanup();
  }

  /**
   * Delete all wallets completely (sync - for backwards compatibility)
   * @deprecated Use deleteWalletAsync() instead
   */
  deleteWallet(): void {
    deleteAllWallets();

    this._hasWallet.value = false;
    this._isLocked.value = true;
    this._decryptedMnemonic = null;
    this._activeWalletId = null;
    this._failedAttempts.value = 0;
    scheduleCleanup();
  }

  /**
   * Reset failed attempts counter
   */
  resetFailedAttempts(): void {
    this._failedAttempts.value = 0;
  }
}

// Singleton instance
export const sessionManager = new SessionManager();
