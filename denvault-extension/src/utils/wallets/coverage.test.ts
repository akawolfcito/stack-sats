/**
 * Supplementary wallets module tests — covers uncovered branches
 *
 * Targets: initializeWallets, updateWalletAsync,
 * migrateLegacyStorage, hasLegacyData
 * These are functions not covered by the existing index.test.ts
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";

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

import {
  initializeWallets,
  addWalletAsync,
  updateWalletAsync,
  getWalletsAsync,
  migrateLegacyStorage,
  hasLegacyData,
} from "./index";
import { walletVault } from "../security/vault";

const mockEncrypted = {
  ciphertext: "dGVzdA==",
  iv: "dGVzdGl2",
  salt: "dGVzdHNhbHQ=",
};

describe("Wallets module (coverage supplement)", () => {
  beforeEach(async () => {
    localStorage.clear();
    await walletVault.clearVault();
  });

  describe("initializeWallets", () => {
    it("calls walletVault.initialize()", async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (walletVault as any)._initialized = false;
      await initializeWallets();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((walletVault as any)._initialized).toBe(true);
    });
  });

  describe("updateWalletAsync", () => {
    it("updates wallet encrypted data", async () => {
      const entry = await addWalletAsync(mockEncrypted, "Update Me");
      const newEncrypted = { ciphertext: "bmV3", iv: "bmV3aXY=", salt: "bmV3c2FsdA==" };

      const result = await updateWalletAsync(entry.id, newEncrypted);
      expect(result).toBe(true);

      const wallets = await getWalletsAsync();
      expect(wallets[0].encryptedData).toEqual(newEncrypted);
    });

    it("returns false for non-existent wallet", async () => {
      const result = await updateWalletAsync("fake-id", mockEncrypted);
      expect(result).toBe(false);
    });
  });

  describe("migrateLegacyStorage", () => {
    it("returns migrated=false when no legacy data", async () => {
      const result = await migrateLegacyStorage();
      expect(result.migrated).toBe(false);
      expect(result.count).toBe(0);
    });

    it("migrates legacy data and returns count", async () => {
      localStorage.setItem(
        "wallets",
        JSON.stringify([
          {
            id: "legacy-1",
            name: "Legacy",
            encryptedData: mockEncrypted,
            createdAt: Date.now(),
          },
        ])
      );

      const result = await migrateLegacyStorage();
      expect(result.migrated).toBe(true);
      expect(result.count).toBe(1);
    });
  });

  describe("hasLegacyData", () => {
    it("returns false when no legacy data", () => {
      expect(hasLegacyData()).toBe(false);
    });

    it("returns true when legacy wallets exist in localStorage", () => {
      localStorage.setItem(
        "wallets",
        JSON.stringify([{ id: "old", name: "Old", encryptedData: mockEncrypted, createdAt: 1 }])
      );
      expect(hasLegacyData()).toBe(true);
    });

    it("returns false for empty legacy array", () => {
      localStorage.setItem("wallets", JSON.stringify([]));
      expect(hasLegacyData()).toBe(false);
    });
  });
});
