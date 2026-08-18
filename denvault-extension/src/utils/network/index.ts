import {
  STACKS_MAINNET,
  STACKS_TESTNET,
  STACKS_DEVNET,
  type StacksNetwork,
} from "@stacks/network";
import { isAllowedApiHost } from "./allowed-hosts";

export type NetworkName = "mainnet" | "testnet" | "devnet";

const NETWORK_STORAGE_KEY = "selected_network";

/**
 * Network configurations with display info
 */
export const NETWORKS: Record<
  NetworkName,
  {
    name: string;
    config: StacksNetwork;
    addressPrefix: string;
    explorerUrl: string;
  }
> = {
  mainnet: {
    name: "Mainnet",
    config: STACKS_MAINNET,
    addressPrefix: "SP",
    explorerUrl: "https://explorer.hiro.so",
  },
  testnet: {
    name: "Testnet",
    config: STACKS_TESTNET,
    addressPrefix: "ST",
    explorerUrl: "https://explorer.hiro.so",
  },
  devnet: {
    name: "Devnet",
    config: STACKS_DEVNET,
    addressPrefix: "ST",
    explorerUrl: "",
  },
};

/**
 * Get the currently selected network from storage
 */
export function getSelectedNetwork(): NetworkName {
  const stored = localStorage.getItem(NETWORK_STORAGE_KEY);
  if (stored === "mainnet" || stored === "testnet") {
    return stored;
  }

  /**
   * A stored devnet resolves to testnet, which is where its data was coming
   * from anyway: without a compile-time Platform key getApiUrl already fell
   * back to testnet while the chip kept saying "Devnet". The picker no
   * longer offers devnet, so anyone holding the old value would otherwise be
   * stuck on a label that does not match the chain they are reading.
   */
  if (stored === "devnet") {
    return "testnet";
  }
  /**
   * Mainnet, because it is the only network that works without configuring
   * anything.
   *
   * This used to default to devnet, which a published build cannot reach at
   * all: getApiUrl builds the devnet URL from VITE_PLATFORM_HIRO_API_KEY, a
   * compile-time variable, and falls back to testnet when there is none,
   * while getNetworkConfig keeps pointing at localhost:3999. So a fresh
   * install opened on a chip reading "Devnet", took its balances from
   * testnet and would have broadcast to a node nobody was running.
   */
  return "mainnet";
}

/**
 * Set the selected network in storage
 */
export function setSelectedNetwork(network: NetworkName): void {
  localStorage.setItem(NETWORK_STORAGE_KEY, network);
}

/**
 * Get StacksNetwork config for the selected network
 */
export function getNetworkConfig(network?: NetworkName): StacksNetwork {
  const selectedNetwork = network || getSelectedNetwork();
  return NETWORKS[selectedNetwork].config;
}

/**
 * Get address version string for privateKeyToAddress
 */
export function getAddressVersion(network?: NetworkName): "mainnet" | "testnet" {
  const selectedNetwork = network || getSelectedNetwork();
  return selectedNetwork === "mainnet" ? "mainnet" : "testnet";
}

/**
 * Build network config with optional custom client URL
 */
export function buildNetworkWithClient(
  networkParams?: { chainId?: number; client?: { baseUrl?: string } },
  fallbackNetwork?: NetworkName
): StacksNetwork {
  const baseNetwork = getNetworkConfig(fallbackNetwork);
  const baseUrl = networkParams?.client?.baseUrl;

  if (!baseUrl) {
    return baseNetwork;
  }

  if (!isAllowedApiHost(baseUrl)) {
    throw new Error(`Network endpoint not allowed: ${baseUrl}`);
  }

  return {
    ...baseNetwork,
    client: { baseUrl },
  };
}
