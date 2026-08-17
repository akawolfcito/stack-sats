import { describe, it, expect } from "vitest";
import { decodeBigInts, BIGINT_TAG } from "./wire";

describe("decodeBigInts", () => {
  it("restores a tagged bigint", () => {
    // A Clarity uint carries a BigInt, and chrome.runtime.sendMessage
    // serializes as JSON, which cannot. The request died at the bridge
    // with "Could not serialize message", so stx_signStructuredMessage
    // never reached the wallet at all.
    expect(decodeBigInts({ [BIGINT_TAG]: "2147483648" })).toBe(2147483648n);
  });

  it("walks into a structured message the way a dApp sends one", () => {
    const domain = {
      type: "tuple",
      value: {
        name: { type: "ascii", value: "DenVault" },
        "chain-id": { type: "uint", value: { [BIGINT_TAG]: "2147483648" } },
      },
    };

    const decoded = decodeBigInts(domain) as {
      value: { "chain-id": { value: bigint } };
    };

    expect(decoded.value["chain-id"].value).toBe(2147483648n);
    expect(typeof decoded.value["chain-id"].value).toBe("bigint");
  });

  it("walks arrays too", () => {
    const decoded = decodeBigInts([
      { [BIGINT_TAG]: "1" },
      { [BIGINT_TAG]: "2" },
    ]) as bigint[];

    expect(decoded).toEqual([1n, 2n]);
  });

  it("leaves everything else exactly as it was", () => {
    const input = {
      contract: "ST000000000000000000002AMW42H.pox-4",
      functionArgs: ["0x0100"],
      nested: { flag: true, count: 3, nothing: null },
    };

    expect(decodeBigInts(input)).toEqual(input);
  });

  it("ignores a tag whose value is not a number", () => {
    // Nothing in the wallet should turn attacker-shaped input into a
    // throw deep inside a signing routine.
    expect(decodeBigInts({ [BIGINT_TAG]: "not-a-number" })).toEqual({
      [BIGINT_TAG]: "not-a-number",
    });
  });

  it("handles null and primitives without complaint", () => {
    expect(decodeBigInts(null)).toBeNull();
    expect(decodeBigInts("plain")).toBe("plain");
    expect(decodeBigInts(7)).toBe(7);
  });
});
