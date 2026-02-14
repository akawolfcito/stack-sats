import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  createBackup,
  validateBackup,
  generateBackupFilename,
  parseBackupFile,
  downloadBackup,
  BACKUP_VERSION,
  BACKUP_TYPE,
  type BackupFile,
} from "./index";
import { type WalletEntry } from "../wallets";

// Mock wallet entry for testing
const mockWallet: WalletEntry = {
  id: "wallet_123_abc",
  name: "Test Wallet",
  encryptedData: {
    ciphertext: "encrypted-mnemonic-data",
    iv: "initialization-vector",
    salt: "random-salt",
  },
  createdAt: 1704067200000, // 2024-01-01
};

describe("Backup Module", () => {
  describe("createBackup", () => {
    it("creates backup with correct structure", () => {
      const backup = createBackup(mockWallet);

      expect(backup.version).toBe(BACKUP_VERSION);
      expect(backup.type).toBe(BACKUP_TYPE);
      expect(backup.exportedAt).toBeTypeOf("number");
      expect(backup.wallet.id).toBe(mockWallet.id);
      expect(backup.wallet.name).toBe(mockWallet.name);
      expect(backup.wallet.encryptedData).toEqual(mockWallet.encryptedData);
      expect(backup.wallet.createdAt).toBe(mockWallet.createdAt);
    });

    it("sets exportedAt to current timestamp", () => {
      const before = Date.now();
      const backup = createBackup(mockWallet);
      const after = Date.now();

      expect(backup.exportedAt).toBeGreaterThanOrEqual(before);
      expect(backup.exportedAt).toBeLessThanOrEqual(after);
    });

    it("creates independent copy of wallet data", () => {
      const backup = createBackup(mockWallet);

      // Modifying backup should not affect original
      backup.wallet.name = "Modified";
      expect(mockWallet.name).toBe("Test Wallet");
    });
  });

  describe("validateBackup", () => {
    const validBackup: BackupFile = {
      version: "1.0",
      type: "ironvault-backup",
      exportedAt: Date.now(),
      wallet: mockWallet,
    };

    it("returns backup for valid data", () => {
      const result = validateBackup(validBackup);
      expect(result).not.toBeNull();
      expect(result?.wallet.id).toBe(mockWallet.id);
    });

    it("returns null for null input", () => {
      expect(validateBackup(null)).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(validateBackup(undefined)).toBeNull();
    });

    it("returns null for non-object input", () => {
      expect(validateBackup("string")).toBeNull();
      expect(validateBackup(123)).toBeNull();
      expect(validateBackup([])).toBeNull();
    });

    it("returns null for wrong type field", () => {
      const invalid = { ...validBackup, type: "wrong-type" };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing version", () => {
      const invalid = { ...validBackup };
      delete (invalid as Record<string, unknown>).version;
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for non-string version", () => {
      const invalid = { ...validBackup, version: 123 };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing exportedAt", () => {
      const invalid = { ...validBackup };
      delete (invalid as Record<string, unknown>).exportedAt;
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for non-number exportedAt", () => {
      const invalid = { ...validBackup, exportedAt: "2024-01-01" };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing wallet", () => {
      const invalid = { ...validBackup };
      delete (invalid as Record<string, unknown>).wallet;
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for non-object wallet", () => {
      const invalid = { ...validBackup, wallet: "wallet" };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing wallet.id", () => {
      const invalid = {
        ...validBackup,
        wallet: { ...mockWallet, id: undefined },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for empty wallet.id", () => {
      const invalid = {
        ...validBackup,
        wallet: { ...mockWallet, id: "" },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for non-string wallet.name", () => {
      const invalid = {
        ...validBackup,
        wallet: { ...mockWallet, name: 123 },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for non-number wallet.createdAt", () => {
      const invalid = {
        ...validBackup,
        wallet: { ...mockWallet, createdAt: "2024-01-01" },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing encryptedData", () => {
      const invalidWallet = { ...mockWallet };
      delete (invalidWallet as Record<string, unknown>).encryptedData;
      const invalid = { ...validBackup, wallet: invalidWallet };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for non-object encryptedData", () => {
      const invalid = {
        ...validBackup,
        wallet: { ...mockWallet, encryptedData: "encrypted" },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing ciphertext", () => {
      const invalid = {
        ...validBackup,
        wallet: {
          ...mockWallet,
          encryptedData: { iv: "iv", salt: "salt" },
        },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing iv", () => {
      const invalid = {
        ...validBackup,
        wallet: {
          ...mockWallet,
          encryptedData: { ciphertext: "ct", salt: "salt" },
        },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for missing salt", () => {
      const invalid = {
        ...validBackup,
        wallet: {
          ...mockWallet,
          encryptedData: { ciphertext: "ct", iv: "iv" },
        },
      };
      expect(validateBackup(invalid)).toBeNull();
    });

    it("returns null for non-string ciphertext", () => {
      const invalid = {
        ...validBackup,
        wallet: {
          ...mockWallet,
          encryptedData: { ciphertext: 123, iv: "iv", salt: "salt" },
        },
      };
      expect(validateBackup(invalid)).toBeNull();
    });
  });

  describe("generateBackupFilename", () => {
    it("generates filename with sanitized wallet name", () => {
      const filename = generateBackupFilename("My Wallet");
      expect(filename).toMatch(/^ironvault-backup-my-wallet-\d{4}-\d{2}-\d{2}\.json$/);
    });

    it("converts uppercase to lowercase", () => {
      const filename = generateBackupFilename("TEST WALLET");
      expect(filename).toContain("test-wallet");
    });

    it("replaces special characters with hyphens", () => {
      const filename = generateBackupFilename("My@Wallet#123!");
      expect(filename).toContain("my-wallet-123");
    });

    it("collapses multiple hyphens to single", () => {
      const filename = generateBackupFilename("My---Wallet");
      expect(filename).not.toContain("---");
    });

    it("truncates long names to 20 characters", () => {
      const longName = "This Is A Very Long Wallet Name That Should Be Truncated";
      const filename = generateBackupFilename(longName);
      // The sanitized name part should be at most 20 chars
      const namePart = filename.replace("ironvault-backup-", "").split("-20")[0];
      expect(namePart.length).toBeLessThanOrEqual(20);
    });

    it("includes current date in ISO format", () => {
      const today = new Date().toISOString().split("T")[0];
      const filename = generateBackupFilename("Test");
      expect(filename).toContain(today);
    });

    it("ends with .json extension", () => {
      const filename = generateBackupFilename("Wallet");
      expect(filename).toMatch(/\.json$/);
    });
  });

  describe("downloadBackup", () => {
    let appendChildSpy: ReturnType<typeof vi.spyOn>;
    let removeChildSpy: ReturnType<typeof vi.spyOn>;
    let createObjectURLSpy: ReturnType<typeof vi.spyOn>;
    let revokeObjectURLSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => null as any);
      removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => null as any);
      createObjectURLSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test-url");
      revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    });

    it("creates and clicks download link", () => {
      const backup = createBackup(mockWallet);
      const clickSpy = vi.fn();

      vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        download: "",
        click: clickSpy,
      } as unknown as HTMLAnchorElement);

      downloadBackup(backup, "test-backup.json");

      expect(clickSpy).toHaveBeenCalled();
    });

    it("creates blob with correct content type", () => {
      const backup = createBackup(mockWallet);
      const blobSpy = vi.spyOn(globalThis, "Blob");

      downloadBackup(backup, "test-backup.json");

      expect(blobSpy).toHaveBeenCalledWith(
        [expect.any(String)],
        { type: "application/json" }
      );
    });

    it("revokes object URL after download", () => {
      const backup = createBackup(mockWallet);

      downloadBackup(backup, "test-backup.json");

      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:test-url");
    });
  });

  describe("parseBackupFile", () => {
    // Helper to create a mock File with working text() method
    function createMockFile(content: string, name: string): File {
      const file = new File([content], name, { type: "application/json" });
      // Ensure text() method works in jsdom
      if (!file.text || typeof file.text !== "function") {
        (file as unknown as Record<string, unknown>).text = () =>
          Promise.resolve(content);
      }
      return file;
    }

    it("parses valid backup file", async () => {
      const backup = createBackup(mockWallet);
      const json = JSON.stringify(backup);
      const file = createMockFile(json, "backup.json");

      const result = await parseBackupFile(file);

      expect(result).not.toBeNull();
      expect(result?.wallet.id).toBe(mockWallet.id);
    });

    it("returns null for invalid JSON", async () => {
      const file = createMockFile("not valid json", "backup.json");

      const result = await parseBackupFile(file);

      expect(result).toBeNull();
    });

    it("returns null for valid JSON but invalid backup structure", async () => {
      const file = createMockFile('{"foo": "bar"}', "backup.json");

      const result = await parseBackupFile(file);

      expect(result).toBeNull();
    });

    it("returns null for empty file", async () => {
      const file = createMockFile("", "backup.json");

      const result = await parseBackupFile(file);

      expect(result).toBeNull();
    });
  });
});
