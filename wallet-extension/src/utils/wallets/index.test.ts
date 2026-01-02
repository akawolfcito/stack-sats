import { describe, it, expect, beforeEach } from "vitest";
import {
  getWallets,
  addWallet,
  deleteWallet,
  renameWallet,
  getActiveWallet,
  setActiveWalletId,
  getActiveWalletId,
  hasWallets,
  getWalletCount,
  importWallet,
  walletExists,
  deleteAllWallets,
  type WalletEntry,
} from "./index";

// Mock encrypted data for testing
const mockEncryptedData = {
  ciphertext: "test-ciphertext",
  iv: "test-iv",
  salt: "test-salt",
};

describe("Wallet Management", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
  });

  describe("getWallets", () => {
    it("returns empty array when no wallets exist", () => {
      expect(getWallets()).toEqual([]);
    });

    it("returns wallets from localStorage", () => {
      const wallet = addWallet(mockEncryptedData, "Test Wallet");
      const wallets = getWallets();
      expect(wallets).toHaveLength(1);
      expect(wallets[0].name).toBe("Test Wallet");
    });
  });

  describe("addWallet", () => {
    it("adds a wallet with custom name", () => {
      const wallet = addWallet(mockEncryptedData, "My Wallet");
      expect(wallet.name).toBe("My Wallet");
      expect(wallet.id).toMatch(/^wallet_\d+_[a-z0-9]+$/);
      expect(wallet.encryptedData).toEqual(mockEncryptedData);
    });

    it("generates default name when not provided", () => {
      const wallet = addWallet(mockEncryptedData);
      expect(wallet.name).toBe("Wallet 1");
    });

    it("increments default name for subsequent wallets", () => {
      addWallet(mockEncryptedData);
      const wallet2 = addWallet(mockEncryptedData);
      expect(wallet2.name).toBe("Wallet 2");
    });

    it("sets first wallet as active", () => {
      const wallet = addWallet(mockEncryptedData);
      expect(getActiveWalletId()).toBe(wallet.id);
    });

    it("does not change active wallet when adding second wallet", () => {
      const wallet1 = addWallet(mockEncryptedData);
      addWallet(mockEncryptedData);
      expect(getActiveWalletId()).toBe(wallet1.id);
    });
  });

  describe("deleteWallet", () => {
    it("removes wallet from storage", () => {
      const wallet = addWallet(mockEncryptedData);
      expect(getWalletCount()).toBe(1);
      deleteWallet(wallet.id);
      expect(getWalletCount()).toBe(0);
    });

    it("returns false for non-existent wallet", () => {
      expect(deleteWallet("non-existent")).toBe(false);
    });

    it("switches active wallet when deleting active", () => {
      const wallet1 = addWallet(mockEncryptedData);
      const wallet2 = addWallet(mockEncryptedData);
      setActiveWalletId(wallet1.id);

      deleteWallet(wallet1.id);
      expect(getActiveWalletId()).toBe(wallet2.id);
    });
  });

  describe("renameWallet", () => {
    it("renames existing wallet", () => {
      const wallet = addWallet(mockEncryptedData, "Old Name");
      renameWallet(wallet.id, "New Name");

      const updated = getWallets().find((w) => w.id === wallet.id);
      expect(updated?.name).toBe("New Name");
    });

    it("returns false for non-existent wallet", () => {
      expect(renameWallet("non-existent", "New Name")).toBe(false);
    });
  });

  describe("getActiveWallet", () => {
    it("returns null when no wallets exist", () => {
      expect(getActiveWallet()).toBeNull();
    });

    it("returns first wallet when no active is set", () => {
      const wallet = addWallet(mockEncryptedData);
      localStorage.removeItem("active_wallet_id");
      expect(getActiveWallet()?.id).toBe(wallet.id);
    });

    it("returns the active wallet", () => {
      addWallet(mockEncryptedData);
      const wallet2 = addWallet(mockEncryptedData);
      setActiveWalletId(wallet2.id);

      expect(getActiveWallet()?.id).toBe(wallet2.id);
    });
  });

  describe("hasWallets", () => {
    it("returns false when no wallets", () => {
      expect(hasWallets()).toBe(false);
    });

    it("returns true when wallets exist", () => {
      addWallet(mockEncryptedData);
      expect(hasWallets()).toBe(true);
    });
  });

  describe("getWalletCount", () => {
    it("returns correct count", () => {
      expect(getWalletCount()).toBe(0);
      addWallet(mockEncryptedData);
      expect(getWalletCount()).toBe(1);
      addWallet(mockEncryptedData);
      expect(getWalletCount()).toBe(2);
    });
  });

  describe("importWallet", () => {
    it("imports new wallet", () => {
      const entry: WalletEntry = {
        id: "imported-wallet-1",
        name: "Imported",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
      };

      const result = importWallet(entry);
      expect(result).toBe("added");
      expect(walletExists("imported-wallet-1")).toBe(true);
    });

    it("returns null when wallet ID exists and replaceExisting is false", () => {
      const entry: WalletEntry = {
        id: "test-id",
        name: "Original",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
      };

      importWallet(entry);
      const result = importWallet(entry, false);
      expect(result).toBeNull();
    });

    it("replaces wallet when replaceExisting is true", () => {
      const entry1: WalletEntry = {
        id: "test-id",
        name: "Original",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
      };

      const entry2: WalletEntry = {
        id: "test-id",
        name: "Replaced",
        encryptedData: mockEncryptedData,
        createdAt: Date.now(),
      };

      importWallet(entry1);
      const result = importWallet(entry2, true);
      expect(result).toBe("replaced");

      const wallet = getWallets().find((w) => w.id === "test-id");
      expect(wallet?.name).toBe("Replaced");
    });
  });

  describe("walletExists", () => {
    it("returns false for non-existent wallet", () => {
      expect(walletExists("non-existent")).toBe(false);
    });

    it("returns true for existing wallet", () => {
      const wallet = addWallet(mockEncryptedData);
      expect(walletExists(wallet.id)).toBe(true);
    });
  });

  describe("deleteAllWallets", () => {
    it("removes all wallets", () => {
      addWallet(mockEncryptedData);
      addWallet(mockEncryptedData);
      expect(getWalletCount()).toBe(2);

      deleteAllWallets();
      expect(getWalletCount()).toBe(0);
      expect(getActiveWalletId()).toBeNull();
    });
  });
});
