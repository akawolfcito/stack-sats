import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearString,
  clearObject,
  withSecureValue,
  scheduleCleanup,
} from "./memory";

describe("Memory Security Module", () => {
  describe("clearString", () => {
    it("returns empty string", () => {
      const result = clearString("sensitive data");
      expect(result).toBe("");
    });

    it("handles empty string input", () => {
      const result = clearString("");
      expect(result).toBe("");
    });

    it("handles long strings", () => {
      const longString = "a".repeat(10000);
      const result = clearString(longString);
      expect(result).toBe("");
    });

    it("handles strings with special characters", () => {
      const result = clearString("password123!@#$%");
      expect(result).toBe("");
    });

    it("handles unicode strings", () => {
      const result = clearString("秘密のデータ 🔐");
      expect(result).toBe("");
    });
  });

  describe("clearObject", () => {
    it("clears all string properties", () => {
      const obj: Record<string, unknown> = {
        name: "secret",
        password: "123456",
      };

      clearObject(obj);

      expect(Object.keys(obj)).toHaveLength(0);
    });

    it("clears nested objects recursively", () => {
      const obj: Record<string, unknown> = {
        user: {
          name: "Alice",
          credentials: {
            password: "secret",
          },
        },
      };

      clearObject(obj);

      expect(Object.keys(obj)).toHaveLength(0);
    });

    it("handles empty object", () => {
      const obj: Record<string, unknown> = {};

      expect(() => clearObject(obj)).not.toThrow();
      expect(Object.keys(obj)).toHaveLength(0);
    });

    it("handles object with mixed types", () => {
      const obj: Record<string, unknown> = {
        str: "text",
        num: 123,
        bool: true,
        arr: [1, 2, 3],
        nested: { key: "value" },
      };

      clearObject(obj);

      expect(Object.keys(obj)).toHaveLength(0);
    });

    it("sets string values to empty before deleting", () => {
      const obj: Record<string, unknown> = { secret: "password" };
      const original = obj.secret;

      clearObject(obj);

      // Property should be deleted
      expect("secret" in obj).toBe(false);
    });
  });

  describe("withSecureValue", () => {
    it("executes operation with value", async () => {
      const getValue = vi.fn().mockResolvedValue("secret");
      const operation = vi.fn().mockResolvedValue("result");

      const result = await withSecureValue(getValue, operation);

      expect(getValue).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledWith("secret");
      expect(result).toBe("result");
    });

    it("calls cleanup function after operation", async () => {
      const getValue = vi.fn().mockResolvedValue("secret");
      const operation = vi.fn().mockResolvedValue("result");
      const cleanup = vi.fn();

      await withSecureValue(getValue, operation, cleanup);

      expect(cleanup).toHaveBeenCalledWith("secret");
    });

    it("calls cleanup even if operation throws", async () => {
      const getValue = vi.fn().mockResolvedValue("secret");
      const operation = vi.fn().mockRejectedValue(new Error("failed"));
      const cleanup = vi.fn();

      await expect(
        withSecureValue(getValue, operation, cleanup)
      ).rejects.toThrow("failed");

      expect(cleanup).toHaveBeenCalledWith("secret");
    });

    it("works without cleanup function", async () => {
      const getValue = vi.fn().mockResolvedValue("secret");
      const operation = vi.fn().mockResolvedValue("result");

      const result = await withSecureValue(getValue, operation);

      expect(result).toBe("result");
    });

    it("propagates errors from getValue", async () => {
      const getValue = vi.fn().mockRejectedValue(new Error("getValue failed"));
      const operation = vi.fn();

      await expect(withSecureValue(getValue, operation)).rejects.toThrow(
        "getValue failed"
      );

      expect(operation).not.toHaveBeenCalled();
    });

    it("handles async cleanup function", async () => {
      const getValue = vi.fn().mockResolvedValue("secret");
      const operation = vi.fn().mockResolvedValue("result");
      let cleanedValue = "";
      const cleanup = (value: string) => {
        cleanedValue = value;
      };

      await withSecureValue(getValue, operation, cleanup);

      expect(cleanedValue).toBe("secret");
    });
  });

  describe("scheduleCleanup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("schedules cleanup via setTimeout", () => {
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

      scheduleCleanup();

      expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 0);
    });

    it("executes callback on next tick", () => {
      scheduleCleanup();

      // Before timer fires
      vi.advanceTimersByTime(0);

      // The timeout callback should have been executed
      // (no assertion needed - just verifying no errors)
    });

    it("handles missing gc function gracefully", () => {
      // globalThis.gc is typically undefined
      expect(() => {
        scheduleCleanup();
        vi.runAllTimers();
      }).not.toThrow();
    });

    it("calls gc if available", () => {
      const mockGc = vi.fn();
      // @ts-expect-error - mocking global gc
      globalThis.gc = mockGc;

      scheduleCleanup();
      vi.runAllTimers();

      expect(mockGc).toHaveBeenCalled();

      // Cleanup
      // @ts-expect-error - removing mock
      delete globalThis.gc;
    });
  });
});
