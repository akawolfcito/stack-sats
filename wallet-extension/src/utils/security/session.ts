/**
 * Session management module
 * Handles wallet lock/unlock state and auto-lock timeout
 */

import { ref, type Ref } from "vue";
import {
  decryptWithPIN,
  isValidPIN,
  type EncryptedData,
} from "./encryption";

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MAX_UNLOCK_ATTEMPTS = 3;
const STORAGE_KEY = "wallet_encrypted";

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

  /**
   * Check if wallet exists in storage
   */
  checkWalletExists(): boolean {
    const stored = localStorage.getItem(STORAGE_KEY);
    this._hasWallet.value = stored !== null;
    return this._hasWallet.value;
  }

  /**
   * Get encrypted wallet data from storage
   */
  getEncryptedWallet(): EncryptedData | null {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    try {
      return JSON.parse(stored) as EncryptedData;
    } catch {
      return null;
    }
  }

  /**
   * Save encrypted wallet to storage
   */
  saveEncryptedWallet(encryptedData: EncryptedData): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedData));
    this._hasWallet.value = true;
  }

  /**
   * Attempt to unlock wallet with PIN
   * Returns decrypted mnemonic if successful, null otherwise
   */
  async unlock(pin: string): Promise<string | null> {
    if (!isValidPIN(pin)) {
      return null;
    }

    const encryptedData = this.getEncryptedWallet();
    if (!encryptedData) {
      return null;
    }

    try {
      const mnemonic = await decryptWithPIN(encryptedData, pin);
      this._isLocked.value = false;
      this._failedAttempts.value = 0;
      this._decryptedMnemonic = mnemonic;
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
   * Delete wallet completely
   */
  deleteWallet(): void {
    // Overwrite before removing (best effort security)
    localStorage.setItem(STORAGE_KEY, "0".repeat(1000));
    localStorage.removeItem(STORAGE_KEY);

    // Also remove legacy unencrypted mnemonic if exists
    const legacyMnemonic = localStorage.getItem("mnemonic");
    if (legacyMnemonic) {
      localStorage.setItem("mnemonic", "0".repeat(legacyMnemonic.length));
      localStorage.removeItem("mnemonic");
    }

    this._hasWallet.value = false;
    this._isLocked.value = true;
    this._decryptedMnemonic = null;
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
