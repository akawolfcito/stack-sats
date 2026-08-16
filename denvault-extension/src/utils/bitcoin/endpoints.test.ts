import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  esploraFetch,
  esploraHostsFor,
  getBtcExplorerBase,
  resetEsploraHostCache,
} from "./endpoints";

const OK = () => new Response("7", { status: 200 });
const NOT_FOUND = () => new Response("not found", { status: 404 });
const SERVER_ERROR = () => new Response("boom", { status: 503 });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  resetEsploraHostCache();
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function urlsCalled(): string[] {
  return fetchMock.mock.calls.map((call) => String(call[0]));
}

describe("esploraHostsFor", () => {
  it("prefers the host that answers today", () => {
    // mempool.space stopped answering for both networks, which is what
    // left the balance resolving to zero after a 15s timeout. Blockstream
    // serves the same Esplora API.
    expect(esploraHostsFor("testnet")[0]).toBe(
      "https://blockstream.info/testnet/api"
    );
    expect(esploraHostsFor("mainnet")[0]).toBe("https://blockstream.info/api");
  });

  it("keeps the other host as a fallback rather than dropping it", () => {
    // Unreachable here is not the same as unreachable everywhere: the
    // outage may be regional, so the old host stays in the chain.
    expect(esploraHostsFor("testnet")).toContain(
      "https://mempool.space/testnet/api"
    );
  });

  it("treats devnet as testnet", () => {
    expect(esploraHostsFor("devnet")).toEqual(esploraHostsFor("testnet"));
  });
});

describe("esploraFetch", () => {
  it("returns the first host that answers", async () => {
    fetchMock.mockResolvedValueOnce(OK());

    const response = await esploraFetch("/blocks/tip/height", {
      network: "testnet",
    });

    expect(response.status).toBe(200);
    expect(urlsCalled()).toEqual([
      "https://blockstream.info/testnet/api/blocks/tip/height",
    ]);
  });

  it("moves to the next host when one does not answer", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(OK());

    const response = await esploraFetch("/blocks/tip/height", {
      network: "testnet",
    });

    expect(response.status).toBe(200);
    expect(urlsCalled()).toEqual([
      "https://blockstream.info/testnet/api/blocks/tip/height",
      "https://mempool.space/testnet/api/blocks/tip/height",
    ]);
  });

  it("moves on when a host answers with a server error", async () => {
    fetchMock.mockResolvedValueOnce(SERVER_ERROR()).mockResolvedValueOnce(OK());

    const response = await esploraFetch("/x", { network: "testnet" });

    expect(response.status).toBe(200);
    expect(urlsCalled()).toHaveLength(2);
  });

  it("keeps a 404, which is an answer", async () => {
    fetchMock.mockResolvedValueOnce(NOT_FOUND());

    const response = await esploraFetch("/address/unknown", {
      network: "testnet",
    });

    // An unknown address is a legitimate reply. Failing over here would
    // double every lookup for no reason.
    expect(response.status).toBe(404);
    expect(urlsCalled()).toHaveLength(1);
  });

  it("throws once every host has been tried", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));

    await expect(
      esploraFetch("/x", { network: "testnet" })
    ).rejects.toThrow(/no bitcoin api could be reached/i);
    expect(urlsCalled()).toHaveLength(2);
  });

  it("remembers the host that worked, so the session pays failover once", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(OK())
      .mockResolvedValueOnce(OK());

    await esploraFetch("/first", { network: "testnet" });
    fetchMock.mockClear();
    await esploraFetch("/second", { network: "testnet" });

    expect(urlsCalled()).toEqual([
      "https://mempool.space/testnet/api/second",
    ]);
  });

  it("passes the request options through", async () => {
    fetchMock.mockResolvedValueOnce(OK());

    await esploraFetch("/tx", {
      network: "testnet",
      init: { method: "POST", body: "rawtx" },
    });

    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: "POST",
      body: "rawtx",
    });
  });
});

describe("getBtcExplorerBase", () => {
  it("points at the host the wallet can actually reach", () => {
    expect(getBtcExplorerBase("testnet")).toBe(
      "https://blockstream.info/testnet"
    );
    expect(getBtcExplorerBase("mainnet")).toBe("https://blockstream.info");
  });
});
