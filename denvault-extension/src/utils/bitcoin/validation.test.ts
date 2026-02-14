/**
 * Tests for Bitcoin address validation utilities
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  validateBtcAddress,
  isValidBtcAddress,
  detectAddressType,
  validateTaprootNetworkPrefix,
} from "./validation";

describe("Bitcoin validation utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("validateTaprootNetworkPrefix", () => {
    // Mainnet Taproot addresses start with bc1p
    const MAINNET_TAPROOT = "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr";
    // Testnet Taproot addresses start with tb1p
    const TESTNET_TAPROOT = "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq8s5pku";

    describe("mainnet validation", () => {
      it("should accept bc1p prefix on mainnet", () => {
        const result = validateTaprootNetworkPrefix(MAINNET_TAPROOT, "mainnet");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should reject tb1p prefix on mainnet", () => {
        const result = validateTaprootNetworkPrefix(TESTNET_TAPROOT, "mainnet");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("testnet prefix");
        expect(result.error).toContain("mainnet");
      });

      it("should reject non-taproot addresses on mainnet", () => {
        const result = validateTaprootNetworkPrefix("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "mainnet");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("bc1p prefix");
      });
    });

    describe("testnet validation", () => {
      it("should accept tb1p prefix on testnet", () => {
        const result = validateTaprootNetworkPrefix(TESTNET_TAPROOT, "testnet");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should reject bc1p prefix on testnet", () => {
        const result = validateTaprootNetworkPrefix(MAINNET_TAPROOT, "testnet");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("mainnet prefix");
        expect(result.error).toContain("testnet");
      });
    });

    describe("devnet validation (uses testnet)", () => {
      it("should accept tb1p prefix on devnet", () => {
        const result = validateTaprootNetworkPrefix(TESTNET_TAPROOT, "devnet");
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      });

      it("should reject bc1p prefix on devnet", () => {
        const result = validateTaprootNetworkPrefix(MAINNET_TAPROOT, "devnet");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("mainnet prefix");
        expect(result.error).toContain("devnet");
      });
    });

    describe("edge cases", () => {
      it("should reject empty address", () => {
        const result = validateTaprootNetworkPrefix("", "mainnet");
        expect(result.valid).toBe(false);
        expect(result.error).toContain("required");
      });

      it("should handle case insensitivity", () => {
        const upperCase = "BC1P5CYXNUXMEUWUVKWFEM96LQZSZD02N6XDCJRS20CAC6YQJJWUDPXQKEDRCR";
        const result = validateTaprootNetworkPrefix(upperCase, "mainnet");
        expect(result.valid).toBe(true);
      });

      it("should handle whitespace", () => {
        const result = validateTaprootNetworkPrefix(`  ${MAINNET_TAPROOT}  `, "mainnet");
        expect(result.valid).toBe(true);
      });

      it("should use selected network when no network provided", () => {
        localStorage.setItem("selected_network", "mainnet");
        const result = validateTaprootNetworkPrefix(MAINNET_TAPROOT);
        expect(result.valid).toBe(true);
      });

      it("should default to devnet (testnet) when no network stored", () => {
        // devnet is default, which uses testnet prefixes
        const result = validateTaprootNetworkPrefix(TESTNET_TAPROOT);
        expect(result.valid).toBe(true);
      });
    });
  });

  describe("detectAddressType", () => {
    describe("mainnet addresses", () => {
      it("should detect P2TR (Taproot) address", () => {
        expect(detectAddressType("bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr", "mainnet")).toBe("p2tr");
      });

      it("should detect P2WPKH (SegWit) address", () => {
        expect(detectAddressType("bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq", "mainnet")).toBe("p2wpkh");
      });

      it("should detect P2PKH (Legacy) address", () => {
        expect(detectAddressType("1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2", "mainnet")).toBe("p2pkh");
      });

      it("should detect P2SH address", () => {
        expect(detectAddressType("3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy", "mainnet")).toBe("p2sh");
      });
    });

    describe("testnet addresses", () => {
      it("should detect P2TR (Taproot) address", () => {
        expect(detectAddressType("tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq8s5pku", "testnet")).toBe("p2tr");
      });

      it("should detect P2WPKH (SegWit) address", () => {
        expect(detectAddressType("tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx", "testnet")).toBe("p2wpkh");
      });

      it("should detect P2PKH (Legacy) address", () => {
        expect(detectAddressType("mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn", "testnet")).toBe("p2pkh");
        expect(detectAddressType("n1wgm6Zj6Nkk4vpcgvJLDRwFhE2Eqym27w", "testnet")).toBe("p2pkh");
      });

      it("should detect P2SH address", () => {
        expect(detectAddressType("2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc", "testnet")).toBe("p2sh");
      });
    });
  });

  describe("validateBtcAddress", () => {
    it("should validate mainnet Taproot address", () => {
      const result = validateBtcAddress(
        "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
        "mainnet"
      );
      expect(result.valid).toBe(true);
      expect(result.addressType).toBe("p2tr");
    });

    it("should reject testnet address on mainnet", () => {
      const result = validateBtcAddress(
        "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq8s5pku",
        "mainnet"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("testnet");
    });

    it("should validate testnet Taproot address", () => {
      const result = validateBtcAddress(
        "tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq8s5pku",
        "testnet"
      );
      expect(result.valid).toBe(true);
      expect(result.addressType).toBe("p2tr");
    });

    it("should reject mainnet address on testnet", () => {
      const result = validateBtcAddress(
        "bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr",
        "testnet"
      );
      expect(result.valid).toBe(false);
      expect(result.error).toContain("mainnet");
    });
  });

  describe("isValidBtcAddress", () => {
    it("should return true for valid address", () => {
      expect(isValidBtcAddress("bc1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxqkedrcr", "mainnet")).toBe(true);
    });

    it("should return false for invalid address", () => {
      expect(isValidBtcAddress("invalid", "mainnet")).toBe(false);
    });

    it("should return false for wrong network", () => {
      expect(isValidBtcAddress("tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq8s5pku", "mainnet")).toBe(false);
    });
  });
});
