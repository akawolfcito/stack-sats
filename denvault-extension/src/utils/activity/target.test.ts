/**
 * Where a tapped activity row is supposed to go.
 *
 * The transaction detail screen reads the Stacks API, so a Bitcoin txid
 * lands on a page that can never load it: "Transaction not found", every
 * time, for every Bitcoin row. UserHomeView guarded against that inline;
 * AssetDetailView, which shows the same history on /asset/btc, pushed the
 * Stacks route unconditionally. Two screens, one list, two behaviours.
 *
 * The decision lives here so neither screen can drift from the other.
 */

import { describe, it, expect } from "vitest";
import { activityTarget } from "./target";

const BTC_TXID = "33251914aabbccdd";
const STX_TXID = "0xa4b159a553";

describe("activityTarget", () => {
  it("sends a Bitcoin txid to a Bitcoin explorer", () => {
    const target = activityTarget(BTC_TXID, [BTC_TXID], "testnet");

    expect(target.kind).toBe("bitcoin");
    expect(target.url).toContain(BTC_TXID);
  });

  it("sends a Stacks txid to the detail screen", () => {
    const target = activityTarget(STX_TXID, [BTC_TXID], "testnet");

    expect(target).toEqual({ kind: "stacks", path: `/transaction/${STX_TXID}` });
  });

  it("treats an empty Bitcoin history as all Stacks", () => {
    expect(activityTarget(STX_TXID, [], "testnet").kind).toBe("stacks");
  });

  it("points at the network's own explorer", () => {
    const testnet = activityTarget(BTC_TXID, [BTC_TXID], "testnet");
    const mainnet = activityTarget(BTC_TXID, [BTC_TXID], "mainnet");

    expect(testnet.url).not.toBe(mainnet.url);
    expect(testnet.url).toContain("testnet");
  });

  it("matches a txid whatever case it arrives in", () => {
    const target = activityTarget(BTC_TXID.toUpperCase(), [BTC_TXID], "testnet");

    expect(target.kind).toBe("bitcoin");
  });
});
