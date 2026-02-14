import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getWalletsAsync,
  addWalletAsync,
  deleteWalletAsync,
  renameWalletAsync,
  getActiveWalletAsync,
  setActiveWalletIdAsync,
  getActiveWalletIdAsync,
  hasWalletsAsync,
  getWalletCountAsync,
  importWalletAsync,
  walletExistsAsync,
  deleteAllWalletsAsync,
  type WalletEntry,
} from "./index";

// Mock encrypted data for testing
const mockEncryptedData = {
  ciphertext: "test-ciphertext",
  iv: "test-iv",
  salt: "test-salt",
};

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

describe("Wallet Management", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    setupChromeStorageMocks();
  });

  describe("getWalletsAsync", () => {
    it("returns empty array when no wallets exist", async () => {
      expect(await getWalletsAsync()).toEqual([]);
    });

    it("returns wallets from storage", async () => {
      const wallet = await addWalletAsync(mockEncryptedData, "Test Wallet");
      const wallets = await getWalletsAsync();
      expect(wallets).toHaveLength(1);
      expect(wallets[0].name).toBe("Test Wallet");
    });
  });

  describe("addWalletAsync", () => {
    it("adds a wallet with custom name", async () => {
      const wallet = await addWalletAsync(mockEncryptedData, "My Wallet");
      expect(wallet.name).toBe("My Wallet");
      expect(wallet.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(wallet.encryptedData).toEqual(mockEncryptedData);
    });

    it("generates default name when not provided", async () => {
      const wallet = await addWalletAsync(mockEncryptedData);
      expect(wallet.name).toBe("Wallet 1");
    });

    it("increments default name for subsequent wallets", async () => {
      await addWalletAsync(mockEncryptedData);
      const wallet2 = await addWalletAsync(mockEncryptedData);
      expect(wallet2.name).toBe("Wallet 2");
    });

    it("sets first wallet as active", async () => {
      const wallet = await addWalletAsync(mockEncryptedData);
      expect(await getActiveWalletIdAsync()).toBe(wallet.id);
    });

    it("does not change active wallet when adding second wallet", async () => {
      const wallet1 = await addWalletAsync(mockEncryptedData);
      await addWalletAsync(mockEncryptedData);
      expect(await getActiveWalletIdAsync()).toBe(wallet1.id);
    });
  });

  describe("deleteWalletAsync", () => {
    it("removes wallet from storage", async () => {
      const wallet = await addWalletAsync(mockEncryptedData);
      expect(await getWalletCountAsync()).toBe(1);
      await deleteWalletAsync(wallet.id);
      expect(await getWalletCountAsync()).toBe(0);
    });

    it("returns false for non-existent wallet", async () => {
      expect(await deleteWalletAsync("non-existent")).toBe(false);
    });

    it("switches active wallet when deleting active", async () => {
      const wallet1 = await addWalletAsync(mockEncryptedData);
      const wallet2 = await addWalletAsync(mockEncryptedData);
      await setActiveWalletIdAsync(wallet1.id);

      await deleteWalletAsync(wallet1.id);
      expect(await getActiveWalletIdAsync()).toBe(wallet2.id);
    });
  });

  describe("renameWalletAsync", () => {
    it("renames existing wallet", async () => {
      const wallet = await addWalletAsync(mockEncryptedData, "Old Name");
      await renameWalletAsync(wallet.id, "New Name");

      const wallets = await getWalletsAsync();
      const updated = wallets.find((w) => w.id === wallet.id);
      expect(updated?.name).toBe("New Name");
    });

    it("returns false for non-existent wallet", async () => {
      expect(await renameWalletAsync("non-existent", "New Name")).toBe(false);
    });
  });

  describe("getActiveWalletAsync", () => {
    it("returns null when no wallets exist", async () => {
      expect(await getActiveWalletAsync()).toBeNull();
    });

    it("returns first wallet when no active is set", async () => {
      const wallet = await addWalletAsync(mockEncryptedData);
      // The first wallet is always set as active, so this test verifies
      // that getActiveWalletAsync returns the correct wallet
      expect((await getActiveWalletAsync())?.id).toBe(wallet.id);
    });

    it("returns the active wallet", async () => {
      await addWalletAsync(mockEncryptedData);
      const wallet2 = await addWalletAsync(mockEncryptedData);
      await setActiveWalletIdAsync(wallet2.id);

      expect((await getActiveWalletAsync())?.id).toBe(wallet2.id);
    });
  });

  describe("hasWalletsAsync", () => {
    it("returns false when no wallets", async () => {
      expect(await hasWalletsAsync()).toBe(false);
    });

    it("returns true when wallets exist", async () => {
      await addWalletAsync(mockEncryptedData);
      expect(await hasWalletsAsync()).toBe(true);
    });
  });

  describe("getWalletCountAsync", () => {
    it("returns correct count", async () => {
      expect(await getWalletCountAsync()).toBe(0);
      await addWalletAsync(mockEncryptedData);
      expect(await getWalletCountAsync()).toBe(1);
      await addWalletAsync(mockEncryptedData);
      expect(await getWalletCountAsync()).toBe(2);
    });
  });

  describe("importWalletAsync", () => {
    it("imports new wallet", async () => {
      const entry: WalletEntry = {
        id: "imported-wallet-1",
        name: "Imported",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
        version: 1,
      };

      const result = await importWalletAsync(entry);
      expect(result).toBe("added");
      expect(await walletExistsAsync("imported-wallet-1")).toBe(true);
    });

    it("returns null when wallet ID exists and replaceExisting is false", async () => {
      const entry: WalletEntry = {
        id: "test-id",
        name: "Original",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
        version: 1,
      };

      await importWalletAsync(entry);
      const result = await importWalletAsync(entry, false);
      expect(result).toBeNull();
    });

    it("replaces wallet when replaceExisting is true", async () => {
      const entry1: WalletEntry = {
        id: "test-id",
        name: "Original",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
        version: 1,
      };

      const entry2: WalletEntry = {
        id: "test-id",
        name: "Replaced",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
        version: 1,
      };

      await importWalletAsync(entry1);
      const result = await importWalletAsync(entry2, true);
      expect(result).toBe("replaced");

      const wallets = await getWalletsAsync();
      const wallet = wallets.find((w) => w.id === "test-id");
      expect(wallet?.name).toBe("Replaced");
    });
  });

  describe("walletExistsAsync", () => {
    it("returns false for non-existent wallet", async () => {
      expect(await walletExistsAsync("non-existent")).toBe(false);
    });

    it("returns true for existing wallet", async () => {
      const wallet = await addWalletAsync(mockEncryptedData);
      expect(await walletExistsAsync(wallet.id)).toBe(true);
    });
  });

  describe("deleteAllWalletsAsync", () => {
    it("removes all wallets", async () => {
      await addWalletAsync(mockEncryptedData);
      await addWalletAsync(mockEncryptedData);
      expect(await getWalletCountAsync()).toBe(2);

      await deleteAllWalletsAsync();
      expect(await getWalletCountAsync()).toBe(0);
      expect(await getActiveWalletIdAsync()).toBeNull();
    });
  });
});
