/**
 * Supplementary transfer module tests — covers uncovered branches
 *
 * Targets: transferStx error paths (lines 84-94, 113),
 * validateStxAddressWithError detailed messages,
 * parseStxAmount edge cases, microStxToStx negative
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  transferStx,
  validateStxAddressWithError,
  parseStxAmount,
  microStxToStx,
  formatStxDisplay,
} from "./index";

// Mock @stacks/transactions
vi.mock("@stacks/transactions", () => ({
  makeSTXTokenTransfer: vi.fn(),
  broadcastTransaction: vi.fn(),
}));

// Mock network
vi.mock("../network", () => ({
  getNetworkConfig: vi.fn(() => ({})),
  NETWORKS: {
    mainnet: { addressPrefix: "SP" },
    testnet: { addressPrefix: "ST" },
    devnet: { addressPrefix: "ST" },
  },
}));

// Mock logger
vi.mock("../security/logger", () => ({
  secureLog: vi.fn(),
}));

describe("Transfer (coverage supplement)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("transferStx — error message classification", () => {
    it("detects NotEnoughFunds errors", async () => {
      const { makeSTXTokenTransfer } = await import("@stacks/transactions");
      vi.mocked(makeSTXTokenTransfer).mockRejectedValue(
        new Error("NotEnoughFunds: balance too low")
      );

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient funds");
    });

    it("detects BadNonce errors", async () => {
      const { makeSTXTokenTransfer } = await import("@stacks/transactions");
      vi.mocked(makeSTXTokenTransfer).mockRejectedValue(
        new Error("BadNonce: expected 5, got 3")
      );

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("nonce error");
    });

    it("detects InvalidAddress errors", async () => {
      const { makeSTXTokenTransfer } = await import("@stacks/transactions");
      vi.mocked(makeSTXTokenTransfer).mockRejectedValue(
        new Error("InvalidAddress: bad format")
      );

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid recipient address");
    });

    it("detects Network/fetch errors", async () => {
      const { makeSTXTokenTransfer } = await import("@stacks/transactions");
      vi.mocked(makeSTXTokenTransfer).mockRejectedValue(
        new Error("fetch failed: ECONNREFUSED")
      );

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Network error");
    });

    it("detects broadcast/rejected errors", async () => {
      const { makeSTXTokenTransfer, broadcastTransaction } = await import(
        "@stacks/transactions"
      );
      vi.mocked(makeSTXTokenTransfer).mockResolvedValue({} as never);
      vi.mocked(broadcastTransaction).mockRejectedValue(
        new Error("Transaction rejected by node")
      );

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("rejected");
    });

    it("returns generic error for unknown errors", async () => {
      const { makeSTXTokenTransfer } = await import("@stacks/transactions");
      vi.mocked(makeSTXTokenTransfer).mockRejectedValue(
        new Error("Something unexpected")
      );

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Something unexpected");
    });

    it("handles non-Error thrown values", async () => {
      const { makeSTXTokenTransfer } = await import("@stacks/transactions");
      vi.mocked(makeSTXTokenTransfer).mockRejectedValue("string error");

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("string error");
    });

    it("successful transfer returns txid", async () => {
      const { makeSTXTokenTransfer, broadcastTransaction } = await import(
        "@stacks/transactions"
      );
      vi.mocked(makeSTXTokenTransfer).mockResolvedValue({} as never);
      vi.mocked(broadcastTransaction).mockResolvedValue({
        txid: "0x1234567890abcdef",
      } as never);

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        memo: "test memo",
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(true);
      expect(result.txid).toBe("0x1234567890abcdef");
    });

    it("detects insufficient balance errors", async () => {
      const { makeSTXTokenTransfer } = await import("@stacks/transactions");
      vi.mocked(makeSTXTokenTransfer).mockRejectedValue(
        new Error("insufficient balance for transfer")
      );

      const result = await transferStx({
        recipient: "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        amountMicroStx: 1000000n,
        senderKey: "a".repeat(64),
        network: "testnet",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient funds");
    });
  });

  describe("validateStxAddressWithError — detailed messages", () => {
    it("returns error for empty string after trim", () => {
      const result = validateStxAddressWithError("   ", "testnet");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("returns error for too short address", () => {
      const result = validateStxAddressWithError("ST1PQHQKV0RJX", "testnet");
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too short");
    });

    it("returns error for too long address", () => {
      const result = validateStxAddressWithError(
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGMABC",
        "testnet"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("too long");
    });

    it("returns error for wrong prefix on mainnet", () => {
      const result = validateStxAddressWithError(
        "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        "mainnet"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected "SP"');
    });

    it("returns error for wrong prefix on testnet", () => {
      const result = validateStxAddressWithError(
        "SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7",
        "testnet"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Expected "ST"');
    });

    it("returns error for invalid c32 characters", () => {
      // I is invalid in c32
      const result = validateStxAddressWithError(
        "STIPQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
        "testnet"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Invalid characters");
    });

    it("returns valid for correct address", () => {
      const result = validateStxAddressWithError(
        "ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG",
        "testnet"
      );
      expect(result.valid).toBe(true);
    });

    it("returns error for null address", () => {
      const result = validateStxAddressWithError(null as unknown as string, "testnet");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Address is required");
    });
  });

  describe("parseStxAmount — edge cases", () => {
    it("returns error for empty string", () => {
      const result = parseStxAmount("");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Amount is required");
    });

    it("returns error for negative amount", () => {
      const result = parseStxAmount("-5");
      expect(result.success).toBe(false);
      expect(result.error).toContain("negative");
    });

    it("returns error for multiple decimal points", () => {
      const result = parseStxAmount("1.2.3");
      expect(result.success).toBe(false);
      expect(result.error).toContain("multiple decimal points");
    });

    it("returns error for non-numeric whole part", () => {
      const result = parseStxAmount("abc");
      expect(result.success).toBe(false);
      expect(result.error).toContain("not a valid number");
    });

    it("returns error for non-numeric decimal part", () => {
      const result = parseStxAmount("1.abc");
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid decimal part");
    });

    it("handles more than 6 decimal places (truncates)", () => {
      const result = parseStxAmount("1.1234567");
      expect(result.success).toBe(true);
      expect(result.amount).toBe(1123456n);
    });

    it("handles whitespace-only string", () => {
      const result = parseStxAmount("   ");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Amount is required");
    });

    it("parses valid amount successfully", () => {
      const result = parseStxAmount("10.5");
      expect(result.success).toBe(true);
      expect(result.amount).toBe(10500000n);
    });
  });

  describe("microStxToStx — edge cases", () => {
    it("handles negative values", () => {
      expect(microStxToStx(-100n)).toBe("0.000000");
    });
  });

  describe("formatStxDisplay — edge cases", () => {
    it("handles string with all-zero decimal part via trimming", () => {
      expect(formatStxDisplay("5.000000")).toBe("5");
    });

    it("handles partial zero trimming", () => {
      expect(formatStxDisplay("3.100000")).toBe("3.1");
    });
  });
});
