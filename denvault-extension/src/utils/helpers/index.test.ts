/**
 * Unit tests for helpers/index.ts
 *
 * Tests the hashUint8Array SHA-256 utility function.
 */

import { describe, it, expect } from "vitest";
import { hashUint8Array } from "./index";

describe("hashUint8Array", () => {
  it("returns a 64-character hex string for valid input", async () => {
    const data = new Uint8Array([1, 2, 3, 4]);
    const hash = await hashUint8Array(data);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces the known SHA-256 digest of empty input", async () => {
    const data = new Uint8Array([]);
    const hash = await hashUint8Array(data);
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    );
  });

  it("produces the known SHA-256 digest of 'hello'", async () => {
    // "hello" = [104, 101, 108, 108, 111] in UTF-8
    const data = new Uint8Array([104, 101, 108, 108, 111]);
    const hash = await hashUint8Array(data);
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(hash).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824"
    );
  });

  it("is deterministic — same input always yields the same hash", async () => {
    const data = new Uint8Array([10, 20, 30]);
    const hash1 = await hashUint8Array(data);
    const hash2 = await hashUint8Array(data);
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await hashUint8Array(new Uint8Array([1]));
    const hash2 = await hashUint8Array(new Uint8Array([2]));
    expect(hash1).not.toBe(hash2);
  });

  it("throws for non-Uint8Array input", async () => {
    // @ts-expect-error - testing runtime guard
    await expect(hashUint8Array("not a uint8array")).rejects.toThrow(
      "Input must be a Uint8Array"
    );
  });

  it("throws for null input", async () => {
    // @ts-expect-error - testing runtime guard
    await expect(hashUint8Array(null)).rejects.toThrow(
      "Input must be a Uint8Array"
    );
  });

  it("throws for number input", async () => {
    // @ts-expect-error - testing runtime guard
    await expect(hashUint8Array(42)).rejects.toThrow(
      "Input must be a Uint8Array"
    );
  });
});
