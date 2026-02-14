/**
 * Session management module
 * Handles wallet lock/unlock state and auto-lock timeout
 * Uses WalletVault for secure chrome.storage.local access
 *
 * Snapshot Mode: When __UI_SNAPSHOT_MODE__ is set in localStorage,
 * the session auto-unlocks with a test mnemonic for visual regression tests.
 */

import { ref, type Ref } from "vue";
import { decryptWithPIN, isValidPIN } from "./encryption";
import { devLog } from "./logger";
import { LockoutManager } from "./lockout";
import {
  getActiveWalletAsync,
  hasWalletsAsync,
  deleteAllWalletsAsync,
  addWalletAsync,
  setActiveWalletIdAsync,
  initializeWallets,
  migrateLegacyStorage,
  hasLegacyData,
  type WalletEntry,
} from "../wallets";
import { emitWalletLocked, emitWalletUnlocked } from "@/denlabs/emit";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

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
  private _lockout = new LockoutManager();
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
      // Wrapped in __DEV__ guard so it's dead-code eliminated in production builds
      if (__DEV__) {
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
            devLog("Snapshot mode - auto-unlocked with test wallet");
            return;
          }
        }
      }

      // Normal initialization flow
      // Initialize wallet system (includes migration)
      await initializeWallets();

      // Check if migration was needed
      if (hasLegacyData()) {
        const result = await migrateLegacyStorage();
        if (result.migrated) {
          devLog(`Migrated ${result.count} wallet(s) to secure storage`);
        }
      }

      // Check wallet exists (async)
      this._hasWallet.value = await hasWalletsAsync();
      this._isInitialized.value = true;
    } catch (error) {
      console.error("[SessionManager] Initialization error:", error);
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
    return 3 - this._failedAttempts.value;
  }

  get isLockedOut(): boolean {
    return this._lockout.isLockedOut();
  }

  get lockoutRemainingMs(): number {
    return this._lockout.lockoutRemainingMs;
  }

  get activeWalletId(): string | null {
    return this._activeWalletId;
  }

  get isInitialized(): boolean {
    return this._isInitialized.value;
  }

  /**
   * Check if wallet exists in storage
   */
  async checkWalletExistsAsync(): Promise<boolean> {
    this._hasWallet.value = await hasWalletsAsync();
    return this._hasWallet.value;
  }

  /**
   * Get active wallet entry
   */
  async getActiveWalletEntryAsync(): Promise<WalletEntry | null> {
    return getActiveWalletAsync();
  }

  /**
   * Save new encrypted wallet to storage
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
   * Switch to a different wallet
   */
  async switchWalletAsync(walletId: string): Promise<void> {
    await setActiveWalletIdAsync(walletId);
    // Lock when switching wallets for security
    this.lock();
  }

  /**
   * Attempt to unlock wallet with PIN
   * Returns decrypted mnemonic if successful, null otherwise
   */
  async unlock(pin: string): Promise<string | null> {
    if (this._lockout.isLockedOut()) {
      throw new Error(
        `Account locked. Try again in ${Math.ceil(this._lockout.lockoutRemainingMs / 1000)} seconds.`
      );
    }

    if (!isValidPIN(pin)) {
      return null;
    }

    const activeWallet = await getActiveWalletAsync();

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
      this._lockout.recordSuccess();

      // DenLabs: Emit wallet unlocked event
      emitWalletUnlocked(activeWallet.id);

      return mnemonic;
    } catch {
      this._failedAttempts.value++;
      this._lockout.recordFailure();

      return null;
    }
  }

  /**
   * Lock the wallet
   */
  lock(): void {
    const walletId = this._activeWalletId;
    this._isLocked.value = true;
    this._decryptedMnemonic = null;
    this.clearAutoLockTimer();

    // DenLabs: Emit wallet locked event
    if (walletId) {
      emitWalletLocked(walletId);
    }
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
   * Delete all wallets completely
   */
  async deleteWalletAsync(): Promise<void> {
    await deleteAllWalletsAsync();

    this._hasWallet.value = false;
    this._isLocked.value = true;
    this._decryptedMnemonic = null;
    this._activeWalletId = null;
    this._failedAttempts.value = 0;
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
