import { describe, it, expect } from "vitest";
import { SecureBuffer } from "./secure-buffer";

describe("SecureBuffer", () => {
  it("should store and retrieve data", () => {
    const buf = SecureBuffer.fromString("test mnemonic phrase");
    expect(buf.toString()).toBe("test mnemonic phrase");
    expect(buf.isValid()).toBe(true);
  });

  it("should zero data on wipe", () => {
    const buf = SecureBuffer.fromString("secret data");
    buf.zero();
    expect(buf.isValid()).toBe(false);
    expect(() => buf.toString()).toThrow("SecureBuffer has been zeroed");
  });

  it("should return correct byte length", () => {
    const buf = SecureBuffer.fromString("hello");
    expect(buf.byteLength).toBe(5);
  });

  it("should zero internal bytes", () => {
    const buf = SecureBuffer.fromString("abc");
    const bytesRef = buf.bytes;
    buf.zero();
    expect(bytesRef.every((b) => b === 0)).toBe(true);
  });

  it("should create from bytes", () => {
    const original = new Uint8Array([1, 2, 3]);
    const buf = SecureBuffer.fromBytes(original);
    expect(buf.bytes).toEqual(new Uint8Array([1, 2, 3]));
    // Verify it's a copy (modifying original doesn't affect buffer)
    original[0] = 99;
    expect(buf.bytes[0]).toBe(1);
  });
});
