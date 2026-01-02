/**
 * Session management module
 * Handles wallet lock/unlock state and auto-lock timeout
 */

import { ref, type Ref } from "vue";
import { decryptWithPIN, isValidPIN } from "./encryption";
import {
  getActiveWallet,
  hasWallets,
  deleteAllWallets,
  addWallet,
  setActiveWalletId,
  type WalletEntry,
} from "../wallets";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_UNLOCK_ATTEMPTS = 3;

export interface SessionState {
  isLocked: Ref<boolean>;
  hasWallet: Ref<boolean>;
  failedAttempts: Ref<number>;
}

class SessionManager {
  private _isLocked = ref(true);
  private _hasWallet = ref(false);
  private _failedAttempts = ref(0);
  private _lastActivity: number = Date.now();
  private _timeoutId: ReturnType<typeof setTimeout> | null = null;
  private _decryptedMnemonic: string | null = null;
  private _activeWalletId: string | null = null;

  constructor() {
    this.checkWalletExists();
    this.setupActivityListeners();
  }

  get state(): SessionState {
    return {
      isLocked: this._isLocked,
      hasWallet: this._hasWallet,
      failedAttempts: this._failedAttempts,
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

  /**
   * Check if wallet exists in storage
   */
  checkWalletExists(): boolean {
    this._hasWallet.value = hasWallets();
    return this._hasWallet.value;
  }

  /**
   * Get active wallet entry
   */
  getActiveWalletEntry(): WalletEntry | null {
    return getActiveWallet();
  }

  /**
   * Save new encrypted wallet to storage
   * Returns the new wallet entry
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
   * Switch to a different wallet
   */
  switchWallet(walletId: string): void {
    setActiveWalletId(walletId);
    // Lock when switching wallets for security
    this.lock();
  }

  /**
   * Attempt to unlock wallet with PIN
   * Returns decrypted mnemonic if successful, null otherwise
   */
  async unlock(pin: string): Promise<string | null> {
    if (!isValidPIN(pin)) {
      return null;
    }

    const activeWallet = getActiveWallet();
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
  deleteWallet(): void {
    deleteAllWallets();

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
