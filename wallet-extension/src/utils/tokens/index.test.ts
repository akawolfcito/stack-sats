import { describe, it, expect, beforeEach } from "vitest";
import {
  parseTokenContractId,
  extractContractName,
  formatTokenBalance,
  buildTokenInfo,
  clearTokenMetadataCache,
  type FungibleTokenBalance,
  type TokenMetadata,
} from "./index";

describe("Tokens Module", () => {
  beforeEach(() => {
    clearTokenMetadataCache();
  });

  describe("parseTokenContractId", () => {
    it("parses full contract ID with token name", () => {
      const result = parseTokenContractId(
        "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token::fari"
      );
      expect(result.address).toBe("SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token");
      expect(result.tokenName).toBe("fari");
    });

    it("handles contract ID without token name", () => {
      const result = parseTokenContractId(
        "SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token"
      );
      expect(result.address).toBe("SP32XCD69XPS3GKDEXAQ29PJRDSD5AR643GNEEBXZ.fari-token");
      expect(result.tokenName).toBe("");
    });

    it("handles empty string", () => {
      const result = parseTokenContractId("");
      expect(result.address).toBe("");
      expect(result.tokenName).toBe("");
    });

    it("handles multiple :: separators", () => {
      const result = parseTokenContractId("contract.name::token::extra");
      expect(result.address).toBe("contract.name");
      expect(result.tokenName).toBe("token");
    });
  });

  describe("extractContractName", () => {
    it("extracts contract name from full address", () => {
      expect(extractContractName("SP123.my-token")).toBe("my-token");
    });

    it("handles address without dot", () => {
      expect(extractContractName("SP123")).toBe("SP123");
    });

    it("handles empty string", () => {
      expect(extractContractName("")).toBe("");
    });

    it("handles multiple dots", () => {
      expect(extractContractName("SP123.my.token")).toBe("my");
    });
  });

  describe("formatTokenBalance", () => {
    it("formats balance with 6 decimals", () => {
      expect(formatTokenBalance("1000000", 6)).toBe("1");
      expect(formatTokenBalance("1500000", 6)).toBe("1.5");
      expect(formatTokenBalance("1234567", 6)).toBe("1.234567");
    });

    it("formats balance with 8 decimals", () => {
      expect(formatTokenBalance("100000000", 8)).toBe("1");
      expect(formatTokenBalance("150000000", 8)).toBe("1.5");
      expect(formatTokenBalance("12345678", 8)).toBe("0.12345678");
    });

    it("formats balance with 0 decimals", () => {
      expect(formatTokenBalance("100", 0)).toBe("100");
      expect(formatTokenBalance("1000", 0)).toBe("1,000");
    });

    it("handles zero balance", () => {
      expect(formatTokenBalance("0", 6)).toBe("0");
      expect(formatTokenBalance("", 6)).toBe("0");
    });

    it("removes trailing zeros", () => {
      expect(formatTokenBalance("1000000", 6)).toBe("1");
      expect(formatTokenBalance("1100000", 6)).toBe("1.1");
      expect(formatTokenBalance("1010000", 6)).toBe("1.01");
    });

    it("adds thousand separators", () => {
      expect(formatTokenBalance("1000000000000", 6)).toBe("1,000,000");
      expect(formatTokenBalance("1234567890000", 6)).toBe("1,234,567.89");
    });

    it("handles large numbers", () => {
      expect(formatTokenBalance("1000000000000000000", 6)).toBe("1,000,000,000,000");
    });

    it("handles small fractional amounts", () => {
      expect(formatTokenBalance("1", 6)).toBe("0.000001");
      expect(formatTokenBalance("10", 6)).toBe("0.00001");
      expect(formatTokenBalance("100", 6)).toBe("0.0001");
    });
  });

  describe("buildTokenInfo", () => {
    const mockBalance: FungibleTokenBalance = {
      balance: "1500000",
      total_sent: "0",
      total_received: "1500000",
    };

    const mockMetadata: TokenMetadata = {
      name: "Test Token",
      symbol: "TEST",
      decimals: 6,
      image_uri: "https://example.com/icon.png",
    };

    it("builds token info with metadata", () => {
      const result = buildTokenInfo(
        "SP123.test-token::test",
        mockBalance,
        mockMetadata
      );

      expect(result.contractId).toBe("SP123.test-token::test");
      expect(result.name).toBe("Test Token");
      expect(result.symbol).toBe("TEST");
      expect(result.decimals).toBe(6);
      expect(result.balance).toBe("1500000");
      expect(result.formattedBalance).toBe("1.5");
      expect(result.imageUri).toBe("https://example.com/icon.png");
    });

    it("uses fallback values when metadata is null", () => {
      const result = buildTokenInfo(
        "SP123.test-token::test",
        mockBalance,
        null
      );

      expect(result.name).toBe("test-token");
      expect(result.symbol).toBe("test");
      expect(result.decimals).toBe(6); // Default
      expect(result.imageUri).toBeUndefined();
    });

    it("uses contract name when token name is empty", () => {
      const result = buildTokenInfo(
        "SP123.my-contract",
        mockBalance,
        null
      );

      expect(result.symbol).toBe("my-contract");
    });

    it("uses thumbnail image as fallback", () => {
      const metadataWithThumbnail: TokenMetadata = {
        name: "Test",
        symbol: "T",
        decimals: 6,
        image_thumbnail_uri: "https://example.com/thumb.png",
      };

      const result = buildTokenInfo(
        "SP123.test::t",
        mockBalance,
        metadataWithThumbnail
      );

      expect(result.imageUri).toBe("https://example.com/thumb.png");
    });

    it("handles different decimal places", () => {
      const metadata8Decimals: TokenMetadata = {
        name: "BTC Token",
        symbol: "BTC",
        decimals: 8,
      };

      const result = buildTokenInfo(
        "SP123.btc::btc",
        { balance: "100000000", total_sent: "0", total_received: "100000000" },
        metadata8Decimals
      );

      expect(result.formattedBalance).toBe("1");
    });
  });
});
