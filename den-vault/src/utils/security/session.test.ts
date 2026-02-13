import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { sessionManager } from "./session";
import { encryptWithPIN } from "./encryption";
import { addWalletAsync, deleteAllWalletsAsync } from "../wallets";

// Mock the DenLabs emit module to prevent chrome.storage.local side effects
vi.mock("@/denlabs/emit", () => ({
  emitWalletLocked: vi.fn(),
  emitWalletUnlocked: vi.fn(),
}));

/**
 * Configure chrome.storage.local mocks with an in-memory backing store.
 * This allows the vault to persist data across get/set calls within a test,
 * faithfully simulating the chrome.storage.local API.
 */
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
      if (callback) {
        callback(result);
      }
      return Promise.resolve(result);
    }
  );

  vi.mocked(chrome.storage.local.set).mockImplementation(
    (items: unknown, callback?: () => void) => {
      if (items && typeof items === "object") {
        Object.assign(chromeStore, items);
      }
      if (callback) {
        callback();
      }
      return Promise.resolve();
    }
  );
}

describe("SessionManager", () => {
  const TEST_PIN = "123456";
  const TEST_MNEMONIC = "test mnemonic phrase for session manager testing";

  beforeEach(async () => {
    // Reset state between tests
    localStorage.clear();
    setupChromeStorageMocks();
    sessionManager.lock();
    await deleteAllWalletsAsync();
    sessionManager.resetFailedAttempts();

    // Reset the internal LockoutManager state (private field).
    // The singleton persists across tests, so we must clear lockout state
    // to prevent cross-test contamination from accumulated failures.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sessionManager as any)._lockout.recordSuccess();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("isLocked is true initially", () => {
      expect(sessionManager.isLocked).toBe(true);
    });

    it("getMnemonic returns null when locked", () => {
      expect(sessionManager.getMnemonic()).toBeNull();
    });
  });

  describe("unlock", () => {
    it("unlock with valid PIN returns mnemonic and sets isLocked to false", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      const result = await sessionManager.unlock(TEST_PIN);

      expect(result).toBe(TEST_MNEMONIC);
      expect(sessionManager.isLocked).toBe(false);
    });

    it("unlock with wrong PIN returns null and isLocked remains true", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      const result = await sessionManager.unlock("654321");

      expect(result).toBeNull();
      expect(sessionManager.isLocked).toBe(true);
    });

    it("unlock with invalid PIN format returns null", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      const result = await sessionManager.unlock("abc");

      expect(result).toBeNull();
      expect(sessionManager.isLocked).toBe(true);
    });

    it("unlock returns null when no wallet exists", async () => {
      const result = await sessionManager.unlock(TEST_PIN);

      expect(result).toBeNull();
    });
  });

  describe("lock", () => {
    it("lock clears mnemonic after unlock", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      await sessionManager.unlock(TEST_PIN);
      expect(sessionManager.getMnemonic()).toBe(TEST_MNEMONIC);

      sessionManager.lock();

      expect(sessionManager.isLocked).toBe(true);
      expect(sessionManager.getMnemonic()).toBeNull();
    });
  });

  describe("failed attempts", () => {
    it("failedAttempts increments on wrong PIN", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      expect(sessionManager.failedAttempts).toBe(0);

      await sessionManager.unlock("654321");
      expect(sessionManager.failedAttempts).toBe(1);

      await sessionManager.unlock("654321");
      expect(sessionManager.failedAttempts).toBe(2);
    });

    it("failedAttempts resets on successful unlock", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      await sessionManager.unlock("654321");
      expect(sessionManager.failedAttempts).toBe(1);

      await sessionManager.unlock(TEST_PIN);
      expect(sessionManager.failedAttempts).toBe(0);
    });

    it("lockout after 3 consecutive failures", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      // LockoutManager triggers after 3 failures
      await sessionManager.unlock("654321");
      await sessionManager.unlock("654321");
      await sessionManager.unlock("654321");

      expect(sessionManager.isLockedOut).toBe(true);
      expect(sessionManager.lockoutRemainingMs).toBeGreaterThan(0);
    });

    it("unlock throws when locked out", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      // Trigger lockout
      await sessionManager.unlock("654321");
      await sessionManager.unlock("654321");
      await sessionManager.unlock("654321");

      await expect(sessionManager.unlock(TEST_PIN)).rejects.toThrow(
        /Account locked/
      );
    });
  });

  describe("hasWallet", () => {
    it("hasWallet reflects wallet state after checkWalletExistsAsync", async () => {
      expect(sessionManager.hasWallet).toBe(false);

      const mockEncrypted = {
        ciphertext: "test",
        iv: "test",
        salt: "test",
      };
      await addWalletAsync(mockEncrypted, "Test Wallet");
      await sessionManager.checkWalletExistsAsync();

      expect(sessionManager.hasWallet).toBe(true);
    });

    it("hasWallet becomes false after deleteWalletAsync", async () => {
      const mockEncrypted = {
        ciphertext: "test",
        iv: "test",
        salt: "test",
      };
      await addWalletAsync(mockEncrypted, "Test Wallet");
      await sessionManager.checkWalletExistsAsync();
      expect(sessionManager.hasWallet).toBe(true);

      await sessionManager.deleteWalletAsync();
      expect(sessionManager.hasWallet).toBe(false);
    });
  });

  describe("timeout", () => {
    it("checkTimeout locks after 5 minutes of inactivity", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      await sessionManager.unlock(TEST_PIN);
      expect(sessionManager.isLocked).toBe(false);

      // Record the current _lastActivity time, then advance Date.now
      vi.useFakeTimers();
      vi.advanceTimersByTime(5 * 60 * 1000);

      const timedOut = sessionManager.checkTimeout();

      expect(timedOut).toBe(true);
      expect(sessionManager.isLocked).toBe(true);
    });

    it("checkTimeout does not lock before 5 minutes", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      await sessionManager.unlock(TEST_PIN);
      expect(sessionManager.isLocked).toBe(false);

      vi.useFakeTimers();
      // Advance time by 4 minutes (below threshold)
      vi.advanceTimersByTime(4 * 60 * 1000);

      const timedOut = sessionManager.checkTimeout();

      expect(timedOut).toBe(false);
      expect(sessionManager.isLocked).toBe(false);
    });
  });

  describe("attemptsRemaining", () => {
    it("returns 3 initially", () => {
      expect(sessionManager.attemptsRemaining).toBe(3);
    });

    it("decrements with each failed attempt", async () => {
      const encrypted = await encryptWithPIN(TEST_MNEMONIC, TEST_PIN);
      await addWalletAsync(encrypted, "Test Wallet");

      await sessionManager.unlock("654321");
      expect(sessionManager.attemptsRemaining).toBe(2);

      await sessionManager.unlock("654321");
      expect(sessionManager.attemptsRemaining).toBe(1);
    });
  });

  describe("state", () => {
    it("exposes reactive state object", () => {
      const state = sessionManager.state;

      expect(state.isLocked.value).toBe(true);
      expect(state.hasWallet.value).toBe(false);
      expect(state.failedAttempts.value).toBe(0);
    });
  });
});
