/**
 * Tests for network utilities
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  NETWORKS,
  getSelectedNetwork,
  setSelectedNetwork,
  getNetworkConfig,
  getAddressVersion,
  buildNetworkWithClient,
  type NetworkName,
} from "./index";

describe("network utilities", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("NETWORKS constant", () => {
    it("should have mainnet configuration", () => {
      expect(NETWORKS.mainnet).toBeDefined();
      expect(NETWORKS.mainnet.name).toBe("Mainnet");
      expect(NETWORKS.mainnet.addressPrefix).toBe("SP");
      expect(NETWORKS.mainnet.explorerUrl).toBe("https://explorer.hiro.so");
    });

    it("should have testnet configuration", () => {
      expect(NETWORKS.testnet).toBeDefined();
      expect(NETWORKS.testnet.name).toBe("Testnet");
      expect(NETWORKS.testnet.addressPrefix).toBe("ST");
      expect(NETWORKS.testnet.explorerUrl).toBe("https://explorer.hiro.so");
    });

    it("should have devnet configuration", () => {
      expect(NETWORKS.devnet).toBeDefined();
      expect(NETWORKS.devnet.name).toBe("Devnet");
      expect(NETWORKS.devnet.addressPrefix).toBe("ST");
      expect(NETWORKS.devnet.explorerUrl).toBe("");
    });

    it("should have StacksNetwork config for each network", () => {
      expect(NETWORKS.mainnet.config).toBeDefined();
      expect(NETWORKS.testnet.config).toBeDefined();
      expect(NETWORKS.devnet.config).toBeDefined();
    });
  });

  describe("getSelectedNetwork", () => {
    /**
     * A fresh install has to land on a network that works.
     *
     * The default used to be devnet, which in a published build cannot
     * function at all: its API URL is built from VITE_PLATFORM_HIRO_API_KEY,
     * a compile-time variable, and without it getApiUrl falls back to testnet
     * while getNetworkConfig still points at localhost:3999. So the first
     * screen said "Devnet", read from testnet and would have written to a
     * node nobody was running.
     */
    it("should return mainnet as default when nothing stored", () => {
      expect(getSelectedNetwork()).toBe("mainnet");
    });

    it("should return stored mainnet value", () => {
      localStorage.setItem("selected_network", "mainnet");
      expect(getSelectedNetwork()).toBe("mainnet");
    });

    it("should return stored testnet value", () => {
      localStorage.setItem("selected_network", "testnet");
      expect(getSelectedNetwork()).toBe("testnet");
    });

    /**
     * A stored devnet resolves to testnet, which is where its data came
     * from anyway: without a compile-time Platform key, getApiUrl already
     * fell back to testnet while the chip kept saying "Devnet". The picker
     * no longer offers devnet, so anyone holding the old value would have
     * been stuck on a label that did not match the chain.
     */
    it("resolves a stored devnet to testnet", () => {
      localStorage.setItem("selected_network", "devnet");
      expect(getSelectedNetwork()).toBe("testnet");
    });

    it("should return mainnet for invalid stored value", () => {
      localStorage.setItem("selected_network", "invalid_network");
      expect(getSelectedNetwork()).toBe("mainnet");
    });

    it("should return mainnet for empty string", () => {
      localStorage.setItem("selected_network", "");
      expect(getSelectedNetwork()).toBe("mainnet");
    });
  });

  describe("setSelectedNetwork", () => {
    it("should store mainnet selection", () => {
      setSelectedNetwork("mainnet");
      expect(localStorage.getItem("selected_network")).toBe("mainnet");
    });

    it("should store testnet selection", () => {
      setSelectedNetwork("testnet");
      expect(localStorage.getItem("selected_network")).toBe("testnet");
    });

    it("should store devnet selection", () => {
      setSelectedNetwork("devnet");
      expect(localStorage.getItem("selected_network")).toBe("devnet");
    });

    it("should overwrite previous selection", () => {
      setSelectedNetwork("mainnet");
      expect(localStorage.getItem("selected_network")).toBe("mainnet");

      setSelectedNetwork("testnet");
      expect(localStorage.getItem("selected_network")).toBe("testnet");
    });
  });

  describe("getNetworkConfig", () => {
    it("should return mainnet config when specified", () => {
      const config = getNetworkConfig("mainnet");
      expect(config).toBe(NETWORKS.mainnet.config);
    });

    it("should return testnet config when specified", () => {
      const config = getNetworkConfig("testnet");
      expect(config).toBe(NETWORKS.testnet.config);
    });

    it("should return devnet config when specified", () => {
      const config = getNetworkConfig("devnet");
      expect(config).toBe(NETWORKS.devnet.config);
    });

    it("should use selected network when no argument provided", () => {
      setSelectedNetwork("mainnet");
      const config = getNetworkConfig();
      expect(config).toBe(NETWORKS.mainnet.config);
    });

    it("should return mainnet config by default", () => {
      const config = getNetworkConfig();
      expect(config).toBe(NETWORKS.mainnet.config);
    });
  });

  describe("getAddressVersion", () => {
    it("should return mainnet for mainnet network", () => {
      expect(getAddressVersion("mainnet")).toBe("mainnet");
    });

    it("should return testnet for testnet network", () => {
      expect(getAddressVersion("testnet")).toBe("testnet");
    });

    it("should return testnet for devnet network", () => {
      expect(getAddressVersion("devnet")).toBe("testnet");
    });

    it("should use selected network when no argument provided", () => {
      setSelectedNetwork("mainnet");
      expect(getAddressVersion()).toBe("mainnet");
    });

    it("should return mainnet by default (mainnet is default)", () => {
      expect(getAddressVersion()).toBe("mainnet");
    });
  });

  describe("buildNetworkWithClient", () => {
    it("should return base network config when no params provided", () => {
      const config = buildNetworkWithClient();
      expect(config).toBe(NETWORKS.mainnet.config);
    });

    it("should return base network config when no baseUrl in params", () => {
      const config = buildNetworkWithClient({});
      expect(config).toBe(NETWORKS.mainnet.config);
    });

    it("should return base network config when client is empty", () => {
      const config = buildNetworkWithClient({ client: {} });
      expect(config).toBe(NETWORKS.mainnet.config);
    });

    it("should use fallback network when specified", () => {
      const config = buildNetworkWithClient(undefined, "mainnet");
      expect(config).toBe(NETWORKS.mainnet.config);
    });

    it("should add allowed baseUrl to config", () => {
      const customUrl = "https://api.hiro.so";
      const config = buildNetworkWithClient({
        client: { baseUrl: customUrl },
      });

      expect(config.client?.baseUrl).toBe(customUrl);
    });

    it("should preserve base network properties with allowed baseUrl", () => {
      const customUrl = "https://api.testnet.hiro.so";
      const config = buildNetworkWithClient(
        { client: { baseUrl: customUrl } },
        "mainnet"
      );

      expect(config.client?.baseUrl).toBe(customUrl);
      // Should still have mainnet chain ID
      expect(config.chainId).toBe(NETWORKS.mainnet.config.chainId);
    });

    it("should throw for disallowed baseUrl", () => {
      expect(() =>
        buildNetworkWithClient({
          client: { baseUrl: "https://evil.com" },
        })
      ).toThrow("Network endpoint not allowed: https://evil.com");
    });

    it("should throw for subdomain spoofing baseUrl", () => {
      expect(() =>
        buildNetworkWithClient({
          client: { baseUrl: "https://api.hiro.so.evil.com" },
        })
      ).toThrow("Network endpoint not allowed: https://api.hiro.so.evil.com");
    });

    it("should work with chainId parameter (ignored)", () => {
      const config = buildNetworkWithClient({ chainId: 999 });
      // chainId in params is not used, base network config is returned
      expect(config).toBe(NETWORKS.mainnet.config);
    });
  });
});
