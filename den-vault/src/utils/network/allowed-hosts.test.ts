import { describe, it, expect } from "vitest";
import { isAllowedApiHost } from "./allowed-hosts";

describe("isAllowedApiHost", () => {
  describe("known Stacks API hosts", () => {
    it("should allow api.hiro.so", () => {
      expect(isAllowedApiHost("https://api.hiro.so")).toBe(true);
    });

    it("should allow api.testnet.hiro.so", () => {
      expect(isAllowedApiHost("https://api.testnet.hiro.so")).toBe(true);
    });

    it("should allow api.platform.hiro.so", () => {
      expect(isAllowedApiHost("https://api.platform.hiro.so")).toBe(true);
    });

    it("should allow known hosts with paths", () => {
      expect(isAllowedApiHost("https://api.hiro.so/v2/info")).toBe(true);
      expect(isAllowedApiHost("https://api.testnet.hiro.so/extended/v1/tx")).toBe(true);
      expect(isAllowedApiHost("https://api.platform.hiro.so/v2/accounts/SP123")).toBe(true);
    });
  });

  describe("localhost and 127.0.0.1", () => {
    it("should allow localhost without port", () => {
      expect(isAllowedApiHost("http://localhost")).toBe(true);
    });

    it("should allow localhost with port", () => {
      expect(isAllowedApiHost("http://localhost:3999")).toBe(true);
    });

    it("should allow localhost with path", () => {
      expect(isAllowedApiHost("http://localhost:3999/v2/info")).toBe(true);
    });

    it("should allow 127.0.0.1 without port", () => {
      expect(isAllowedApiHost("http://127.0.0.1")).toBe(true);
    });

    it("should allow 127.0.0.1 with port", () => {
      expect(isAllowedApiHost("http://127.0.0.1:3999")).toBe(true);
    });

    it("should allow 127.0.0.1 with path", () => {
      expect(isAllowedApiHost("http://127.0.0.1:20443/v2/info")).toBe(true);
    });
  });

  describe("rejected URLs", () => {
    it("should reject arbitrary URLs", () => {
      expect(isAllowedApiHost("https://evil.com")).toBe(false);
    });

    it("should reject subdomain spoofing (api.hiro.so.evil.com)", () => {
      expect(isAllowedApiHost("https://api.hiro.so.evil.com")).toBe(false);
    });

    it("should reject non-https for known hosts (http://api.hiro.so)", () => {
      expect(isAllowedApiHost("http://api.hiro.so")).toBe(false);
    });

    it("should reject invalid URLs", () => {
      expect(isAllowedApiHost("not-a-url")).toBe(false);
    });

    it("should reject empty string", () => {
      expect(isAllowedApiHost("")).toBe(false);
    });
  });
});
