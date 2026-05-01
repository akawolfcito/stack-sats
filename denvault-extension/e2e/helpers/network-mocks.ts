import type { Page, Route } from "@playwright/test";

/**
 * Network mocks for Stacks E2E flows.
 *
 * Critical: every endpoint that could touch a remote node must be intercepted.
 * If a real broadcast or balance fetch escapes, the wallet flows would either
 * hit live infrastructure or fail in non-deterministic ways. The default
 * handlers below answer with a fully self-contained dataset.
 */

export interface MockOptions {
  /** STX balance in microSTX. Defaults to 1000 STX (1_000_000_000 µSTX). */
  balanceMicroStx?: string;
  /** Account nonce. Defaults to 0. */
  nonce?: number;
  /** Hex transaction id returned on successful broadcast. */
  txid?: string;
  /** Force broadcast to fail with this reason (string passes to JSON body). */
  broadcastError?: { reason: string; reasonData?: unknown };
}

const DEFAULTS: Required<Pick<MockOptions, "balanceMicroStx" | "nonce" | "txid">> = {
  balanceMicroStx: "1000000000",
  nonce: 0,
  txid: "a".repeat(64),
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function fulfillText(route: Route, body: string, status = 200) {
  await route.fulfill({
    status,
    contentType: "text/plain",
    body,
  });
}

/**
 * Install Hiro/Stacks API mocks on the page. Routes are matched by URL path
 * fragments so we don't need to enumerate every host (mainnet/testnet/devnet/
 * platform proxy). Returns an unmock helper if the caller wants to remove
 * them mid-test.
 */
export async function mockStacksNetwork(
  page: Page,
  options: MockOptions = {},
): Promise<() => Promise<void>> {
  const balanceMicroStx = options.balanceMicroStx ?? DEFAULTS.balanceMicroStx;
  const nonce = options.nonce ?? DEFAULTS.nonce;
  const txid = options.txid ?? DEFAULTS.txid;

  // Address balances (extended API).
  await page.route("**/extended/v1/address/*/balances", (route) =>
    fulfillJson(route, {
      stx: { balance: balanceMicroStx, total_sent: "0", total_received: balanceMicroStx },
      fungible_tokens: {},
      non_fungible_tokens: {},
    }),
  );

  // Account info / nonce (core API).
  await page.route("**/v2/accounts/*", (route) =>
    fulfillJson(route, {
      balance: `0x${BigInt(balanceMicroStx).toString(16)}`,
      locked: "0x0",
      unlock_height: 0,
      nonce,
      balance_proof: "",
      nonce_proof: "",
    }),
  );

  // Fee estimate.
  await page.route("**/v2/fees/transaction", (route) =>
    fulfillJson(route, {
      cost_scalar_change_by_byte: 0,
      estimated_cost: { read_count: 0, read_length: 0, runtime: 0, write_count: 0, write_length: 0 },
      estimated_cost_scalar: 0,
      estimations: [
        { fee: 180, fee_rate: 1 },
        { fee: 250, fee_rate: 1 },
        { fee: 380, fee_rate: 1 },
      ],
    }),
  );

  // Broadcast endpoint.
  await page.route("**/v2/transactions", async (route) => {
    if (options.broadcastError) {
      await fulfillJson(route, { error: "Broadcast failed", reason: options.broadcastError.reason, reason_data: options.broadcastError.reasonData ?? null }, 400);
      return;
    }
    // Stacks broadcast endpoint returns the txid as a quoted hex string.
    await fulfillText(route, `"${txid}"`);
  });

  // Tx status (used by some views to poll). Always say pending so we don't
  // depend on chain state.
  await page.route("**/extended/v1/tx/*", (route) =>
    fulfillJson(route, {
      tx_id: `0x${txid}`,
      tx_status: "pending",
      tx_type: "token_transfer",
    }),
  );

  return async () => {
    await page.unroute("**/extended/v1/address/*/balances");
    await page.unroute("**/v2/accounts/*");
    await page.unroute("**/v2/fees/transaction");
    await page.unroute("**/v2/transactions");
    await page.unroute("**/extended/v1/tx/*");
  };
}

/**
 * Fail the test if any non-mocked Stacks API call leaks through. Call AFTER
 * `mockStacksNetwork` to install a guard that rejects unexpected hosts.
 */
export async function blockUnmockedStacksHosts(page: Page): Promise<void> {
  await page.route(/api(\.[a-z-]+)?\.hiro\.so|stacks-node|api\.platform\.hiro\.so/, async (route) => {
    const url = route.request().url();
    await route.abort();
    throw new Error(`Unmocked Stacks API call escaped to: ${url}`);
  });
}
