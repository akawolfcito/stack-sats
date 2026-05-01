import type { JsonRpcRequest } from "../../src/utils/types";

/**
 * Factories for dApp RPC payloads used by `dapp-rpc.spec.ts`.
 *
 * Shapes mirror what `App.vue` parses from query params and what
 * `stxmethods/index.ts` validates with Zod.
 */

export const TEST_DAPP_ORIGIN = "https://example-dapp.test";
export const TEST_TAB_ID = "1";

/** Valid testnet/devnet address used as a recipient in transfer fixtures. */
export const TEST_STX_RECIPIENT = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";

export function getAddressesPayload(): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id: "rpc-get-addresses-1",
    method: "getAddresses",
    params: {},
  };
}

export function signMessagePayload(message = "Hello DenVault"): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id: "rpc-sign-message-1",
    method: "stx_signMessage",
    params: { message },
  };
}

export function transferStxPayload(
  overrides: Partial<{
    recipient: string;
    amount: string;
    memo: string;
    network: { chainId?: number; client?: { baseUrl?: string } };
  }> = {},
): JsonRpcRequest {
  return {
    jsonrpc: "2.0",
    id: "rpc-transfer-stx-1",
    method: "stx_transferStx",
    params: {
      recipient: TEST_STX_RECIPIENT,
      amount: "1000000",
      memo: "E2E transfer",
      network: { chainId: 2147483648 },
      ...overrides,
    },
  };
}

/**
 * Build the legacy popup URL with `?payload=&tabId=&origin=` query params.
 * App.vue parses these on mount and renders Confirmation when payload is
 * valid JSON.
 */
export function legacyPopupUrl(
  payload: JsonRpcRequest,
  options: { tabId?: string; origin?: string } = {},
): string {
  const tabId = options.tabId ?? TEST_TAB_ID;
  const origin = options.origin ?? TEST_DAPP_ORIGIN;
  const encodedPayload = encodeURIComponent(JSON.stringify(payload));
  const encodedOrigin = encodeURIComponent(origin);
  return `/?tabId=${tabId}&origin=${encodedOrigin}&payload=${encodedPayload}`;
}
