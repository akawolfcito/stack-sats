/**
 * How often the wallet is allowed to ask Hiro for the same balance.
 *
 * /extended/v1/address/{addr}/balances was fetched twice on every refresh:
 * loadBalance goes through fetchStxBalance and loadTokens through
 * fetchFungibleTokens, and both call fetchAccountBalances with the same
 * address and network. Every mount, every account switch, every network
 * change and every visibilitychange doubled up, on a public API that
 * answers 429 quickly. The console filled with paired 429s and the home
 * screen showed a zero balance for an account holding 499.97 STX.
 *
 * Two rules here: identical asks inside a short window share one answer,
 * and a 429 stops the asking for a while instead of feeding the limiter.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchAccountBalances,
  fetchStxBalance,
  fetchFungibleTokens,
  resetBalanceCache,
  BALANCE_CACHE_MS,
  RATE_LIMIT_COOLDOWN_MS,
} from "./index";

const ADDRESS = "ST2NJ5K0XKKPTSDZ0KGZF5XRFZTVDQK56VQQWSJBQ";
const OTHER_ADDRESS = "ST1ECQ1V1TG1KYR0ACV6EP09968NBR0XBYKJGG32H";

const payload = {
  stx: {
    balance: "499970000",
    total_sent: "0",
    total_received: "0",
    lock_height: 0,
    lock_tx_id: "",
    locked: "0",
  },
  fungible_tokens: {},
  non_fungible_tokens: {},
};

const mockFetch = vi.fn();

function ok() {
  return { ok: true, status: 200, json: async () => payload };
}

function rateLimited(retryAfter?: string) {
  return {
    ok: false,
    status: 429,
    headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? retryAfter ?? null : null) },
    json: async () => ({}),
  };
}

describe("balance request throttling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
    global.fetch = mockFetch as unknown as typeof fetch;
    localStorage.setItem("selected_network", "testnet");
    resetBalanceCache();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("serves a repeated ask from the first answer", async () => {
    mockFetch.mockResolvedValue(ok());

    await fetchStxBalance(ADDRESS, "testnet");
    await fetchFungibleTokens(ADDRESS, "testnet");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("shares one request between callers that overlap", async () => {
    let release: (value: unknown) => void = () => {};
    mockFetch.mockReturnValue(
      new Promise((resolve) => {
        release = resolve;
      })
    );

    const first = fetchAccountBalances(ADDRESS, "testnet");
    const second = fetchAccountBalances(ADDRESS, "testnet");
    release(ok());

    expect(await first).toEqual(await second);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("asks again once the window has passed", async () => {
    mockFetch.mockResolvedValue(ok());

    await fetchAccountBalances(ADDRESS, "testnet");
    vi.advanceTimersByTime(BALANCE_CACHE_MS + 1);
    await fetchAccountBalances(ADDRESS, "testnet");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("keeps accounts apart", async () => {
    mockFetch.mockResolvedValue(ok());

    await fetchAccountBalances(ADDRESS, "testnet");
    await fetchAccountBalances(OTHER_ADDRESS, "testnet");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("keeps networks apart", async () => {
    mockFetch.mockResolvedValue(ok());

    await fetchAccountBalances(ADDRESS, "testnet");
    await fetchAccountBalances(ADDRESS, "mainnet");

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("stops asking the network that answered 429", async () => {
    mockFetch.mockResolvedValue(rateLimited());

    expect(await fetchAccountBalances(ADDRESS, "testnet")).toBeNull();
    vi.advanceTimersByTime(BALANCE_CACHE_MS + 1);
    expect(await fetchAccountBalances(OTHER_ADDRESS, "testnet")).toBeNull();

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("resumes once the cooldown is over", async () => {
    mockFetch.mockResolvedValueOnce(rateLimited()).mockResolvedValue(ok());

    await fetchAccountBalances(ADDRESS, "testnet");
    vi.advanceTimersByTime(RATE_LIMIT_COOLDOWN_MS + 1);
    const balances = await fetchAccountBalances(ADDRESS, "testnet");

    expect(balances?.stx.balance).toBe("499970000");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("honours a Retry-After longer than the default", async () => {
    mockFetch.mockResolvedValueOnce(rateLimited("30")).mockResolvedValue(ok());

    await fetchAccountBalances(ADDRESS, "testnet");
    vi.advanceTimersByTime(RATE_LIMIT_COOLDOWN_MS + 1);
    expect(await fetchAccountBalances(ADDRESS, "testnet")).toBeNull();

    vi.advanceTimersByTime(30_000);
    expect(await fetchAccountBalances(ADDRESS, "testnet")).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("leaves the other network alone while one is cooling down", async () => {
    mockFetch.mockResolvedValueOnce(rateLimited()).mockResolvedValue(ok());

    await fetchAccountBalances(ADDRESS, "testnet");
    const mainnet = await fetchAccountBalances(ADDRESS, "mainnet");

    expect(mainnet).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not cache a failure as an answer", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, headers: { get: () => null }, json: async () => ({}) })
      .mockResolvedValue(ok());

    expect(await fetchAccountBalances(ADDRESS, "testnet")).toBeNull();
    expect(await fetchAccountBalances(ADDRESS, "testnet")).not.toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
