import { describe, it, expect, vi, beforeEach } from "vitest";
import { encryptWithPIN } from "@/utils/security";
import type { VaultEntry } from "@/utils/security/vault";

const getWalletsAsync = vi.hoisted(() => vi.fn());
vi.mock("./index", () => ({ getWalletsAsync }));

import {
  pinOpensWallet,
  verifyWalletPin,
  describeWalletAuth,
} from "./ownership";

const PIN_A = "111111";
const PIN_B = "222222";

async function entry(id: string, pin: string): Promise<VaultEntry> {
  return {
    id,
    name: id,
    encryptedData: await encryptWithPIN("a phrase that is not a real one", pin),
    createdAt: Date.now(),
    version: 1,
  };
}

describe("pinOpensWallet", () => {
  it("accepts the PIN the wallet was encrypted with", async () => {
    expect(await pinOpensWallet(await entry("a", PIN_A), PIN_A)).toBe(true);
  });

  /** The reported hole: one wallet's PIN must not open another. */
  it("refuses another wallet's PIN", async () => {
    expect(await pinOpensWallet(await entry("a", PIN_A), PIN_B)).toBe(false);
  });

  it("refuses anything that is not 6 digits", async () => {
    const e = await entry("a", PIN_A);
    for (const bad of ["", "11111", "1111111", "11111a", "      "]) {
      expect(await pinOpensWallet(e, bad)).toBe(false);
    }
  });
});

describe("verifyWalletPin", () => {
  beforeEach(() => getWalletsAsync.mockReset());

  it("authorises the wallet whose PIN was given", async () => {
    const a = await entry("a", PIN_A);
    const b = await entry("b", PIN_B);
    getWalletsAsync.mockResolvedValue([a, b]);

    expect(await verifyWalletPin("b", PIN_B)).toEqual({ ok: true });
  });

  /**
   * The whole point. Being unlocked with wallet A is not authority over B.
   */
  it("refuses to authorise a wallet with a different wallet's PIN", async () => {
    const a = await entry("a", PIN_A);
    const b = await entry("b", PIN_B);
    getWalletsAsync.mockResolvedValue([a, b]);

    expect(await verifyWalletPin("b", PIN_A)).toEqual({
      ok: false,
      reason: "wrong-pin",
    });
  });

  it("says so when the wallet is already gone", async () => {
    getWalletsAsync.mockResolvedValue([]);
    expect(await verifyWalletPin("b", PIN_B)).toEqual({
      ok: false,
      reason: "not-found",
    });
  });

  it("rejects a malformed PIN without reading storage", async () => {
    getWalletsAsync.mockResolvedValue([]);
    expect(await verifyWalletPin("b", "12")).toEqual({
      ok: false,
      reason: "malformed-pin",
    });
    expect(getWalletsAsync).not.toHaveBeenCalled();
  });
});

describe("describeWalletAuth", () => {
  it("never hints at which wallet a PIN does open", () => {
    const message = describeWalletAuth({ ok: false, reason: "wrong-pin" });
    expect(message).toContain("this wallet");
    expect(message).not.toMatch(/wallet [0-9]|belongs to/i);
  });
});
