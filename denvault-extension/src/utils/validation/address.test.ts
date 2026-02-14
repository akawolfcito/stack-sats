import { describe, it, expect } from "vitest";
import { validateStxAddress, validateBtcAddress } from "./address";

describe("validateStxAddress", () => {
  it("should accept valid testnet address", () => {
    expect(
      validateStxAddress(
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        "testnet"
      )
    ).toBe(true);
  });

  it("should reject address for wrong network", () => {
    expect(
      validateStxAddress("SP000000000000000000002Q6VF78", "testnet")
    ).toBe(false);
  });

  it("should reject random string", () => {
    expect(validateStxAddress("not-an-address", "testnet")).toBe(false);
  });

  it("should reject empty string", () => {
    expect(validateStxAddress("", "testnet")).toBe(false);
  });

  it("should reject address with invalid checksum", () => {
    // Modify last char of a valid address to break checksum
    expect(
      validateStxAddress(
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZG0",
        "testnet"
      )
    ).toBe(false);
  });
});

describe("validateBtcAddress", () => {
  it("should accept valid P2PKH mainnet address", () => {
    expect(validateBtcAddress("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2")).toBe(
      true
    );
  });

  it("should accept valid bech32 address", () => {
    expect(
      validateBtcAddress("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq")
    ).toBe(true);
  });

  it("should reject empty string", () => {
    expect(validateBtcAddress("")).toBe(false);
  });

  it("should reject random string", () => {
    expect(validateBtcAddress("not-a-btc-address")).toBe(false);
  });
});
