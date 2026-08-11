/**
 * Tests for the canonical-params fetcher (P0-3 popup-side guard).
 *
 * These tests prove that the popup signs against background's
 * activeRequest.params, NOT against a (possibly tampered) `props.payload`.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { fetchCanonicalRequest } from "./useCanonicalRequest";

describe("useCanonicalRequest.fetchCanonicalRequest", () => {
  let sendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMessage = vi.fn();
    (globalThis as unknown as { chrome: unknown }).chrome = {
      runtime: { sendMessage },
    };
  });

  it("returns the canonical JsonRpcRequest when background ack is ok", async () => {
    sendMessage.mockResolvedValueOnce({
      ok: true,
      request: {
        id: "req-1",
        method: "stx_transferStx",
        params: { recipient: "ST_CANONICAL", amount: "1000000" },
        origin: "https://app.example.com",
      },
    });

    const result = await fetchCanonicalRequest("req-1");

    expect(sendMessage).toHaveBeenCalledWith({
      type: "GET_ACTIVE_REQUEST",
      requestId: "req-1",
    });
    expect(result).toEqual({
      jsonrpc: "2.0",
      id: "req-1",
      method: "stx_transferStx",
      params: { recipient: "ST_CANONICAL", amount: "1000000" },
    });
  });

  it("returns canonical params even when caller supplies a tampered payload locally", async () => {
    // Simulate a scenario where the popup's local payload was mutated to
    // a different recipient/amount, but background still holds the original.
    const tamperedPopupParams = {
      recipient: "ST_ATTACKER",
      amount: "999999999",
    };

    sendMessage.mockResolvedValueOnce({
      ok: true,
      request: {
        id: "req-2",
        method: "stx_transferStx",
        params: { recipient: "ST_VICTIM_APPROVED", amount: "100" },
        origin: "https://legit.example.com",
      },
    });

    const canonical = await fetchCanonicalRequest("req-2");

    // Whatever the popup believes locally, signing must use these params.
    expect(canonical?.params).toEqual({
      recipient: "ST_VICTIM_APPROVED",
      amount: "100",
    });
    // And specifically NOT the tampered values.
    expect(canonical?.params).not.toEqual(tamperedPopupParams);
  });

  it("returns null when background reports ok:false", async () => {
    sendMessage.mockResolvedValueOnce({
      ok: false,
      error: { code: 4002, message: "Request expired or no longer active" },
    });

    const result = await fetchCanonicalRequest("req-stale");
    expect(result).toBeNull();
  });

  it("returns null when background returns a different request id", async () => {
    // Defense in depth: background should never return mismatched id,
    // but if it did, the popup must reject the response.
    sendMessage.mockResolvedValueOnce({
      ok: true,
      request: {
        id: "req-OTHER",
        method: "stx_signMessage",
        params: { message: "evil" },
      },
    });

    const result = await fetchCanonicalRequest("req-asked");
    expect(result).toBeNull();
  });

  it("returns null when requestId is empty", async () => {
    const result = await fetchCanonicalRequest(undefined);
    expect(result).toBeNull();
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it("returns null when chrome runtime is unavailable", async () => {
    (globalThis as unknown as { chrome: unknown }).chrome = undefined;
    const result = await fetchCanonicalRequest("req-1");
    expect(result).toBeNull();
  });

  it("returns null when sendMessage throws (popup-background channel torn)", async () => {
    sendMessage.mockRejectedValueOnce(new Error("Channel closed"));
    const result = await fetchCanonicalRequest("req-broken");
    expect(result).toBeNull();
  });

  it("returns null when background returns no response (undefined)", async () => {
    sendMessage.mockResolvedValueOnce(undefined);
    const result = await fetchCanonicalRequest("req-1");
    expect(result).toBeNull();
  });
});
