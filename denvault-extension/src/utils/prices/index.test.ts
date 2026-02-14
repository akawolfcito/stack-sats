import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  fetchPrices,
  formatUsd,
  microStxToUsd,
  _clearPriceCache,
} from "./index";

describe("Price Service", () => {
  beforeEach(() => {
    _clearPriceCache();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("formatUsd", () => {
    it("formats number to USD string", () => {
      expect(formatUsd(1.5)).toBe("$1.50");
      expect(formatUsd(0)).toBe("$0.00");
      expect(formatUsd(1234.567)).toBe("$1234.57");
    });
  });

  describe("microStxToUsd", () => {
    it("converts microSTX to USD string", () => {
      expect(microStxToUsd(1000000n, 0.5)).toBe("$0.50");
      expect(microStxToUsd(2500000n, 1.0)).toBe("$2.50");
    });

    it("returns null when price is unavailable", () => {
      expect(microStxToUsd(1000000n, null)).toBeNull();
    });
  });

  describe("fetchPrices", () => {
    it("fetches prices from CoinGecko", async () => {
      const mockResponse = {
        blockstack: { usd: 0.45 },
        bitcoin: { usd: 45000 },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await fetchPrices();
      expect(result.stxUsd).toBe(0.45);
      expect(result.btcUsd).toBe(45000);
    });

    it("returns cached values on second call", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            blockstack: { usd: 0.45 },
            bitcoin: { usd: 45000 },
          }),
      });

      await fetchPrices();
      await fetchPrices();

      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("returns null values on fetch error", async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const result = await fetchPrices();
      expect(result.stxUsd).toBeNull();
      expect(result.btcUsd).toBeNull();
    });

    it("returns stale cache on error after successful fetch", async () => {
      vi.useFakeTimers();

      global.fetch = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              blockstack: { usd: 0.45 },
              bitcoin: { usd: 45000 },
            }),
        })
        .mockRejectedValueOnce(new Error("Network error"));

      await fetchPrices(); // succeeds, caches
      vi.advanceTimersByTime(6 * 60 * 1000); // advance past TTL
      const result = await fetchPrices(); // fails, returns stale
      expect(result.stxUsd).toBe(0.45); // stale cache

      vi.useRealTimers();
    });
  });
});
