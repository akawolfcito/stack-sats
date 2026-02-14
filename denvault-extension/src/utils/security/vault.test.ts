/**
 * WalletVault unit tests
 *
 * Tests the singleton walletVault covering:
 * - Save/unlock round-trip
 * - Wrong PIN rejection
 * - Lock/isLocked flow
 * - Entry CRUD (delete, clear, rename)
 * - getEntries metadata-only contract
 * - Import/export with duplicate handling
 * - setActiveId switch-and-lock behavior
 *
 * In the test environment chrome.storage.local is disabled so the vault
 * falls back to localStorage (mocked in src/test/setup.ts).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import type { VaultEntry } from "./vault";

// Disable chrome.storage.local so vault falls back to localStorage
const originalChromeStorage = globalThis.chrome?.storage;
beforeEach(() => {
  // @ts-expect-error - intentionally removing storage to trigger localStorage fallback
  globalThis.chrome = {
    ...globalThis.chrome,
    storage: undefined,
  };
});

afterEach(() => {
  // Restore chrome mock for other test files
  if (originalChromeStorage) {
    // @ts-expect-error - restoring mock
    globalThis.chrome.storage = originalChromeStorage;
  }
});

// Dynamic import so the module evaluates after chrome.storage is removed
// We can use a static import since isChromeStorageAvailable() is called at runtime, not module load
import { walletVault } from "./vault";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PIN = "123456";
const WRONG_PIN = "999999";

describe("WalletVault", () => {
  beforeEach(async () => {
    // Reset singleton state between tests
    localStorage.clear();
    await walletVault.clearVault();
  });

  describe("saveMnemonic + unlock round-trip", () => {
    it("should save mnemonic and unlock with the same PIN", async () => {
      const entry = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Test Wallet");
      expect(entry).toBeDefined();
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBe("Test Wallet");

      const mnemonic = await walletVault.unlock(TEST_PIN);
      expect(mnemonic).toBe(TEST_MNEMONIC);
    });

    it("should assign a default name when none is provided", async () => {
      const entry = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN);
      expect(entry.name).toMatch(/^Wallet \d+$/);
    });
  });

  describe("unlock with wrong PIN", () => {
    it("should return null when unlocking with the wrong PIN", async () => {
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Secure Wallet");

      const result = await walletVault.unlock(WRONG_PIN);
      expect(result).toBeNull();
    });
  });

  describe("lock / isLocked flow", () => {
    it("should be locked by default", () => {
      expect(walletVault.isLocked()).toBe(true);
    });

    it("should be unlocked after successful unlock, locked after lock()", async () => {
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Lock Test");

      await walletVault.unlock(TEST_PIN);
      expect(walletVault.isLocked()).toBe(false);

      walletVault.lock();
      expect(walletVault.isLocked()).toBe(true);
    });

    it("should remain locked after failed unlock attempt", async () => {
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Lock Test");

      await walletVault.unlock(WRONG_PIN);
      expect(walletVault.isLocked()).toBe(true);
    });
  });

  describe("deleteEntry", () => {
    it("should delete an entry and verify count is 0", async () => {
      const entry = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "To Delete");

      const deleted = await walletVault.deleteEntry(entry.id);
      expect(deleted).toBe(true);

      const hasEntries = await walletVault.hasEntries();
      expect(hasEntries).toBe(false);
    });

    it("should return false when deleting a non-existent entry", async () => {
      const deleted = await walletVault.deleteEntry("non-existent-id");
      expect(deleted).toBe(false);
    });
  });

  describe("clearVault", () => {
    it("should clear all entries from the vault", async () => {
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Wallet 1");
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Wallet 2");
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Wallet 3");

      const hasBefore = await walletVault.hasEntries();
      expect(hasBefore).toBe(true);

      await walletVault.clearVault();

      const hasAfter = await walletVault.hasEntries();
      expect(hasAfter).toBe(false);

      const entries = await walletVault.getEntries();
      expect(entries).toHaveLength(0);
    });
  });

  describe("getEntries returns metadata only", () => {
    it("should not include encryptedData in returned entries", async () => {
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Metadata Test");

      const entries = await walletVault.getEntries();
      expect(entries).toHaveLength(1);

      const entry = entries[0];
      expect(entry.id).toBeTruthy();
      expect(entry.name).toBe("Metadata Test");
      expect(entry.createdAt).toBeTypeOf("number");
      expect(entry.version).toBeTypeOf("number");

      // The key assertion: encryptedData must not be present
      expect("encryptedData" in entry).toBe(false);
    });
  });

  describe("importEntry", () => {
    it("should import a VaultEntry and verify it exists", async () => {
      const mockEntry: VaultEntry = {
        id: "import-test-id",
        name: "Imported Wallet",
        encryptedData: {
          ciphertext: "dGVzdA==",
          iv: "dGVzdGl2",
          salt: "dGVzdHNhbHQ=",
        },
        createdAt: Date.now(),
        version: 1,
      };

      const result = await walletVault.importEntry(mockEntry);
      expect(result).toBe(true);

      const entries = await walletVault.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe("import-test-id");
      expect(entries[0].name).toBe("Imported Wallet");
    });

    it("should return false when importing entry with existing ID and replaceExisting=false", async () => {
      const mockEntry: VaultEntry = {
        id: "duplicate-id",
        name: "Original",
        encryptedData: {
          ciphertext: "dGVzdA==",
          iv: "dGVzdGl2",
          salt: "dGVzdHNhbHQ=",
        },
        createdAt: Date.now(),
        version: 1,
      };

      await walletVault.importEntry(mockEntry);

      const duplicateEntry: VaultEntry = {
        ...mockEntry,
        name: "Duplicate",
      };

      const result = await walletVault.importEntry(duplicateEntry, false);
      expect(result).toBe(false);

      // Verify original entry is unchanged
      const entries = await walletVault.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe("Original");
    });

    it("should replace entry when importing with existing ID and replaceExisting=true", async () => {
      const mockEntry: VaultEntry = {
        id: "replace-id",
        name: "Original",
        encryptedData: {
          ciphertext: "dGVzdA==",
          iv: "dGVzdGl2",
          salt: "dGVzdHNhbHQ=",
        },
        createdAt: Date.now(),
        version: 1,
      };

      await walletVault.importEntry(mockEntry);

      const updatedEntry: VaultEntry = {
        ...mockEntry,
        name: "Replaced",
      };

      const result = await walletVault.importEntry(updatedEntry, true);
      expect(result).toBe(true);

      const entries = await walletVault.getEntries();
      expect(entries).toHaveLength(1);
      expect(entries[0].name).toBe("Replaced");
    });
  });

  describe("renameEntry", () => {
    it("should rename an entry and verify the new name", async () => {
      const entry = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Old Name");

      const result = await walletVault.renameEntry(entry.id, "New Name");
      expect(result).toBe(true);

      const entries = await walletVault.getEntries();
      expect(entries[0].name).toBe("New Name");
    });

    it("should return false when renaming a non-existent entry", async () => {
      const result = await walletVault.renameEntry("non-existent-id", "New Name");
      expect(result).toBe(false);
    });
  });

  describe("setActiveId switches and locks", () => {
    it("should switch active entry and lock the vault", async () => {
      const entry1 = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Wallet A");
      const entry2 = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Wallet B");

      // Unlock first
      await walletVault.unlock(TEST_PIN);
      expect(walletVault.isLocked()).toBe(false);

      // Switch active entry
      await walletVault.setActiveId(entry2.id);

      // Should be locked after switching
      expect(walletVault.isLocked()).toBe(true);

      // Active ID should be updated
      const activeId = await walletVault.getActiveId();
      expect(activeId).toBe(entry2.id);
    });

    it("should throw when setting active to a non-existent ID", async () => {
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Wallet");

      await expect(walletVault.setActiveId("non-existent-id")).rejects.toThrow("Entry not found");
    });
  });
});
