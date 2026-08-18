/**
 * Fixed chain answers, so a golden is a photograph of the wallet and not
 * of the network's mood.
 *
 * The golden suites made real calls: no interception, and the setup pinned
 * `selected_network` to devnet, which resolves to testnet since devnet was
 * withdrawn. So every capture asked api.testnet.hiro.so for the balance of
 * the test mnemonic's address, and Hiro rate limits a public caller
 * readily. The same screen was photographed as a funded wallet in one run
 * and as an empty one in the next, with the Send screen swinging between
 * "499.997438 AVAILABLE" and "0 AVAILABLE" plus a "balance too low"
 * warning. Diffs moved on their own and there was no way to tell a real
 * regression from a 429.
 *
 * Every external host is intercepted here, including ones nothing calls
 * today: an unstubbed request is a golden that can change without anyone
 * touching the product.
 */

import type { Page, Route } from '@playwright/test';

/**
 * 499.997438 STX, in microSTX.
 *
 * Not a round number on purpose. formatStxFromMicro truncates rather than
 * rounds, so that a balance of 499.9999 never reads as 500 STX the user
 * cannot spend, and only a fixture with digits past the cut proves it
 * still does.
 */
export const FIXTURE_STX_MICRO = '499997438';

/** 0.00180489 BTC, in satoshis, split so the confirmed path is exercised. */
export const FIXTURE_BTC_SATS = 180489;

const balances = {
  stx: {
    balance: FIXTURE_STX_MICRO,
    total_sent: '0',
    total_received: FIXTURE_STX_MICRO,
    lock_height: 0,
    lock_tx_id: '',
    locked: '0',
  },
  fungible_tokens: {},
  non_fungible_tokens: {},
};

const emptyTxList = { limit: 20, offset: 0, total: 0, results: [] };

/** What Esplora reports for an address: funded minus spent is the balance. */
const esploraAddress = {
  chain_stats: {
    funded_txo_count: 2,
    funded_txo_sum: FIXTURE_BTC_SATS,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 2,
  },
  mempool_stats: {
    funded_txo_count: 0,
    funded_txo_sum: 0,
    spent_txo_count: 0,
    spent_txo_sum: 0,
    tx_count: 0,
  },
};

function json(route: Route, body: unknown) {
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

/**
 * Answer every chain call with a fixture. Call before navigating.
 */
export async function stubChainApis(page: Page): Promise<void> {
  // Registered first on purpose: Playwright checks handlers in reverse
  // order of registration, so this catch-all is the last one consulted.
  // Anything reaching it is a hole in the list below. Failing it loudly
  // beats a golden that quietly depends on someone else's uptime.
  await page.route('**/*', route => {
    const url = route.request().url();
    const isLocal =
      url.startsWith('http://localhost') ||
      url.startsWith('http://127.0.0.1') ||
      url.startsWith('data:') ||
      url.startsWith('blob:') ||
      url.startsWith('about:');
    return isLocal ? route.continue() : route.abort();
  });

  // Stacks: balances, history and the mempool.
  await page.route('**/extended/v1/address/*/balances*', route => json(route, balances));
  await page.route('**/extended/v1/address/*/transactions*', route => json(route, emptyTxList));
  await page.route('**/extended/v1/address/*/mempool*', route => json(route, emptyTxList));

  // Token metadata. Nothing holds a token in these fixtures, but the
  // lookup runs anyway and would otherwise leave the page.
  await page.route('**/metadata/v1/**', route =>
    route.fulfill({ status: 404, contentType: 'application/json', body: '{}' })
  );

  // Bitcoin, through whichever Esplora host answers first.
  await page.route('**/address/*/txs*', route => json(route, []));
  await page.route('**/api/address/*', route => json(route, esploraAddress));
  await page.route('**/testnet/api/address/*', route => json(route, esploraAddress));
  await page.route('**/tx/*/status*', route =>
    json(route, { confirmed: true, block_height: 5124343 })
  );
}
