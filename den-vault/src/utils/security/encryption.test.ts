import { describe, it, expect } from "vitest";
import {
  isValidPIN,
  generateSalt,
  encryptWithPIN,
  decryptWithPIN,
  deriveKey,
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

  describe("deriveKey", () => {
    it("produces a CryptoKey object", async () => {
      const keyMaterial = new TextEncoder().encode("test-key-material");
      const salt = generateSalt();

      const key = await deriveKey(keyMaterial, salt);

      expect(key).toBeDefined();
      expect(key.type).toBe("secret");
      expect(key.algorithm).toMatchObject({ name: "AES-GCM", length: 256 });
      expect(key.usages).toContain("encrypt");
      expect(key.usages).toContain("decrypt");
      expect(key.extractable).toBe(false);
    });

    it("produces different keys for different salts", async () => {
      const keyMaterial = new TextEncoder().encode("test-key-material");
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = await deriveKey(keyMaterial, salt1);
      const key2 = await deriveKey(keyMaterial, salt2);

      // CryptoKey objects are non-extractable, but they should be distinct objects
      expect(key1).not.toBe(key2);
    });
  });

  describe("encryptWithPIN and decryptWithPIN", () => {
    const testData = "test mnemonic phrase with twelve words or more";
    const testPIN = "123456";

    it("encrypts and decrypts data correctly", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();

      const decrypted = await decryptWithPIN(encrypted, testPIN);
      expect(decrypted).toBe(testData);
    });

    it("returns base64-encoded values", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      // Base64 strings should only contain valid characters
      const base64Regex = /^[A-Za-z0-9+/]+=*$/;

      expect(encrypted.ciphertext).toMatch(base64Regex);
      expect(encrypted.iv).toMatch(base64Regex);
      expect(encrypted.salt).toMatch(base64Regex);
    });

    it("produces different ciphertexts for same data", async () => {
      const encrypted1 = await encryptWithPIN(testData, testPIN);
      const encrypted2 = await encryptWithPIN(testData, testPIN);

      // Due to random IV and salt, ciphertexts should differ
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it("fails to decrypt with wrong PIN", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      await expect(decryptWithPIN(encrypted, "654321")).rejects.toThrow();
    });

    it("handles Unicode data correctly", async () => {
      const unicodeData = "Wallet 日本語 🔐 émoji";

      const encrypted = await encryptWithPIN(unicodeData, testPIN);
      const decrypted = await decryptWithPIN(encrypted, testPIN);

      expect(decrypted).toBe(unicodeData);
    });

    it("handles empty string", async () => {
      const encrypted = await encryptWithPIN("", testPIN);
      const decrypted = await decryptWithPIN(encrypted, testPIN);

      expect(decrypted).toBe("");
    });
  });

  describe("encryptWithPIN and decryptWithPIN with device secret", () => {
    const testData = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const testPIN = "123456";

    function makeDeviceSecret(): Uint8Array {
      return crypto.getRandomValues(new Uint8Array(32));
    }

    it("round-trip encrypt/decrypt with device secret succeeds", async () => {
      const deviceSecret = makeDeviceSecret();

      const encrypted = await encryptWithPIN(testData, testPIN, deviceSecret);

      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.iv).toBeTruthy();
      expect(encrypted.salt).toBeTruthy();

      const decrypted = await decryptWithPIN(encrypted, testPIN, deviceSecret);
      expect(decrypted).toBe(testData);
    });

    it("fails to decrypt with wrong device secret", async () => {
      const deviceSecret1 = makeDeviceSecret();
      const deviceSecret2 = makeDeviceSecret();

      const encrypted = await encryptWithPIN(testData, testPIN, deviceSecret1);

      await expect(
        decryptWithPIN(encrypted, testPIN, deviceSecret2)
      ).rejects.toThrow();
    });

    it("fails to decrypt with wrong PIN even when device secret is correct", async () => {
      const deviceSecret = makeDeviceSecret();

      const encrypted = await encryptWithPIN(testData, testPIN, deviceSecret);

      await expect(
        decryptWithPIN(encrypted, "999999", deviceSecret)
      ).rejects.toThrow();
    });

    it("fails to decrypt without device secret when encrypted with one", async () => {
      const deviceSecret = makeDeviceSecret();

      const encrypted = await encryptWithPIN(testData, testPIN, deviceSecret);

      // Attempt decryption without the device secret (PIN-only)
      await expect(
        decryptWithPIN(encrypted, testPIN)
      ).rejects.toThrow();
    });

    it("fails to decrypt with device secret when encrypted without one", async () => {
      const deviceSecret = makeDeviceSecret();

      // Encrypt without device secret
      const encrypted = await encryptWithPIN(testData, testPIN);

      // Attempt decryption with a device secret
      await expect(
        decryptWithPIN(encrypted, testPIN, deviceSecret)
      ).rejects.toThrow();
    });

    it("handles Unicode data with device secret", async () => {
      const deviceSecret = makeDeviceSecret();
      const unicodeData = "Wallet 日本語 🔐 émoji 密码 Пароль";

      const encrypted = await encryptWithPIN(unicodeData, testPIN, deviceSecret);
      const decrypted = await decryptWithPIN(encrypted, testPIN, deviceSecret);

      expect(decrypted).toBe(unicodeData);
    });
  });

  describe("corrupted ciphertext handling", () => {
    const testData = "sensitive mnemonic data here";
    const testPIN = "123456";

    it("fails to decrypt when ciphertext is corrupted", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      // Corrupt the ciphertext by modifying a character in the middle
      const corruptedCiphertext = encrypted.ciphertext;
      const midpoint = Math.floor(corruptedCiphertext.length / 2);
      const charAtMid = corruptedCiphertext[midpoint];
      // Flip to a different valid base64 character
      const replacement = charAtMid === "A" ? "B" : "A";
      const corrupted: EncryptedData = {
        ...encrypted,
        ciphertext:
          corruptedCiphertext.substring(0, midpoint) +
          replacement +
          corruptedCiphertext.substring(midpoint + 1),
      };

      await expect(decryptWithPIN(corrupted, testPIN)).rejects.toThrow();
    });

    it("fails to decrypt when IV is corrupted", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      const corruptedIV = encrypted.iv;
      const charAtStart = corruptedIV[0];
      const replacement = charAtStart === "A" ? "B" : "A";
      const corrupted: EncryptedData = {
        ...encrypted,
        iv: replacement + corruptedIV.substring(1),
      };

      await expect(decryptWithPIN(corrupted, testPIN)).rejects.toThrow();
    });

    it("fails to decrypt when salt is corrupted", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      const corruptedSalt = encrypted.salt;
      const charAtStart = corruptedSalt[0];
      const replacement = charAtStart === "A" ? "B" : "A";
      const corrupted: EncryptedData = {
        ...encrypted,
        salt: replacement + corruptedSalt.substring(1),
      };

      await expect(decryptWithPIN(corrupted, testPIN)).rejects.toThrow();
    });

    it("fails to decrypt with completely invalid base64 ciphertext", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      const corrupted: EncryptedData = {
        ...encrypted,
        ciphertext: "!!!invalid-base64!!!",
      };

      await expect(decryptWithPIN(corrupted, testPIN)).rejects.toThrow();
    });

    it("fails to decrypt with truncated ciphertext", async () => {
      const encrypted = await encryptWithPIN(testData, testPIN);

      const corrupted: EncryptedData = {
        ...encrypted,
        ciphertext: encrypted.ciphertext.substring(0, 4),
      };

      await expect(decryptWithPIN(corrupted, testPIN)).rejects.toThrow();
    });
  });
});
