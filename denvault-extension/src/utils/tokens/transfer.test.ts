/**
 * Unit tests for tokens/transfer.ts
 *
 * Tests SIP-010 token transfer construction, amount formatting/parsing,
 * contract ID parsing, and error handling for various failure modes.
 *
 * Uses module-level mocks for @stacks/transactions and network config.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Module-level mocks (hoisted) ---

vi.mock("@stacks/transactions", () => ({
  makeContractCall: vi.fn(),
  broadcastTransaction: vi.fn(),
  uintCV: vi.fn((val: bigint) => ({ type: "uint", value: val })),
  standardPrincipalCV: vi.fn((val: string) => ({ type: "principal", value: val })),
  noneCV: vi.fn(() => ({ type: "none" })),
  someCV: vi.fn((val: unknown) => ({ type: "some", value: val })),
  bufferCV: vi.fn((val: Buffer) => ({ type: "buffer", value: val })),
  PostConditionMode: { Deny: 2, Allow: 1 },
  Pc: {
    principal: vi.fn(() => ({
      willSendLte: vi.fn(() => ({
        ft: vi.fn(() => "mock-post-condition"),
      })),
    })),
  },
}));

vi.mock("../network", () => ({
  getNetworkConfig: vi.fn(() => ({ chainId: 1, client: { baseUrl: "https://api.hiro.so" } })),
}));

vi.mock("../security/logger", () => ({
  secureLog: vi.fn(),
}));

// --- Import mocked modules ---

import { makeContractCall, broadcastTransaction } from "@stacks/transactions";

// --- Import module under test ---

import {
  parseContractId,
  transferToken,
  formatTokenAmount,
  parseTokenAmount,
  TOKEN_TRANSFER_FEE_MICRO_STX,
  type TokenTransferParams,
} from "./transfer";

// --- Test data ---

const BASE_PARAMS: TokenTransferParams = {
  contractId: "SP123ABC.my-token",
  recipient: "SP456DEF789GHI",
  amount: 1000000n,
  senderKey: "deadbeef1234567890abcdef",
  senderAddress: "SP123SENDER",
  network: "mainnet",
  decimals: 6,
  symbol: "TKN",
};

// --- Tests ---

describe("tokens/transfer", () => {
  describe("TOKEN_TRANSFER_FEE_MICRO_STX", () => {
    it("should be 10000 microSTX (0.01 STX)", () => {
      expect(TOKEN_TRANSFER_FEE_MICRO_STX).toBe(10000n);
    });
  });

  describe("parseContractId", () => {
    it("should parse simple contract ID (address.name)", () => {
      const result = parseContractId("SP123ABC.my-token");
      expect(result).toEqual({
        address: "SP123ABC",
        contractName: "my-token",
        assetName: undefined,
      });
    });

    it("should parse contract ID with asset name (address.name::asset)", () => {
      const result = parseContractId("SP123ABC.my-token::tkn");
      expect(result).toEqual({
        address: "SP123ABC",
        contractName: "my-token",
        assetName: "tkn",
      });
    });

    it("should return null when no dot separator exists", () => {
      expect(parseContractId("SP123ABC")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseContractId("")).toBeNull();
    });

    it("should return null when address is empty (starts with dot)", () => {
      expect(parseContractId(".my-token")).toBeNull();
    });

    it("should return null when contract name is empty (ends with dot)", () => {
      expect(parseContractId("SP123ABC.")).toBeNull();
    });

    it("should handle contract ID with multiple dots (takes first dot)", () => {
      const result = parseContractId("SP123.sub.contract::asset");
      expect(result).not.toBeNull();
      expect(result!.address).toBe("SP123");
      expect(result!.contractName).toBe("sub.contract");
      expect(result!.assetName).toBe("asset");
    });

    it("should handle real-world Stacks contract ID", () => {
      const result = parseContractId(
        "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token::fari"
      );
      expect(result).toEqual({
        address: "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ",
        contractName: "fari-token",
        assetName: "fari",
      });
    });
  });

  describe("transferToken", () => {
    beforeEach(() => {
      vi.mocked(makeContractCall).mockResolvedValue({ serialize: vi.fn() } as never);
      vi.mocked(broadcastTransaction).mockResolvedValue({ txid: "0xabc123" } as never);
    });

    it("should return success with txid on successful transfer", async () => {
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(true);
      expect(result.txid).toBe("0xabc123");
      expect(result.error).toBeUndefined();
    });

    it("should call makeContractCall with correct function name 'transfer'", async () => {
      await transferToken(BASE_PARAMS);
      expect(makeContractCall).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: "SP123ABC",
          contractName: "my-token",
          functionName: "transfer",
        })
      );
    });

    it("should set PostConditionMode.Deny for safety", async () => {
      await transferToken(BASE_PARAMS);
      expect(makeContractCall).toHaveBeenCalledWith(
        expect.objectContaining({
          postConditionMode: 2, // PostConditionMode.Deny
        })
      );
    });

    it("should use TOKEN_TRANSFER_FEE_MICRO_STX as fee", async () => {
      await transferToken(BASE_PARAMS);
      expect(makeContractCall).toHaveBeenCalledWith(
        expect.objectContaining({
          fee: TOKEN_TRANSFER_FEE_MICRO_STX,
        })
      );
    });

    it("should return error for invalid contract ID", async () => {
      const params = { ...BASE_PARAMS, contractId: "invalid-no-dot" };
      const result = await transferToken(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid contract ID format");
    });

    it("should handle memo parameter (sliced to 34 chars)", async () => {
      const params = { ...BASE_PARAMS, memo: "Payment for services" };
      const result = await transferToken(params);
      expect(result.success).toBe(true);
    });

    it("should handle missing memo (noneCV)", async () => {
      const params = { ...BASE_PARAMS, memo: undefined };
      const result = await transferToken(params);
      expect(result.success).toBe(true);
    });

    it("should handle NotEnoughFunds error with user-friendly message", async () => {
      vi.mocked(makeContractCall).mockRejectedValue(new Error("NotEnoughFunds"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient STX balance");
    });

    it("should handle BadNonce error", async () => {
      vi.mocked(makeContractCall).mockRejectedValue(new Error("BadNonce"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("nonce error");
    });

    it("should handle InvalidAddress error", async () => {
      vi.mocked(makeContractCall).mockRejectedValue(new Error("InvalidAddress"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid recipient address");
    });

    it("should handle Network/fetch error", async () => {
      vi.mocked(makeContractCall).mockRejectedValue(new Error("fetch failed"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should handle ECONNREFUSED error", async () => {
      vi.mocked(makeContractCall).mockRejectedValue(new Error("ECONNREFUSED"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("should handle broadcast rejection", async () => {
      vi.mocked(broadcastTransaction).mockRejectedValue(new Error("broadcast rejected"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("rejected by network");
    });

    it("should handle PostCondition failure", async () => {
      vi.mocked(makeContractCall).mockRejectedValue(new Error("PostCondition failed"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("post-condition check");
    });

    it("should handle non-Error thrown values", async () => {
      vi.mocked(makeContractCall).mockRejectedValue("string error");
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toBe("string error");
    });

    it("should handle insufficient error variant", async () => {
      vi.mocked(makeContractCall).mockRejectedValue(new Error("insufficient balance"));
      const result = await transferToken(BASE_PARAMS);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient STX balance");
    });

    it("should handle contract with asset name in post conditions", async () => {
      const params = {
        ...BASE_PARAMS,
        contractId: "SP123ABC.my-token::tkn",
      };
      const result = await transferToken(params);
      expect(result.success).toBe(true);
    });

    it("should work with testnet network", async () => {
      const params = { ...BASE_PARAMS, network: "testnet" as const };
      const result = await transferToken(params);
      expect(result.success).toBe(true);
    });
  });

  describe("formatTokenAmount", () => {
    it("should format amount with 0 decimals", () => {
      expect(formatTokenAmount(100n, 0)).toBe("100");
    });

    it("should format whole number with 6 decimals", () => {
      expect(formatTokenAmount(1000000n, 6)).toBe("1");
    });

    it("should format fractional amount with 6 decimals", () => {
      expect(formatTokenAmount(1500000n, 6)).toBe("1.5");
    });

    it("should format amount with trailing zeros removed", () => {
      expect(formatTokenAmount(1100000n, 6)).toBe("1.1");
    });

    it("should format zero amount", () => {
      expect(formatTokenAmount(0n, 6)).toBe("0");
    });

    it("should format sub-unit amount (less than 1 whole token)", () => {
      expect(formatTokenAmount(500000n, 6)).toBe("0.5");
    });

    it("should format smallest unit", () => {
      expect(formatTokenAmount(1n, 6)).toBe("0.000001");
    });

    it("should format with 8 decimals (like BTC)", () => {
      expect(formatTokenAmount(100000000n, 8)).toBe("1");
      expect(formatTokenAmount(50000000n, 8)).toBe("0.5");
    });

    it("should handle large amounts", () => {
      expect(formatTokenAmount(1000000000000n, 6)).toBe("1000000");
    });

    it("should preserve full precision", () => {
      expect(formatTokenAmount(1234567n, 6)).toBe("1.234567");
    });
  });

  describe("parseTokenAmount", () => {
    it("should parse whole number", () => {
      expect(parseTokenAmount("1", 6)).toBe(1000000n);
    });

    it("should parse decimal number", () => {
      expect(parseTokenAmount("1.5", 6)).toBe(1500000n);
    });

    it("should parse amount with full decimal precision", () => {
      expect(parseTokenAmount("1.234567", 6)).toBe(1234567n);
    });

    it("should pad missing decimal places", () => {
      expect(parseTokenAmount("1.1", 6)).toBe(1100000n);
    });

    it("should truncate excess decimal places", () => {
      expect(parseTokenAmount("1.1234567890", 6)).toBe(1123456n);
    });

    it("should return 0n for empty string", () => {
      expect(parseTokenAmount("", 6)).toBe(0n);
    });

    it("should return 0n for whitespace-only string", () => {
      expect(parseTokenAmount("   ", 6)).toBe(0n);
    });

    it("should parse zero", () => {
      expect(parseTokenAmount("0", 6)).toBe(0n);
    });

    it("should parse with 0 decimals", () => {
      expect(parseTokenAmount("100", 0)).toBe(100n);
    });

    it("should parse with 8 decimals", () => {
      expect(parseTokenAmount("1", 8)).toBe(100000000n);
    });

    it("should handle amount without decimal part", () => {
      expect(parseTokenAmount("42", 6)).toBe(42000000n);
    });
  });
});
