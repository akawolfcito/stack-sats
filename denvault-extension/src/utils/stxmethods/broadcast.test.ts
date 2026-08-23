import { describe, it, expect } from "vitest";
import { readBroadcast } from "./broadcast";

describe("readBroadcast", () => {
  it("accepts a real broadcast", () => {
    expect(readBroadcast({ txid: "0x8aa9" })).toEqual({
      ok: true,
      txid: "0x8aa9",
    });
  });

  /**
   * The reported case: redeploying a contract name that already exists.
   * The node answers with a reason and the old code read txid off it.
   */
  it("catches a refusal that names a reason", () => {
    const result = readBroadcast({
      error: "transaction rejected",
      reason: "ContractAlreadyExists",
      reason_data: { contract_identifier: "ST2NJ5K.fond-blush-lamprey" },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.reason).toBe("ContractAlreadyExists");
    expect(result.detail).toContain("ContractAlreadyExists");
    expect(result.detail).toContain("fond-blush-lamprey");
  });

  /**
   * A refusal can carry a txid of its own, so presence of one proves
   * nothing. This is what made the bug so quiet.
   */
  it("is not fooled by a txid on a refusal", () => {
    expect(
      readBroadcast({ reason: "BadNonce", txid: "0xdeadbeef" }).ok
    ).toBe(false);
  });

  it("keeps the node's words when only error came back", () => {
    const result = readBroadcast({ error: "NotEnoughFunds" });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    // failure.ts matches on these words to say "Not enough balance".
    expect(result.detail).toContain("NotEnoughFunds");
  });

  it("refuses a body with neither a txid nor a reason", () => {
    for (const body of [{}, null, undefined, { txid: "" }, { txid: "   " }]) {
      expect(readBroadcast(body).ok, JSON.stringify(body)).toBe(false);
    }
  });
});
