import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  getOrCreateDeviceSecret,
  combineWithDeviceSecret,
  _clearCachedSecret,
} from "./device-secret";

// Storage for the session mock
let sessionStore: Record<string, unknown> = {};

describe("Device Secret Module", () => {
  beforeEach(() => {
    _clearCachedSecret();
    sessionStore = {};

    // Configure chrome.storage.session mocks to invoke callbacks properly
    vi.mocked(chrome.storage.session.get).mockImplementation(
      (keys: unknown, callback: (result: Record<string, unknown>) => void) => {
        const result: Record<string, unknown> = {};
        const keyList = Array.isArray(keys) ? keys : [keys];
        for (const key of keyList) {
          if (key in sessionStore) {
            result[key as string] = sessionStore[key as string];
          }
        }
        callback(result);
      }
    );

    vi.mocked(chrome.storage.session.set).mockImplementation(
      (items: Record<string, unknown>, callback?: () => void) => {
        Object.assign(sessionStore, items);
        if (callback) callback();
      }
    );
  });

  describe("getOrCreateDeviceSecret", () => {
    it("should generate a 32-byte device secret", async () => {
      const secret = await getOrCreateDeviceSecret();

      expect(secret).toBeInstanceOf(Uint8Array);
      expect(secret.length).toBe(32);
    });

    it("should return the same secret on subsequent calls (caching)", async () => {
      const secret1 = await getOrCreateDeviceSecret();
      const secret2 = await getOrCreateDeviceSecret();

      expect(secret1).toBe(secret2); // Same reference, not just same value
    });

    it("should generate a new secret after clearing cache and session storage", async () => {
      const secret1 = await getOrCreateDeviceSecret();
      _clearCachedSecret();
      // Also clear session storage to simulate a fresh session (e.g., browser restart)
      sessionStore = {};
      const secret2 = await getOrCreateDeviceSecret();

      // Different references (new generation)
      expect(secret1).not.toBe(secret2);
      // Extremely unlikely to be equal (256 bits of randomness)
      const str1 = Array.from(secret1).join(",");
      const str2 = Array.from(secret2).join(",");
      expect(str1).not.toBe(str2);
    });

    it("should contain non-zero values (with high probability)", async () => {
      const secret = await getOrCreateDeviceSecret();
      const hasNonZero = Array.from(secret).some((byte) => byte !== 0);
      expect(hasNonZero).toBe(true);
    });
  });

  describe("combineWithDeviceSecret", () => {
    it("should combine PIN with device secret into a deterministic buffer", async () => {
      const secret = await getOrCreateDeviceSecret();
      const pin = "123456";

      const combined1 = combineWithDeviceSecret(pin, secret);
      const combined2 = combineWithDeviceSecret(pin, secret);

      const str1 = Array.from(combined1).join(",");
      const str2 = Array.from(combined2).join(",");
      expect(str1).toBe(str2);
    });

    it("should produce correct length (PIN bytes + 32 secret bytes)", () => {
      const secret = new Uint8Array(32).fill(0xab);
      const pin = "123456"; // 6 ASCII chars = 6 bytes

      const combined = combineWithDeviceSecret(pin, secret);
      expect(combined.length).toBe(6 + 32);
    });

    it("should produce different outputs for different PINs", () => {
      const secret = new Uint8Array(32).fill(0xab);

      const combined1 = combineWithDeviceSecret("123456", secret);
      const combined2 = combineWithDeviceSecret("654321", secret);

      const str1 = Array.from(combined1).join(",");
      const str2 = Array.from(combined2).join(",");
      expect(str1).not.toBe(str2);
    });

    it("should produce different outputs for different secrets", () => {
      const secret1 = new Uint8Array(32).fill(0xaa);
      const secret2 = new Uint8Array(32).fill(0xbb);
      const pin = "123456";

      const combined1 = combineWithDeviceSecret(pin, secret1);
      const combined2 = combineWithDeviceSecret(pin, secret2);

      const str1 = Array.from(combined1).join(",");
      const str2 = Array.from(combined2).join(",");
      expect(str1).not.toBe(str2);
    });

    it("should place PIN bytes before secret bytes", () => {
      const secret = new Uint8Array([0xff, 0xfe, 0xfd]);
      // Technically secret should be 32 bytes, but the function works with any length
      const pin = "AB"; // ASCII 65, 66

      const combined = combineWithDeviceSecret(pin, secret);
      expect(combined[0]).toBe(65); // 'A'
      expect(combined[1]).toBe(66); // 'B'
      expect(combined[2]).toBe(0xff);
      expect(combined[3]).toBe(0xfe);
      expect(combined[4]).toBe(0xfd);
    });
  });
});
