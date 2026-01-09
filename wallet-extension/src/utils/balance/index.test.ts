/**
 * Tests for balance utilities
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchAccountBalances,
  fetchStxBalance,
  fetchFungibleTokens,
  microStxToStx,
  formatStxBalance,
  formatUsdValue,
  type AccountBalances,
} from "./index";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, "localStorage", { value: localStorageMock });

describe("balance utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.getItem.mockReturnValue("testnet");
  });

  describe("fetchFungibleTokens", () => {
    const testAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";

    it("should return tokens when API returns fungible tokens", async () => {
      const mockBalances: AccountBalances = {
        stx: {
          balance: "1000000",
          total_sent: "0",
          total_received: "1000000",
          lock_height: 0,
          lock_tx_id: "",
          locked: "0",
        },
        fungible_tokens: {
          "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc::aBTC": {
            balance: "500000000",
            total_sent: "0",
            total_received: "500000000",
          },
          "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token::usda": {
            balance: "1000000000",
            total_sent: "100000000",
            total_received: "1100000000",
          },
        },
        non_fungible_tokens: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBalances),
      });

      const result = await fetchFungibleTokens(testAddress, "testnet");

      expect(result).not.toBeNull();
      expect(Object.keys(result!)).toHaveLength(2);
      expect(result!["SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-abtc::aBTC"]).toEqual({
        balance: "500000000",
        total_sent: "0",
        total_received: "500000000",
      });
    });

    it("should return empty object when no tokens exist", async () => {
      const mockBalances: AccountBalances = {
        stx: {
          balance: "1000000",
          total_sent: "0",
          total_received: "1000000",
          lock_height: 0,
          lock_tx_id: "",
          locked: "0",
        },
        fungible_tokens: {},
        non_fungible_tokens: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBalances),
      });

      const result = await fetchFungibleTokens(testAddress, "testnet");

      expect(result).not.toBeNull();
      expect(Object.keys(result!)).toHaveLength(0);
    });

    it("should return null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchFungibleTokens(testAddress, "testnet");

      expect(result).toBeNull();
    });

    it("should return null on non-ok response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await fetchFungibleTokens(testAddress, "testnet");

      expect(result).toBeNull();
    });
  });

  describe("fetchAccountBalances", () => {
    const testAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";

    it("should return full balances on success", async () => {
      const mockBalances: AccountBalances = {
        stx: {
          balance: "5000000",
          total_sent: "1000000",
          total_received: "6000000",
          lock_height: 0,
          lock_tx_id: "",
          locked: "0",
        },
        fungible_tokens: {},
        non_fungible_tokens: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBalances),
      });

      const result = await fetchAccountBalances(testAddress, "testnet");

      expect(result).not.toBeNull();
      expect(result!.stx.balance).toBe("5000000");
    });

    it("should return null on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Failed to fetch"));

      const result = await fetchAccountBalances(testAddress, "testnet");

      expect(result).toBeNull();
    });
  });

  describe("fetchStxBalance", () => {
    const testAddress = "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG";

    it("should return STX balance on success", async () => {
      const mockBalances: AccountBalances = {
        stx: {
          balance: "10000000",
          total_sent: "0",
          total_received: "10000000",
          lock_height: 0,
          lock_tx_id: "",
          locked: "0",
        },
        fungible_tokens: {},
        non_fungible_tokens: {},
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockBalances),
      });

      const result = await fetchStxBalance(testAddress, "testnet");

      expect(result).toBe("10000000");
    });

    it("should return null on error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await fetchStxBalance(testAddress, "testnet");

      expect(result).toBeNull();
    });
  });

  describe("microStxToStx", () => {
    it("should convert 1,000,000 microSTX to 1 STX", () => {
      expect(microStxToStx("1000000")).toBe(1);
    });

    it("should convert 500,000 microSTX to 0.5 STX", () => {
      expect(microStxToStx("500000")).toBe(0.5);
    });

    it("should handle number input", () => {
      expect(microStxToStx(1500000)).toBe(1.5);
    });

    it("should handle zero", () => {
      expect(microStxToStx("0")).toBe(0);
    });

    it("should handle large values", () => {
      expect(microStxToStx("1000000000000")).toBe(1000000);
    });
  });

  describe("formatStxBalance", () => {
    it("should format zero as '0'", () => {
      expect(formatStxBalance("0")).toBe("0");
    });

    it("should format small balances with decimals", () => {
      expect(formatStxBalance("123456")).toBe("0.123456");
    });

    it("should remove trailing zeros", () => {
      expect(formatStxBalance("1500000")).toBe("1.5");
    });

    it("should format thousands with K suffix", () => {
      expect(formatStxBalance("5500000000")).toBe("5.50K");
    });

    it("should format millions with M suffix", () => {
      expect(formatStxBalance("2500000000000")).toBe("2.50M");
    });

    it("should handle exact values", () => {
      expect(formatStxBalance("1000000")).toBe("1");
    });
  });

  describe("formatUsdValue", () => {
    it("should format small values with $", () => {
      expect(formatUsdValue(10.5)).toBe("$10.50");
    });

    it("should format thousands with K suffix", () => {
      expect(formatUsdValue(5500)).toBe("$5.50K");
    });

    it("should format millions with M suffix", () => {
      expect(formatUsdValue(2500000)).toBe("$2.50M");
    });

    it("should format zero", () => {
      expect(formatUsdValue(0)).toBe("$0.00");
    });
  });
});
