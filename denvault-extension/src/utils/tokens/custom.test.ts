/**
 * Unit tests for tokens/custom.ts
 *
 * Tests custom token management: add, remove, lookup, enable/disable,
 * and storage persistence via localStorage mock from setup.ts.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Import module under test ---

import {
  getTokenKey,
  generateTokenColor,
  getCustomTokens,
  getCustomTokensForNetwork,
  saveCustomTokens,
  addCustomToken,
  removeCustomToken,
  getCustomTokenByKey,
  getEnabledTokens,
  saveEnabledTokens,
  enableToken,
  disableToken,
  isTokenEnabled,
  toggleToken,
  type CustomToken,
} from "./custom";

// --- Test data ---

const SAMPLE_TOKEN_INPUT = {
  chainId: "mainnet" as const,
  contractId: "SP123.my-token",
  name: "My Token",
  symbol: "MTK",
  decimals: 6,
};

const SAMPLE_TOKEN_INPUT_2 = {
  chainId: "testnet" as const,
  contractId: "ST456.test-token",
  name: "Test Token",
  symbol: "TST",
  decimals: 8,
};

function makeSampleToken(overrides?: Partial<CustomToken>): CustomToken {
  return {
    type: "sip10",
    chainId: "mainnet",
    contractId: "SP123.my-token",
    name: "My Token",
    symbol: "MTK",
    decimals: 6,
    color: "#7c3aed",
    addedAt: 1700000000000,
    ...overrides,
  };
}

// --- Tests ---

describe("tokens/custom", () => {
  describe("getTokenKey", () => {
    it("should generate key in chainId:contractId format", () => {
      expect(getTokenKey("mainnet", "SP123.token")).toBe("mainnet:SP123.token");
    });

    it("should generate different keys for different networks", () => {
      const mainnet = getTokenKey("mainnet", "SP123.token");
      const testnet = getTokenKey("testnet", "SP123.token");
      expect(mainnet).not.toBe(testnet);
    });

    it("should generate different keys for different contracts", () => {
      const a = getTokenKey("mainnet", "SP123.token-a");
      const b = getTokenKey("mainnet", "SP123.token-b");
      expect(a).not.toBe(b);
    });
  });

  describe("generateTokenColor", () => {
    it("should return a hex color string", () => {
      const color = generateTokenColor();
      expect(color).toMatch(/^#[0-9a-f]{6}$/i);
    });

    it("should return one of the predefined colors", () => {
      const validColors = [
        "#7c3aed", "#f97316", "#eab308", "#3b82f6",
        "#22c55e", "#ec4899", "#06b6d4", "#f7931a",
        "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
      ];
      const color = generateTokenColor();
      expect(validColors).toContain(color);
    });
  });

  describe("getCustomTokens", () => {
    it("should return empty array when no tokens stored", () => {
      expect(getCustomTokens()).toEqual([]);
    });

    it("should return stored tokens", () => {
      const tokens = [makeSampleToken()];
      localStorage.setItem("custom_tokens", JSON.stringify(tokens));
      expect(getCustomTokens()).toEqual(tokens);
    });

    it("should return empty array for invalid JSON", () => {
      localStorage.setItem("custom_tokens", "not-json{{{");
      expect(getCustomTokens()).toEqual([]);
    });
  });

  describe("getCustomTokensForNetwork", () => {
    it("should filter tokens by network", () => {
      const tokens = [
        makeSampleToken({ chainId: "mainnet", contractId: "SP1.a" }),
        makeSampleToken({ chainId: "testnet", contractId: "ST2.b" }),
        makeSampleToken({ chainId: "mainnet", contractId: "SP3.c" }),
      ];
      localStorage.setItem("custom_tokens", JSON.stringify(tokens));

      const mainnetTokens = getCustomTokensForNetwork("mainnet");
      expect(mainnetTokens).toHaveLength(2);
      expect(mainnetTokens.every((t) => t.chainId === "mainnet")).toBe(true);
    });

    it("should return empty array when no tokens match network", () => {
      const tokens = [makeSampleToken({ chainId: "mainnet" })];
      localStorage.setItem("custom_tokens", JSON.stringify(tokens));

      expect(getCustomTokensForNetwork("testnet")).toEqual([]);
    });
  });

  describe("saveCustomTokens", () => {
    it("should persist tokens to localStorage", () => {
      const tokens = [makeSampleToken()];
      saveCustomTokens(tokens);
      const stored = JSON.parse(localStorage.getItem("custom_tokens")!);
      expect(stored).toEqual(tokens);
    });

    it("should overwrite existing tokens", () => {
      saveCustomTokens([makeSampleToken()]);
      saveCustomTokens([]);
      expect(getCustomTokens()).toEqual([]);
    });
  });

  describe("addCustomToken", () => {
    it("should add a new token and return it", () => {
      const result = addCustomToken(SAMPLE_TOKEN_INPUT);
      expect(result).not.toBeNull();
      expect(result!.type).toBe("sip10");
      expect(result!.name).toBe("My Token");
      expect(result!.symbol).toBe("MTK");
      expect(result!.decimals).toBe(6);
      expect(result!.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(result!.addedAt).toBeGreaterThan(0);
    });

    it("should persist the added token in storage", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      const tokens = getCustomTokens();
      expect(tokens).toHaveLength(1);
      expect(tokens[0].contractId).toBe("SP123.my-token");
    });

    it("should return null if token already exists", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      const duplicate = addCustomToken(SAMPLE_TOKEN_INPUT);
      expect(duplicate).toBeNull();
    });

    it("should not add duplicate to storage", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      addCustomToken(SAMPLE_TOKEN_INPUT);
      expect(getCustomTokens()).toHaveLength(1);
    });

    it("should allow same contract on different networks", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      const input2 = { ...SAMPLE_TOKEN_INPUT, chainId: "testnet" as const };
      const result = addCustomToken(input2);
      expect(result).not.toBeNull();
      expect(getCustomTokens()).toHaveLength(2);
    });

    it("should auto-enable the token after adding", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      expect(isTokenEnabled("SP123.my-token")).toBe(true);
    });

    it("should add multiple different tokens", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      addCustomToken(SAMPLE_TOKEN_INPUT_2);
      expect(getCustomTokens()).toHaveLength(2);
    });
  });

  describe("removeCustomToken", () => {
    beforeEach(() => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
    });

    it("should remove an existing token and return true", () => {
      const result = removeCustomToken("mainnet", "SP123.my-token");
      expect(result).toBe(true);
      expect(getCustomTokens()).toHaveLength(0);
    });

    it("should return false when token does not exist", () => {
      const result = removeCustomToken("mainnet", "SP999.nonexistent");
      expect(result).toBe(false);
    });

    it("should return false for wrong network", () => {
      const result = removeCustomToken("testnet", "SP123.my-token");
      expect(result).toBe(false);
    });

    it("should disable the token after removing", () => {
      removeCustomToken("mainnet", "SP123.my-token");
      expect(isTokenEnabled("SP123.my-token")).toBe(false);
    });

    it("should not affect other tokens", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT_2);
      removeCustomToken("mainnet", "SP123.my-token");
      expect(getCustomTokens()).toHaveLength(1);
      expect(getCustomTokens()[0].contractId).toBe("ST456.test-token");
    });
  });

  describe("getCustomTokenByKey", () => {
    it("should return token when found", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      const token = getCustomTokenByKey("mainnet", "SP123.my-token");
      expect(token).not.toBeNull();
      expect(token!.name).toBe("My Token");
    });

    it("should return null when not found", () => {
      expect(getCustomTokenByKey("mainnet", "SP999.nope")).toBeNull();
    });

    it("should return null for wrong network", () => {
      addCustomToken(SAMPLE_TOKEN_INPUT);
      expect(getCustomTokenByKey("testnet", "SP123.my-token")).toBeNull();
    });
  });

  describe("getEnabledTokens", () => {
    it("should return Set with STX by default", () => {
      const enabled = getEnabledTokens();
      expect(enabled).toBeInstanceOf(Set);
      expect(enabled.has("STX")).toBe(true);
    });

    it("should return stored enabled tokens", () => {
      localStorage.setItem("enabled_tokens", JSON.stringify(["STX", "SP123.token"]));
      const enabled = getEnabledTokens();
      expect(enabled.has("STX")).toBe(true);
      expect(enabled.has("SP123.token")).toBe(true);
    });

    it("should return default Set on invalid JSON", () => {
      localStorage.setItem("enabled_tokens", "bad-json");
      const enabled = getEnabledTokens();
      expect(enabled.has("STX")).toBe(true);
    });
  });

  describe("saveEnabledTokens", () => {
    it("should persist enabled tokens to localStorage", () => {
      const tokens = new Set(["STX", "SP123.token"]);
      saveEnabledTokens(tokens);
      const stored = JSON.parse(localStorage.getItem("enabled_tokens")!);
      expect(stored).toContain("STX");
      expect(stored).toContain("SP123.token");
    });
  });

  describe("enableToken", () => {
    it("should add token to enabled set", () => {
      enableToken("SP123.my-token");
      expect(isTokenEnabled("SP123.my-token")).toBe(true);
    });

    it("should not duplicate if already enabled", () => {
      enableToken("SP123.my-token");
      enableToken("SP123.my-token");
      const stored = JSON.parse(localStorage.getItem("enabled_tokens")!);
      const count = stored.filter((t: string) => t === "SP123.my-token").length;
      expect(count).toBe(1);
    });

    it("should preserve STX in enabled set", () => {
      enableToken("SP123.my-token");
      expect(isTokenEnabled("STX")).toBe(true);
    });
  });

  describe("disableToken", () => {
    it("should remove token from enabled set", () => {
      enableToken("SP123.my-token");
      disableToken("SP123.my-token");
      expect(isTokenEnabled("SP123.my-token")).toBe(false);
    });

    it("should be safe to disable non-existent token", () => {
      expect(() => disableToken("SP999.nope")).not.toThrow();
    });

    it("should not affect other enabled tokens", () => {
      enableToken("SP123.a");
      enableToken("SP456.b");
      disableToken("SP123.a");
      expect(isTokenEnabled("SP456.b")).toBe(true);
    });
  });

  describe("isTokenEnabled", () => {
    it("should return true for STX by default", () => {
      expect(isTokenEnabled("STX")).toBe(true);
    });

    it("should return false for unknown token", () => {
      expect(isTokenEnabled("SP999.unknown")).toBe(false);
    });

    it("should return true after enabling", () => {
      enableToken("SP123.token");
      expect(isTokenEnabled("SP123.token")).toBe(true);
    });
  });

  describe("toggleToken", () => {
    it("should enable token when true", () => {
      toggleToken("SP123.token", true);
      expect(isTokenEnabled("SP123.token")).toBe(true);
    });

    it("should disable token when false", () => {
      enableToken("SP123.token");
      toggleToken("SP123.token", false);
      expect(isTokenEnabled("SP123.token")).toBe(false);
    });

    it("should toggle on then off", () => {
      toggleToken("SP123.token", true);
      expect(isTokenEnabled("SP123.token")).toBe(true);
      toggleToken("SP123.token", false);
      expect(isTokenEnabled("SP123.token")).toBe(false);
    });
  });
});
