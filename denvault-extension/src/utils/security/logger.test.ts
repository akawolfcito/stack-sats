/**
 * Logger module tests
 * Covers sanitizeForLog, secureLog, secureWarn, secureError, devLog, isDebugMode
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// We need to control import.meta.env.VITE_DEBUG, so we test with two module loads:
// 1. Default (no DEBUG) — secureLog/secureWarn/devLog should be silent
// 2. With DEBUG=true — all functions should log

describe("Logger (sanitizeForLog)", () => {
  // sanitizeForLog is a pure function, test it directly
  let sanitizeForLog: typeof import("./logger").sanitizeForLog;

  beforeEach(async () => {
    const mod = await import("./logger");
    sanitizeForLog = mod.sanitizeForLog;
  });

  it("returns null for null input", () => {
    expect(sanitizeForLog(null)).toBeNull();
  });

  it("returns undefined for undefined input", () => {
    expect(sanitizeForLog(undefined)).toBeUndefined();
  });

  it("returns primitive non-string values unchanged", () => {
    expect(sanitizeForLog(42)).toBe(42);
    expect(sanitizeForLog(true)).toBe(true);
    expect(sanitizeForLog(false)).toBe(false);
  });

  it("returns normal strings unchanged", () => {
    expect(sanitizeForLog("hello world")).toBe("hello world");
  });

  it("redacts strings that look like a mnemonic (12 words)", () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    expect(sanitizeForLog(mnemonic)).toBe("[REDACTED - possible mnemonic]");
  });

  it("redacts strings that look like a mnemonic (24 words)", () => {
    const words = Array(24).fill("word").join(" ");
    expect(sanitizeForLog(words)).toBe("[REDACTED - possible mnemonic]");
  });

  it("does not redact strings with fewer than 12 words", () => {
    const short = "one two three four five six seven eight nine ten eleven";
    expect(sanitizeForLog(short)).toBe(short);
  });

  it("does not redact strings with more than 24 words", () => {
    const long = Array(25).fill("word").join(" ");
    expect(sanitizeForLog(long)).toBe(long);
  });

  it("redacts strings that look like a private key (64+ hex chars)", () => {
    const hexKey = "a".repeat(64);
    expect(sanitizeForLog(hexKey)).toBe("[REDACTED - possible private key]");
  });

  it("does not redact short hex strings", () => {
    const shortHex = "abcdef1234";
    expect(sanitizeForLog(shortHex)).toBe(shortHex);
  });

  it("sanitizes arrays recursively", () => {
    const input = ["hello", "a".repeat(64), 42];
    const result = sanitizeForLog(input) as unknown[];
    expect(result[0]).toBe("hello");
    expect(result[1]).toBe("[REDACTED - possible private key]");
    expect(result[2]).toBe(42);
  });

  it("redacts sensitive fields in objects by key name", () => {
    const obj = {
      name: "test",
      mnemonic: "some secret",
      stxPrivateKey: "abc123",
      password: "secret",
      pin: "123456",
      secretKey: "key",
      seed: "seed data",
      seedPhrase: "seed phrase",
      privateKey: "pk",
      privkey: "privk",
      secret: "sssh",
    };

    const result = sanitizeForLog(obj) as Record<string, unknown>;
    expect(result.name).toBe("test");
    expect(result.mnemonic).toBe("[REDACTED]");
    expect(result.stxPrivateKey).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.pin).toBe("[REDACTED]");
    expect(result.secretKey).toBe("[REDACTED]");
    expect(result.seed).toBe("[REDACTED]");
    expect(result.seedPhrase).toBe("[REDACTED]");
    expect(result.privateKey).toBe("[REDACTED]");
    expect(result.privkey).toBe("[REDACTED]");
    expect(result.secret).toBe("[REDACTED]");
  });

  it("handles case-insensitive field matching", () => {
    const obj = { MyPassword: "secret", MNEMONIC: "data" };
    const result = sanitizeForLog(obj) as Record<string, unknown>;
    expect(result.MyPassword).toBe("[REDACTED]");
    expect(result.MNEMONIC).toBe("[REDACTED]");
  });

  it("recursively sanitizes nested objects", () => {
    const obj = {
      user: {
        name: "alice",
        privateKey: "key123",
      },
    };

    const result = sanitizeForLog(obj) as Record<string, Record<string, unknown>>;
    expect(result.user.name).toBe("alice");
    expect(result.user.privateKey).toBe("[REDACTED]");
  });

  it("handles nested arrays inside objects", () => {
    const obj = {
      items: ["a".repeat(64), "normal"],
    };
    const result = sanitizeForLog(obj) as Record<string, unknown[]>;
    expect(result.items[0]).toBe("[REDACTED - possible private key]");
    expect(result.items[1]).toBe("normal");
  });
});

describe("Logger (secureLog, secureWarn, secureError, devLog, isDebugMode)", () => {
  let secureLog: typeof import("./logger").secureLog;
  let secureWarn: typeof import("./logger").secureWarn;
  let secureError: typeof import("./logger").secureError;
  let devLog: typeof import("./logger").devLog;
  let isDebugMode: typeof import("./logger").isDebugMode;

  beforeEach(async () => {
    const mod = await import("./logger");
    secureLog = mod.secureLog;
    secureWarn = mod.secureWarn;
    secureError = mod.secureError;
    devLog = mod.devLog;
    isDebugMode = mod.isDebugMode;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("when DEBUG is false (default in test)", () => {
    it("isDebugMode returns false", () => {
      // In test env, VITE_DEBUG is not set so DEBUG = false
      expect(isDebugMode()).toBe(false);
    });

    it("secureLog does not call console.log", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      secureLog("test message");
      expect(spy).not.toHaveBeenCalled();
    });

    it("secureLog does not call console.log even with data", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      secureLog("test message", { key: "value" });
      expect(spy).not.toHaveBeenCalled();
    });

    it("secureWarn does not call console.warn", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      secureWarn("test warning");
      expect(spy).not.toHaveBeenCalled();
    });

    it("secureWarn does not call console.warn even with data", () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      secureWarn("test warning", { key: "value" });
      expect(spy).not.toHaveBeenCalled();
    });

    it("devLog does not call console.log", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      devLog("test dev log");
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe("secureError (always logs regardless of DEBUG)", () => {
    it("calls console.error with message only", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      secureError("error happened");
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toMatch(/\[StacksWallet .+\]/);
      expect(spy.mock.calls[0][1]).toBe("error happened");
    });

    it("calls console.error with sanitized data", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      secureError("error with data", { mnemonic: "secret", info: "safe" });
      expect(spy).toHaveBeenCalledTimes(1);
      const loggedData = spy.mock.calls[0][2] as Record<string, unknown>;
      expect(loggedData.mnemonic).toBe("[REDACTED]");
      expect(loggedData.info).toBe("safe");
    });

    it("includes ISO timestamp in prefix", () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      secureError("test");
      const prefix = spy.mock.calls[0][0] as string;
      // Should match pattern like [StacksWallet 2026-03-17T...]
      expect(prefix).toMatch(/\[StacksWallet \d{4}-\d{2}-\d{2}T/);
    });
  });
});
