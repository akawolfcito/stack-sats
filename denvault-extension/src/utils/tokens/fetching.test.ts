/**
 * Unit tests for tokens/index.ts — async fetching functions
 *
 * Complements the existing index.test.ts (pure functions) by testing
 * fetchTokenMetadata, fetchAllTokenInfo, and clearTokenMetadataCache
 * with mocked fetch and network calls.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Module-level mocks ----

vi.mock("../network", () => ({
  getSelectedNetwork: vi.fn(() => "testnet"),
}));

vi.mock("../security/logger", () => ({
  secureLog: vi.fn(),
}));

// ---- Import module under test ----

import {
  fetchTokenMetadata,
  fetchAllTokenInfo,
  clearTokenMetadataCache,
  type TokenMetadata,
  type FungibleTokenBalance,
} from "./index";

// ---- Helpers ----

function mockFetchOk(data: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockFetchError(status: number) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({}),
  });
}

function mockFetchReject(message: string) {
  global.fetch = vi.fn().mockRejectedValueOnce(new Error(message));
}

const SAMPLE_METADATA: TokenMetadata = {
  name: "Fari Token",
  symbol: "FARI",
  decimals: 6,
  image_uri: "https://example.com/fari.png",
};

const CONTRACT_ADDRESS = "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token";

// ---- Tests ----

beforeEach(() => {
  clearTokenMetadataCache();
  vi.restoreAllMocks();
});

describe("fetchTokenMetadata", () => {
  it("returns metadata on successful fetch", async () => {
    mockFetchOk(SAMPLE_METADATA);

    const result = await fetchTokenMetadata(CONTRACT_ADDRESS);

    expect(result).toEqual(SAMPLE_METADATA);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(`/ft/${CONTRACT_ADDRESS}`)
    );
  });

  it("uses the testnet API URL by default", async () => {
    mockFetchOk(SAMPLE_METADATA);

    await fetchTokenMetadata(CONTRACT_ADDRESS);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.testnet.hiro.so/metadata/v1")
    );
  });

  it("uses the mainnet API URL when network is mainnet", async () => {
    mockFetchOk(SAMPLE_METADATA);

    await fetchTokenMetadata(CONTRACT_ADDRESS, "mainnet");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.hiro.so/metadata/v1")
    );
  });

  it("returns null when API returns non-ok status", async () => {
    mockFetchError(404);

    const result = await fetchTokenMetadata(CONTRACT_ADDRESS);

    expect(result).toBeNull();
  });

  it("returns null when fetch throws a network error", async () => {
    mockFetchReject("ECONNREFUSED");

    const result = await fetchTokenMetadata(CONTRACT_ADDRESS);

    expect(result).toBeNull();
  });

  it("caches metadata and returns cached value on second call", async () => {
    mockFetchOk(SAMPLE_METADATA);

    const first = await fetchTokenMetadata(CONTRACT_ADDRESS);
    const second = await fetchTokenMetadata(CONTRACT_ADDRESS);

    expect(first).toEqual(SAMPLE_METADATA);
    expect(second).toEqual(SAMPLE_METADATA);
    // fetch should only be called once — second call uses cache
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("uses separate cache keys per network", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...SAMPLE_METADATA, name: "Testnet Token" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...SAMPLE_METADATA, name: "Mainnet Token" }),
      });

    const testnetResult = await fetchTokenMetadata(CONTRACT_ADDRESS, "testnet");
    const mainnetResult = await fetchTokenMetadata(CONTRACT_ADDRESS, "mainnet");

    expect(testnetResult?.name).toBe("Testnet Token");
    expect(mainnetResult?.name).toBe("Mainnet Token");
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("cache is cleared by clearTokenMetadataCache", async () => {
    mockFetchOk(SAMPLE_METADATA);
    await fetchTokenMetadata(CONTRACT_ADDRESS);

    clearTokenMetadataCache();

    // After cache clear, needs to fetch again
    mockFetchOk({ ...SAMPLE_METADATA, name: "Updated Token" });
    const result = await fetchTokenMetadata(CONTRACT_ADDRESS);

    expect(result?.name).toBe("Updated Token");
  });
});

describe("fetchAllTokenInfo", () => {
  const fungibleTokens: Record<string, FungibleTokenBalance> = {
    "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token::fari": {
      balance: "1500000",
      total_sent: "0",
      total_received: "1500000",
    },
    "SP123456789ABCDEFGH.second-token::snd": {
      balance: "5000000",
      total_sent: "1000000",
      total_received: "6000000",
    },
  };

  it("returns TokenInfo array with metadata for all tokens", async () => {
    const metadata1: TokenMetadata = {
      name: "Fari",
      symbol: "FARI",
      decimals: 6,
    };
    const metadata2: TokenMetadata = {
      name: "Second",
      symbol: "SND",
      decimals: 6,
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, json: async () => metadata1 })
      .mockResolvedValueOnce({ ok: true, json: async () => metadata2 });

    const result = await fetchAllTokenInfo(fungibleTokens);

    expect(result).toHaveLength(2);
    expect(result[0].symbol).toBe("FARI");
    expect(result[0].balance).toBe("1500000");
    expect(result[0].formattedBalance).toBe("1.5");
    expect(result[1].symbol).toBe("SND");
  });

  it("uses fallback values when metadata fetch fails", async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await fetchAllTokenInfo(fungibleTokens);

    expect(result).toHaveLength(2);
    // Falls back to contract name / token name
    expect(result[0].name).toBe("fari-token");
    expect(result[0].symbol).toBe("fari");
  });

  it("returns empty array for empty token map", async () => {
    const result = await fetchAllTokenInfo({});
    expect(result).toEqual([]);
  });

  it("limits to first 20 tokens", async () => {
    // Create 25 tokens
    const manyTokens: Record<string, FungibleTokenBalance> = {};
    for (let i = 0; i < 25; i++) {
      manyTokens[`SP123.token-${i}::t${i}`] = {
        balance: "1000",
        total_sent: "0",
        total_received: "1000",
      };
    }

    // Mock fetch for all 20 calls (limited from 25)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ name: "T", symbol: "T", decimals: 0 }),
    });

    const result = await fetchAllTokenInfo(manyTokens);

    expect(result).toHaveLength(20);
    // fetch should be called 20 times, not 25
    expect(global.fetch).toHaveBeenCalledTimes(20);
  });

  it("passes network parameter to fetchTokenMetadata", async () => {
    const singleToken: Record<string, FungibleTokenBalance> = {
      "SP123.token::t": {
        balance: "100",
        total_sent: "0",
        total_received: "100",
      },
    };

    mockFetchOk({ name: "T", symbol: "T", decimals: 0 });

    await fetchAllTokenInfo(singleToken, "mainnet");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.hiro.so/metadata/v1")
    );
  });
});
