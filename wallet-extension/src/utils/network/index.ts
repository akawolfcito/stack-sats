import {
  STACKS_MAINNET,
  STACKS_TESTNET,
  STACKS_DEVNET,
  type StacksNetwork,
} from "@stacks/network";

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
    explorerUrl: "https://explorer.hiro.so/?chain=testnet",
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
  if (stored && (stored === "mainnet" || stored === "testnet" || stored === "devnet")) {
    return stored;
  }
  return "devnet"; // Default to devnet for development
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

  return {
    ...baseNetwork,
    client: { baseUrl },
  };
}
