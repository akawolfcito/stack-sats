import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isValidPIN,
  generateSalt,
  clearSensitiveString,
  encryptWithPIN,
  decryptWithPIN,
  type EncryptedData,
} from "./encryption";

describe("Encryption Module", () => {
  describe("isValidPIN", () => {
    it("returns true for valid 6-digit PIN", () => {
      expect(isValidPIN("123456")).toBe(true);
      expect(isValidPIN("000000")).toBe(true);
      expect(isValidPIN("999999")).toBe(true);
    });

    it("returns false for PIN shorter than 6 digits", () => {
      expect(isValidPIN("12345")).toBe(false);
      expect(isValidPIN("1234")).toBe(false);
      expect(isValidPIN("1")).toBe(false);
      expect(isValidPIN("")).toBe(false);
    });

    it("returns false for PIN longer than 6 digits", () => {
      expect(isValidPIN("1234567")).toBe(false);
      expect(isValidPIN("12345678")).toBe(false);
    });

    it("returns false for PIN with non-digit characters", () => {
      expect(isValidPIN("12345a")).toBe(false);
      expect(isValidPIN("abcdef")).toBe(false);
      expect(isValidPIN("123 56")).toBe(false);
      expect(isValidPIN("123-56")).toBe(false);
      expect(isValidPIN("12345.")).toBe(false);
    });

    it("returns false for PIN with special characters", () => {
      expect(isValidPIN("!@#$%^")).toBe(false);
      expect(isValidPIN("123!56")).toBe(false);
    });
  });

  describe("generateSalt", () => {
    it("returns Uint8Array of correct length (16 bytes)", () => {
      const salt = generateSalt();
      expect(salt).toBeInstanceOf(Uint8Array);
      expect(salt.length).toBe(16);
    });

    it("generates different values each call", () => {
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      // Convert to strings for comparison
      const str1 = Array.from(salt1).join(",");
      const str2 = Array.from(salt2).join(",");

      expect(str1).not.toBe(str2);
    });

    it("contains non-zero values (with high probability)", () => {
      const salt = generateSalt();
      const hasNonZero = Array.from(salt).some((byte) => byte !== 0);
      expect(hasNonZero).toBe(true);
    });
  });

  describe("clearSensitiveString", () => {
    it("accepts string without throwing", () => {
      expect(() => clearSensitiveString("sensitive data")).not.toThrow();
    });

    it("handles empty string", () => {
      expect(() => clearSensitiveString("")).not.toThrow();
    });

    it("handles long strings", () => {
      const longString = "a".repeat(10000);
      expect(() => clearSensitiveString(longString)).not.toThrow();
    });
  });

  // Note: These tests require Web Crypto API to be available
  // In environments without it, they will be skipped
  describe("encryptWithPIN and decryptWithPIN", () => {
    const testData = "test mnemonic phrase with twelve words or more";
    const testPIN = "123456";

    // Check if crypto.subtle is available
    const hasCrypto = typeof crypto !== "undefined" && crypto.subtle;

    it.skipIf(!hasCrypto)(
      "encrypts and decrypts data correctly",
      async () => {
        const encrypted = await encryptWithPIN(testData, testPIN);

        expect(encrypted.ciphertext).toBeTruthy();
        expect(encrypted.iv).toBeTruthy();
        expect(encrypted.salt).toBeTruthy();

        const decrypted = await decryptWithPIN(encrypted, testPIN);
        expect(decrypted).toBe(testData);
      }
    );

    it.skipIf(!hasCrypto)(
      "returns base64-encoded values",
      async () => {
        const encrypted = await encryptWithPIN(testData, testPIN);

        // Base64 strings should only contain valid characters
        const base64Regex = /^[A-Za-z0-9+/]+=*$/;

        expect(encrypted.ciphertext).toMatch(base64Regex);
        expect(encrypted.iv).toMatch(base64Regex);
        expect(encrypted.salt).toMatch(base64Regex);
      }
    );

    it.skipIf(!hasCrypto)(
      "produces different ciphertexts for same data",
      async () => {
        const encrypted1 = await encryptWithPIN(testData, testPIN);
        const encrypted2 = await encryptWithPIN(testData, testPIN);

        // Due to random IV and salt, ciphertexts should differ
        expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
        expect(encrypted1.iv).not.toBe(encrypted2.iv);
        expect(encrypted1.salt).not.toBe(encrypted2.salt);
      }
    );

    it.skipIf(!hasCrypto)(
      "fails to decrypt with wrong PIN",
      async () => {
        const encrypted = await encryptWithPIN(testData, testPIN);

        await expect(decryptWithPIN(encrypted, "654321")).rejects.toThrow();
      }
    );

    it.skipIf(!hasCrypto)(
      "handles Unicode data correctly",
      async () => {
        const unicodeData = "Wallet 日本語 🔐 émoji";

        const encrypted = await encryptWithPIN(unicodeData, testPIN);
        const decrypted = await decryptWithPIN(encrypted, testPIN);

        expect(decrypted).toBe(unicodeData);
      }
    );

    it.skipIf(!hasCrypto)(
      "handles empty string",
      async () => {
        const encrypted = await encryptWithPIN("", testPIN);
        const decrypted = await decryptWithPIN(encrypted, testPIN);

        expect(decrypted).toBe("");
      }
    );
  });
});
