import { describe, it, expect } from "vitest";
import { toQueueApproveResult } from "./queue";

/**
 * Exactly the shape handleGetAddresses puts in Result.data. Every method
 * handler in this module returns a complete envelope like this one.
 */
const GET_ADDRESSES_ENVELOPE = {
  jsonrpc: "2.0",
  id: "req-1",
  result: {
    addresses: [
      { symbol: "BTC", address: "1BtcLegacy", publicKey: "pk" },
      { symbol: "BTC", address: "bc1pTaproot", publicKey: "pk" },
      { symbol: "STX", address: "ST2NJ5K0", publicKey: "pk" },
    ],
    network: {
      name: "testnet",
      chainId: 2147483648,
      client: { baseUrl: "https://api.testnet.hiro.so" },
    },
  },
};

describe("toQueueApproveResult", () => {
  it("hands background the inner result, not the envelope", () => {
    const approved = toQueueApproveResult(GET_ADDRESSES_ENVELOPE);

    expect(approved).toBe(GET_ADDRESSES_ENVELOPE.result);
    // The dApp reads response.result.addresses. Anything that still
    // carries jsonrpc/id here ends up nested one level too deep.
    expect(approved).not.toHaveProperty("jsonrpc");
    expect(approved).not.toHaveProperty("id");
  });

  it("works for a signature envelope too", () => {
    const envelope = {
      jsonrpc: "2.0",
      id: "req-2",
      result: { signature: "0xsig", publicKey: "pk" },
    };

    expect(toQueueApproveResult(envelope)).toEqual({
      signature: "0xsig",
      publicKey: "pk",
    });
  });

  it("keeps a result that is present but empty", () => {
    expect(toQueueApproveResult({ jsonrpc: "2.0", id: "x", result: {} })).toEqual(
      {}
    );
  });

  it("throws when the handler returned no envelope", () => {
    expect(() => toQueueApproveResult({ addresses: [] })).toThrow(
      /JSON-RPC response envelope/
    );
  });

  it("throws when the envelope carries no result", () => {
    expect(() => toQueueApproveResult({ jsonrpc: "2.0", id: "x" })).toThrow(
      /JSON-RPC response envelope/
    );
  });
});
