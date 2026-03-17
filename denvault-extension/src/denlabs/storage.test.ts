/**
 * DenLabs storage module tests
 *
 * Covers: getStorage (chrome and localStorage fallback paths),
 * readDenSignals, writeDenSignals, emitDenSignal, downloadDenSignalsJson
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  readDenSignals,
  writeDenSignals,
  emitDenSignal,
  downloadDenSignalsJson,
  DEN_SIGNAL_STORAGE_KEY,
} from "./storage";

// Disable chrome.storage.local so storage module falls back to localStorage
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

// Helper to create a valid DenSignal
function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    version: "0.1" as const,
    id: "evt_12345678",
    ts: new Date().toISOString(),
    source: { kind: "offchain" as const, system: "denvault" },
    subject: { type: "session" as const, id: "ses_test" },
    action: { name: "test_action" },
    ...overrides,
  };
}

describe("DenLabs Storage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe("readDenSignals", () => {
    it("returns empty array when no signals stored", async () => {
      const signals = await readDenSignals();
      expect(signals).toEqual([]);
    });

    it("reads and parses stored signals", async () => {
      const signal = makeSignal();
      localStorage.setItem(DEN_SIGNAL_STORAGE_KEY, JSON.stringify([signal]));

      const signals = await readDenSignals();
      expect(signals).toHaveLength(1);
      expect(signals[0].id).toBe("evt_12345678");
    });

    it("throws on non-array stored data", async () => {
      localStorage.setItem(DEN_SIGNAL_STORAGE_KEY, JSON.stringify("not-array"));

      await expect(readDenSignals()).rejects.toThrow(
        "Invalid denlabs_densignals_v01 payload"
      );
    });

    it("throws on invalid signal data (Zod validation)", async () => {
      localStorage.setItem(
        DEN_SIGNAL_STORAGE_KEY,
        JSON.stringify([{ invalid: "data" }])
      );

      await expect(readDenSignals()).rejects.toThrow();
    });
  });

  describe("writeDenSignals", () => {
    it("writes signals to storage", async () => {
      const signal = makeSignal();
      await writeDenSignals([signal]);

      const stored = localStorage.getItem(DEN_SIGNAL_STORAGE_KEY);
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed).toHaveLength(1);
    });

    it("overwrites existing signals", async () => {
      const signal1 = makeSignal({ id: "evt_11111111" });
      const signal2 = makeSignal({ id: "evt_22222222" });

      await writeDenSignals([signal1]);
      await writeDenSignals([signal2]);

      const stored = JSON.parse(localStorage.getItem(DEN_SIGNAL_STORAGE_KEY)!);
      expect(stored).toHaveLength(1);
      expect(stored[0].id).toBe("evt_22222222");
    });
  });

  describe("emitDenSignal", () => {
    it("appends a new signal to existing signals", async () => {
      const signal1 = makeSignal({ id: "evt_11111111" });
      await writeDenSignals([signal1]);

      const signal2 = makeSignal({ id: "evt_22222222" });
      await emitDenSignal(signal2);

      const signals = await readDenSignals();
      expect(signals).toHaveLength(2);
    });

    it("creates storage when none exists", async () => {
      const signal = makeSignal();
      await emitDenSignal(signal);

      const signals = await readDenSignals();
      expect(signals).toHaveLength(1);
    });

    it("throws on invalid signal input (Zod)", async () => {
      await expect(emitDenSignal({ bad: "data" })).rejects.toThrow();
    });
  });

  describe("downloadDenSignalsJson", () => {
    it("creates and clicks a download link", async () => {
      const signal = makeSignal();
      await writeDenSignals([signal]);

      // Mock URL and document APIs
      const mockUrl = "blob:test-url";
      const createObjectURLSpy = vi
        .spyOn(URL, "createObjectURL")
        .mockReturnValue(mockUrl);
      const revokeObjectURLSpy = vi
        .spyOn(URL, "revokeObjectURL")
        .mockImplementation(() => {});

      const clickSpy = vi.fn();
      vi.spyOn(document, "createElement").mockReturnValue({
        href: "",
        download: "",
        click: clickSpy,
      } as unknown as HTMLElement);

      await downloadDenSignalsJson();

      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(clickSpy).toHaveBeenCalled();
      expect(revokeObjectURLSpy).toHaveBeenCalledWith(mockUrl);
    });
  });

  describe("getStorage — localStorage fallback", () => {
    it("uses localStorage when chrome.storage is not available", async () => {
      // chrome.storage is already disabled in this test context via setup
      // localStorage fallback handles both string and array keys
      const signal = makeSignal();
      await writeDenSignals([signal]);

      const result = await readDenSignals();
      expect(result).toHaveLength(1);
    });

    it("handles non-JSON values in localStorage gracefully", async () => {
      // Write a non-JSON-parseable value directly
      localStorage.setItem(DEN_SIGNAL_STORAGE_KEY, "plain-string");

      // readDenSignals calls getStorage().get() which returns the raw string
      // Then readDenSignals checks if it's an array — should throw
      await expect(readDenSignals()).rejects.toThrow(
        "Invalid denlabs_densignals_v01 payload"
      );
    });
  });
});
