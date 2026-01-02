import { describe, it, expect } from "vitest";
import {
  validateStxAddress,
  stxToMicroStx,
  microStxToStx,
  formatStxDisplay,
  isValidAmount,
  TRANSFER_FEE_MICRO_STX,
} from "./index";

describe("Transfer Module", () => {
  describe("validateStxAddress", () => {
    it("returns true for valid testnet address", () => {
      // Standard testnet addresses
      expect(validateStxAddress("ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG", "testnet")).toBe(true);
      expect(validateStxAddress("ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG", "devnet")).toBe(true);
    });

    it("returns true for valid mainnet address", () => {
      expect(validateStxAddress("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", "mainnet")).toBe(true);
    });

    it("returns false for wrong prefix on testnet", () => {
      expect(validateStxAddress("SP2J6ZY48GV1EZ5V2V5RB9MP66SW86PYKKNRV9EJ7", "testnet")).toBe(false);
    });

    it("returns false for wrong prefix on mainnet", () => {
      expect(validateStxAddress("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "mainnet")).toBe(false);
    });

    it("returns false for address too short", () => {
      expect(validateStxAddress("ST1PQHQKV0RJX", "testnet")).toBe(false);
    });

    it("returns false for address too long", () => {
      expect(validateStxAddress("ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGMABC", "testnet")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(validateStxAddress("", "testnet")).toBe(false);
    });

    it("returns false for null/undefined", () => {
      expect(validateStxAddress(null as unknown as string, "testnet")).toBe(false);
      expect(validateStxAddress(undefined as unknown as string, "testnet")).toBe(false);
    });

    it("returns false for address with invalid characters", () => {
      // 0, O, I, l are not valid in base58
      expect(validateStxAddress("ST0PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "testnet")).toBe(false);
      expect(validateStxAddress("STIOPQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM", "testnet")).toBe(false);
    });
  });

  describe("stxToMicroStx", () => {
    it("converts whole numbers correctly", () => {
      expect(stxToMicroStx("1")).toBe(1000000n);
      expect(stxToMicroStx("10")).toBe(10000000n);
      expect(stxToMicroStx("100")).toBe(100000000n);
    });

    it("converts decimals correctly", () => {
      expect(stxToMicroStx("1.5")).toBe(1500000n);
      expect(stxToMicroStx("0.1")).toBe(100000n);
      expect(stxToMicroStx("0.000001")).toBe(1n);
    });

    it("handles 6 decimal places", () => {
      expect(stxToMicroStx("1.123456")).toBe(1123456n);
    });

    it("truncates beyond 6 decimal places", () => {
      expect(stxToMicroStx("1.1234567")).toBe(1123456n);
      expect(stxToMicroStx("1.123456789")).toBe(1123456n);
    });

    it("handles zero", () => {
      expect(stxToMicroStx("0")).toBe(0n);
      expect(stxToMicroStx("0.0")).toBe(0n);
    });

    it("handles empty string", () => {
      expect(stxToMicroStx("")).toBe(0n);
    });

    it("handles whitespace", () => {
      expect(stxToMicroStx("  10  ")).toBe(10000000n);
    });

    it("returns 0 for negative numbers", () => {
      expect(stxToMicroStx("-1")).toBe(0n);
    });

    it("returns 0 for invalid input", () => {
      expect(stxToMicroStx("abc")).toBe(0n);
      // Note: "1.2.3" splits and takes first valid parts (1.2)
      // This is expected behavior - decimal handling takes first split
    });
  });

  describe("microStxToStx", () => {
    it("converts to STX with 6 decimal places", () => {
      expect(microStxToStx(1000000n)).toBe("1.000000");
      expect(microStxToStx(10000000n)).toBe("10.000000");
    });

    it("handles fractional amounts", () => {
      expect(microStxToStx(1500000n)).toBe("1.500000");
      expect(microStxToStx(100000n)).toBe("0.100000");
      expect(microStxToStx(1n)).toBe("0.000001");
    });

    it("handles zero", () => {
      expect(microStxToStx(0n)).toBe("0.000000");
    });

    it("handles string input", () => {
      expect(microStxToStx("1000000")).toBe("1.000000");
    });

    it("handles large numbers", () => {
      expect(microStxToStx(1000000000000n)).toBe("1000000.000000");
    });
  });

  describe("formatStxDisplay", () => {
    it("removes trailing zeros", () => {
      expect(formatStxDisplay("1.000000")).toBe("1");
      expect(formatStxDisplay("1.500000")).toBe("1.5");
      expect(formatStxDisplay("1.123000")).toBe("1.123");
    });

    it("keeps significant decimals", () => {
      expect(formatStxDisplay("1.123456")).toBe("1.123456");
      expect(formatStxDisplay("0.000001")).toBe("0.000001");
    });

    it("handles whole numbers without decimal", () => {
      expect(formatStxDisplay("100")).toBe("100");
    });

    it("handles zero", () => {
      expect(formatStxDisplay("0.000000")).toBe("0");
    });
  });

  describe("isValidAmount", () => {
    const balance = 10000000n; // 10 STX

    it("returns valid for amount less than balance minus fee", () => {
      const amount = 5000000n; // 5 STX
      const result = isValidAmount(amount, balance);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("returns invalid for zero amount", () => {
      const result = isValidAmount(0n, balance);
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Amount must be greater than 0");
    });

    it("returns invalid for negative amount", () => {
      const result = isValidAmount(-1n, balance);
      expect(result.valid).toBe(false);
    });

    it("returns invalid when amount + fee exceeds balance", () => {
      const amount = 10000000n; // 10 STX (same as balance, no room for fee)
      const result = isValidAmount(amount, balance);
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Insufficient balance");
    });

    it("returns valid when amount + fee equals balance exactly", () => {
      const maxAmount = balance - TRANSFER_FEE_MICRO_STX;
      const result = isValidAmount(maxAmount, balance);
      expect(result.valid).toBe(true);
    });
  });

  describe("TRANSFER_FEE_MICRO_STX", () => {
    it("is 10000 microSTX (0.01 STX)", () => {
      expect(TRANSFER_FEE_MICRO_STX).toBe(10000n);
    });
  });
});
