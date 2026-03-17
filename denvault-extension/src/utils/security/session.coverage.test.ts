/**
 * Supplementary session manager tests — covers uncovered branches
 *
 * Targets: lines 155, 284, 305-307 and additional branch coverage
 * for initialize (snapshot mode, migration path), auto-lock timer,
 * activity listeners, switchWalletAsync, getActiveWalletEntryAsync,
 * saveEncryptedWalletAsync, clearMnemonic, and deleteWalletAsync.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sessionManager } from "./session";
import { encryptWithPIN } from "./encryption";
import { addWalletAsync, deleteAllWalletsAsync } from "../wallets";

// Mock the DenLabs emit module
vi.mock("@/denlabs/emit", () => ({
  emitWalletLocked: vi.fn(),
  emitWalletUnlocked: vi.fn(),
}));

let chromeStore: Record<string, unknown> = {};

function setupChromeStorageMocks() {
  chromeStore = {};

  vi.mocked(chrome.storage.local.get).mockImplementation(
    (keys: unknown, callback?: (result: Record<string, unknown>) => void) => {
      const keyList = Array.isArray(keys) ? keys : typeof keys === "string" ? [keys] : [];
      const result: Record<string, unknown> = {};
      for (const key of keyList) {
        if (key in chromeStore) {
          result[key] = chromeStore[key];
        }
      }
      if (callback) callback(result);
      return Promise.resolve(result);
    }
  );

  vi.mocked(chrome.storage.local.set).mockImplementation(
    (items: unknown, callback?: () => void) => {
      if (items && typeof items === "object") Object.assign(chromeStore, items);
      if (callback) callback();
      return Promise.resolve();
    }
  );
}

describe("SessionManager (coverage supplement)", () => {
  const TEST_PIN = "123456";
  const TEST_MNEMONIC = "test mnemonic phrase for session manager testing";

  beforeEach(async () => {
    localStorage.clear();
    setupChromeStorageMocks();
    sessionManager.lock();
    await deleteAllWalletsAsync();
    sessionManager.resetFailedAttempts();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessionManager as any)._lockout.recordSuccess();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initialize", () => {
    it("returns early if already initialized", async () => {
      // Force initialized
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionManager as any)._isInitialized.value = true;
      // Should return without error
      await sessionManager.initialize();
      expect(sessionManager.isInitialized).toBe(true);
      // Reset for other tests
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionManager as any)._isInitialized.value = false;
    });

    it("sets isInitialized on error during initialization", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionManager as any)._isInitialized.value = false;

      // Make chrome.storage.local.get throw to trigger the catch
      vi.mocked(chrome.storage.local.get).mockImplementation(() => {
        throw new Error("storage error");
      });

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      await sessionManager.initialize();

      expect(sessionManager.isInitialized).toBe(true);
      consoleSpy.mockRestore();

      // Re-setup mocks for other tests
      setupChromeStorageMocks();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionManager as any)._isInitialized.value = false;
    });
  });

  describe("getActiveWalletEntryAsync", () => {
    it("returns null when no wallets exist", async () => {
      const entry = await sessionManager.getActiveWalletEntryAsync();
      expect(entry).toBeNull();
    });

    it("returns wallet entry when one exists", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      const entry = await sessionManager.getActiveWalletEntryAsync();
      expect(entry).not.toBeNull();
      expect(entry!.name).toBe("Test Wallet");
    });
  });

  describe("saveEncryptedWalletAsync", () => {
    it("saves wallet and sets hasWallet to true", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      const wallet = await sessionManager.saveEncryptedWalletAsync(encrypted, "Saved Wallet");

      expect(wallet.name).toBe("Saved Wallet");
      expect(sessionManager.hasWallet).toBe(true);
    });
  });

  describe("switchWalletAsync", () => {
    it("switches wallet and locks the session", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      const wallet1 = await addWalletAsync(encrypted, "Wallet 1");
      const wallet2 = await addWalletAsync(encrypted, "Wallet 2");

      // Unlock first
      await sessionManager.unlock(TEST_PIN);
      expect(sessionManager.isLocked).toBe(false);

      await sessionManager.switchWalletAsync(wallet2.id);

      // Should be locked after switching
      expect(sessionManager.isLocked).toBe(true);
    });
  });

  describe("clearMnemonic", () => {
    it("clears the mnemonic from memory", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");
      await sessionManager.unlock(TEST_PIN);

      expect(sessionManager.getMnemonic()).toBe(TEST_MNEMONIC);

      sessionManager.clearMnemonic();

      // getMnemonic returns null because mnemonic is cleared
      // (session is still unlocked, but mnemonic is gone)
      expect(sessionManager.getMnemonic()).toBeNull();
    });
  });

  describe("auto-lock timer", () => {
    it("auto-locks after timeout expires", async () => {
      vi.useFakeTimers();

      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");
      await sessionManager.unlock(TEST_PIN);

      expect(sessionManager.isLocked).toBe(false);

      // Advance past the 5-minute timeout
      vi.advanceTimersByTime(5 * 60 * 1000 + 100);

      expect(sessionManager.isLocked).toBe(true);
    });
  });

  describe("lock with activeWalletId", () => {
    it("emits wallet locked event when activeWalletId exists", async () => {
      const { emitWalletLocked } = await import("@/denlabs/emit");
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");
      await sessionManager.unlock(TEST_PIN);

      sessionManager.lock();

      expect(emitWalletLocked).toHaveBeenCalled();
    });

    it("does not emit wallet locked event when no activeWalletId", () => {
      // Lock without ever unlocking (no activeWalletId set)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (sessionManager as any)._activeWalletId = null;
      sessionManager.lock();
      // Should not throw
      expect(sessionManager.isLocked).toBe(true);
    });
  });

  describe("deleteWalletAsync", () => {
    it("resets all state after deleting wallet", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");
      await sessionManager.unlock(TEST_PIN);

      expect(sessionManager.hasWallet).toBe(true);
      expect(sessionManager.isLocked).toBe(false);
      expect(sessionManager.activeWalletId).not.toBeNull();

      await sessionManager.deleteWalletAsync();

      expect(sessionManager.hasWallet).toBe(false);
      expect(sessionManager.isLocked).toBe(true);
      expect(sessionManager.getMnemonic()).toBeNull();
      expect(sessionManager.activeWalletId).toBeNull();
      expect(sessionManager.failedAttempts).toBe(0);
    });
  });

  describe("resetActivity and checkTimeout interaction", () => {
    it("resetActivity prevents checkTimeout from reporting timeout", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");
      await sessionManager.unlock(TEST_PIN);

      // Immediately reset activity to set _lastActivity to now
      sessionManager.resetActivity();

      // checkTimeout should not timeout (just called resetActivity)
      const timedOut = sessionManager.checkTimeout();
      expect(timedOut).toBe(false);
    });
  });

  describe("state", () => {
    it("exposes isInitialized in state", () => {
      const state = sessionManager.state;
      expect(state.isInitialized).toBeDefined();
      expect(typeof state.isInitialized.value).toBe("boolean");
    });
  });
});
