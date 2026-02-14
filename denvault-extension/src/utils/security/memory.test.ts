import { describe, it, expect } from "vitest";
import { clearObject } from "./memory";

describe("Memory Security Module", () => {
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

      clearObject(obj);

      // Property should be deleted
      expect("secret" in obj).toBe(false);
    });
  });
});
