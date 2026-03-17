/**
 * Supplementary vault tests — covers uncovered branches
 *
 * Targets: lines 193, 408, 418-434 and additional branch coverage
 * for getActiveEntry fallback, deleteEntry active-entry lock,
 * clearLegacyData overwrite, hasLegacyData, exportEntry,
 * importEntry activeId setting, migrateLegacyLocalStorage paths,
 * and getVaultStateFromLocalStorage invalid JSON.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import type { VaultEntry, VaultState } from "./vault";

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
  if (originalChromeStorage) {
    // @ts-expect-error - restoring mock
    globalThis.chrome.storage = originalChromeStorage;
  }
});

import { walletVault, getVaultState, saveVaultState } from "./vault";

const TEST_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const TEST_PIN = "123456";

describe("WalletVault (coverage supplement)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await walletVault.clearVault();
  });

  describe("getActiveEntry fallback behavior", () => {
    it("returns first entry when activeId is null", async () => {
      // Manually create state with null activeId
      const state: VaultState = {
        entries: [
          {
            id: "entry-1",
            name: "First",
            encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
            createdAt: Date.now(),
            version: 1,
          },
        ],
        activeId: null,
        version: 1,
      };
      await saveVaultState(state);

      const entry = await walletVault.getActiveEntry();
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe("entry-1");
    });

    it("returns first entry when activeId does not match any entry", async () => {
      const state: VaultState = {
        entries: [
          {
            id: "entry-1",
            name: "First",
            encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
            createdAt: Date.now(),
            version: 1,
          },
        ],
        activeId: "non-existent-id",
        version: 1,
      };
      await saveVaultState(state);

      const entry = await walletVault.getActiveEntry();
      expect(entry).not.toBeNull();
      expect(entry!.id).toBe("entry-1");
    });

    it("returns null when vault is empty and activeId is null", async () => {
      const entry = await walletVault.getActiveEntry();
      expect(entry).toBeNull();
    });
  });

  describe("deleteEntry — locks when deleting active entry", () => {
    it("locks vault when deleting the entry that was used to unlock", async () => {
      const entry = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Active");

      // Unlock sets _activeEntryId
      await walletVault.unlock(TEST_PIN);
      expect(walletVault.isLocked()).toBe(false);

      // Delete the active entry
      const deleted = await walletVault.deleteEntry(entry.id);
      expect(deleted).toBe(true);
      expect(walletVault.isLocked()).toBe(true);
    });

    it("updates activeId to next entry when deleting active entry", async () => {
      const entry1 = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "First");
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Second");

      // Set first as active
      await walletVault.setActiveId(entry1.id);

      // Delete first entry
      await walletVault.deleteEntry(entry1.id);

      const activeId = await walletVault.getActiveId();
      // Should fall back to second entry
      expect(activeId).not.toBe(entry1.id);
    });

    it("sets activeId to null when last entry is deleted", async () => {
      const entry = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Only");

      await walletVault.deleteEntry(entry.id);

      const activeId = await walletVault.getActiveId();
      expect(activeId).toBeNull();
    });
  });

  describe("hasLegacyData", () => {
    it("returns false when no legacy data exists", () => {
      expect(walletVault.hasLegacyData()).toBe(false);
    });

    it("returns true when valid legacy wallets exist", () => {
      const legacyData = [
        {
          id: "legacy-1",
          name: "Legacy Wallet",
          encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem("wallets", JSON.stringify(legacyData));

      expect(walletVault.hasLegacyData()).toBe(true);
    });

    it("returns false when legacy data is empty array", () => {
      localStorage.setItem("wallets", JSON.stringify([]));
      expect(walletVault.hasLegacyData()).toBe(false);
    });

    it("returns false when legacy data is invalid JSON", () => {
      localStorage.setItem("wallets", "not-json{{{");
      expect(walletVault.hasLegacyData()).toBe(false);
    });

    it("returns false when legacy data is not an array", () => {
      localStorage.setItem("wallets", JSON.stringify({ not: "array" }));
      expect(walletVault.hasLegacyData()).toBe(false);
    });
  });

  describe("exportEntry", () => {
    it("returns the vault entry for a valid ID", async () => {
      const entry = await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Export Me");

      const exported = await walletVault.exportEntry(entry.id);
      expect(exported).not.toBeNull();
      expect(exported!.id).toBe(entry.id);
      expect(exported!.encryptedData).toBeDefined();
    });

    it("returns null for a non-existent ID", async () => {
      const exported = await walletVault.exportEntry("non-existent");
      expect(exported).toBeNull();
    });
  });

  describe("importEntry — activeId logic", () => {
    it("sets activeId on first import into empty vault", async () => {
      const mockEntry: VaultEntry = {
        id: "import-1",
        name: "Imported",
        encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
        createdAt: Date.now(),
        version: 1,
      };

      await walletVault.importEntry(mockEntry);

      const activeId = await walletVault.getActiveId();
      expect(activeId).toBe("import-1");
    });

    it("does not change activeId when importing into non-empty vault", async () => {
      await walletVault.saveMnemonic(TEST_MNEMONIC, TEST_PIN, "Existing");
      const firstActiveId = await walletVault.getActiveId();

      const mockEntry: VaultEntry = {
        id: "import-2",
        name: "Second Import",
        encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
        createdAt: Date.now(),
        version: 1,
      };

      await walletVault.importEntry(mockEntry);

      const activeId = await walletVault.getActiveId();
      expect(activeId).toBe(firstActiveId);
    });

    it("sets activeId when current activeId is null", async () => {
      // Manually create state with entries but null activeId
      const state: VaultState = {
        entries: [
          {
            id: "existing",
            name: "Existing",
            encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
            createdAt: Date.now(),
            version: 1,
          },
        ],
        activeId: null,
        version: 1,
      };
      await saveVaultState(state);

      const mockEntry: VaultEntry = {
        id: "import-3",
        name: "New Import",
        encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
        createdAt: Date.now(),
        version: 1,
      };

      await walletVault.importEntry(mockEntry);

      const activeId = await walletVault.getActiveId();
      expect(activeId).toBe("import-3");
    });
  });

  describe("migrateLegacyLocalStorage", () => {
    it("returns migrated=false when no legacy data exists", async () => {
      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(false);
      expect(result.entriesCount).toBe(0);
    });

    it("migrates legacy wallets to vault", async () => {
      const legacyData = [
        {
          id: "legacy-1",
          name: "Legacy Wallet",
          encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem("wallets", JSON.stringify(legacyData));

      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(true);
      expect(result.entriesCount).toBe(1);

      // Legacy data should be cleared
      expect(localStorage.getItem("wallets")).toBeNull();
    });

    it("handles empty legacy array", async () => {
      localStorage.setItem("wallets", JSON.stringify([]));

      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(false);
      expect(result.entriesCount).toBe(0);
    });

    it("skips already-migrated entries", async () => {
      const legacyData = [
        {
          id: "already-exists",
          name: "Legacy",
          encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem("wallets", JSON.stringify(legacyData));

      // Pre-populate vault with the same ID
      const state: VaultState = {
        entries: [
          {
            id: "already-exists",
            name: "Existing",
            encryptedData: { ciphertext: "x", iv: "y", salt: "z" },
            createdAt: Date.now(),
            version: 1,
          },
        ],
        activeId: "already-exists",
        version: 1,
      };
      await saveVaultState(state);

      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(true);
      expect(result.entriesCount).toBe(0); // No new entries
    });

    it("migrates active wallet ID from legacy storage", async () => {
      const legacyData = [
        {
          id: "legacy-active",
          name: "Active Legacy",
          encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem("wallets", JSON.stringify(legacyData));
      localStorage.setItem("active_wallet_id", "legacy-active");

      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(true);

      const activeId = await walletVault.getActiveId();
      expect(activeId).toBe("legacy-active");
    });

    it("sets first migrated entry as active when no legacy activeId matches", async () => {
      const legacyData = [
        {
          id: "new-legacy",
          name: "New Legacy",
          encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
          createdAt: Date.now(),
        },
      ];
      localStorage.setItem("wallets", JSON.stringify(legacyData));
      localStorage.setItem("active_wallet_id", "non-matching-id");

      // Ensure vault has no existing activeId
      const emptyState: VaultState = { entries: [], activeId: null, version: 1 };
      await saveVaultState(emptyState);

      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(true);

      const activeId = await walletVault.getActiveId();
      expect(activeId).toBe("new-legacy");
    });

    it("returns error on invalid JSON in legacy data", async () => {
      localStorage.setItem("wallets", "invalid-json{{{");

      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("handles non-array legacy data gracefully", async () => {
      localStorage.setItem("wallets", JSON.stringify({ not: "array" }));

      const result = await walletVault.migrateLegacyLocalStorage();
      expect(result.migrated).toBe(false);
      expect(result.entriesCount).toBe(0);
    });
  });

  describe("getVaultState — localStorage fallback", () => {
    it("returns empty state when localStorage has no vault data", async () => {
      const state = await getVaultState();
      expect(state.entries).toEqual([]);
      expect(state.activeId).toBeNull();
    });

    it("returns parsed state from localStorage", async () => {
      const mockState: VaultState = {
        entries: [
          {
            id: "test",
            name: "Test",
            encryptedData: { ciphertext: "a", iv: "b", salt: "c" },
            createdAt: 123,
            version: 1,
          },
        ],
        activeId: "test",
        version: 1,
      };
      localStorage.setItem("wallet_vault", JSON.stringify(mockState));

      const state = await getVaultState();
      expect(state.entries).toHaveLength(1);
      expect(state.activeId).toBe("test");
    });

    it("returns empty state for invalid JSON in localStorage", async () => {
      localStorage.setItem("wallet_vault", "not-valid-json{{{");

      const state = await getVaultState();
      expect(state.entries).toEqual([]);
      expect(state.activeId).toBeNull();
    });
  });

  describe("initialize — idempotency", () => {
    it("initialize is idempotent (second call returns immediately)", async () => {
      // Reset initialized state
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (walletVault as any)._initialized = false;

      await walletVault.initialize();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((walletVault as any)._initialized).toBe(true);

      // Second call should be a no-op
      await walletVault.initialize();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((walletVault as any)._initialized).toBe(true);
    });
  });

  describe("clearVault — clears legacy data", () => {
    it("clears legacy localStorage data during clearVault", async () => {
      // Set up legacy data
      localStorage.setItem("wallets", JSON.stringify([{ id: "old" }]));
      localStorage.setItem("active_wallet_id", "old");

      await walletVault.clearVault();

      expect(localStorage.getItem("wallets")).toBeNull();
      expect(localStorage.getItem("active_wallet_id")).toBeNull();
    });
  });

  describe("unlock with no active entry", () => {
    it("returns null when vault has no entries", async () => {
      const result = await walletVault.unlock(TEST_PIN);
      expect(result).toBeNull();
    });
  });
});
