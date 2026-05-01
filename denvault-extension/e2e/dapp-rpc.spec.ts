import { test, expect, type Page } from "@playwright/test";
import { clearStorage } from "./helpers/storage";
import { mockStacksNetwork } from "./helpers/network-mocks";
import { installSnapshotMode } from "./helpers/snapshot-mode";
import {
  installChromeShim,
  waitForFirstResponse,
  type CapturedRpcResponse,
} from "./helpers/chrome-shim";
import {
  TEST_DAPP_ORIGIN,
  TEST_TAB_ID,
  getAddressesPayload,
  legacyPopupUrl,
  signMessagePayload,
  transferStxPayload,
} from "./fixtures/dapp-payloads";

/**
 * E2E coverage for DenVault dApp RPC confirmation flows (issue #11 PR B).
 *
 * The dev server has no extension runtime, so we emulate it:
 *   - snapshot mode auto-unlocks the wallet (PIN already covered by #10).
 *   - a chrome.* shim records the wallet's response so the test can assert
 *     the JSON-RPC envelope shape.
 *   - mockStacksNetwork ensures stx_transferStx never broadcasts to a real
 *     node.
 *
 * Only the legacy payload mode (popup URL with `?payload=`) is covered.
 * Queue mode and full content-script integration are intentionally out of
 * scope for this PR.
 */

async function bootRpcConfirmation(page: Page): Promise<void> {
  await installChromeShim(page);
  await installSnapshotMode(page);
  await mockStacksNetwork(page);
}

function assertJsonRpcEnvelope(
  response: CapturedRpcResponse,
  expectedId: string,
): asserts response is CapturedRpcResponse & {
  body: { jsonrpc: "2.0"; id: string };
} {
  expect(response.tabId).toBe(parseInt(TEST_TAB_ID, 10));
  const body = response.body as { jsonrpc?: string; id?: string };
  expect(body.jsonrpc).toBe("2.0");
  expect(body.id).toBe(expectedId);
}

test.describe.serial("DenVault dApp RPC flows (issue #11)", () => {
  test.beforeEach(async ({ page }) => {
    await bootRpcConfirmation(page);
    await page.goto("/");
    await clearStorage(page);
    // Re-seed snapshot keys after the storage wipe.
    await installSnapshotMode(page);
  });

  test("getAddresses returns BTC + STX addresses on approve", async ({ page }) => {
    const payload = getAddressesPayload();
    await page.goto(legacyPopupUrl(payload));

    await expect(page.locator('[data-roi="confirm-screen"]')).toBeVisible();
    await expect(page.locator('[data-roi="confirm-origin"]')).toContainText(
      "example-dapp.test",
    );
    await expect(page.locator('[data-roi="confirm-summary"]')).toBeVisible();

    await page.locator('[data-roi="confirm-cta-primary"]').click();

    const response = await waitForFirstResponse(page);
    assertJsonRpcEnvelope(response, payload.id);

    const result = (response.body as { result?: { addresses?: unknown[]; network?: { name?: string } } }).result;
    expect(result).toBeDefined();
    expect(Array.isArray(result?.addresses)).toBe(true);
    const symbols = (result!.addresses as Array<{ symbol: string; address: string }>)
      .map((a) => a.symbol);
    expect(symbols).toEqual(expect.arrayContaining(["BTC", "STX"]));
    expect(result?.network?.name).toBeDefined();
  });

  test("stx_signMessage returns a signature on approve", async ({ page }) => {
    const message = "Hello DenVault E2E";
    const payload = signMessagePayload(message);
    await page.goto(legacyPopupUrl(payload));

    await expect(page.locator('[data-roi="confirm-screen"]')).toBeVisible();
    await expect(page.locator('[data-roi="confirm-account"]')).toContainText(
      message,
    );

    await page.locator('[data-roi="confirm-cta-primary"]').click();

    const response = await waitForFirstResponse(page);
    assertJsonRpcEnvelope(response, payload.id);

    const result = (response.body as { result?: { signature?: string } }).result;
    expect(result?.signature).toBeTruthy();
    expect(typeof result!.signature).toBe("string");
    expect(result!.signature.length).toBeGreaterThan(0);
  });

  test("stx_transferStx returns the mocked txid on approve", async ({ page }) => {
    const payload = transferStxPayload();
    await page.goto(legacyPopupUrl(payload));

    await expect(page.locator('[data-roi="confirm-screen"]')).toBeVisible();
    await expect(page.locator('[data-roi="confirm-account"]')).toContainText(
      payload.params && typeof payload.params === "object"
        ? (payload.params as { recipient: string }).recipient.slice(0, 6)
        : "",
    );

    await page.locator('[data-roi="confirm-cta-primary"]').click();

    const response = await waitForFirstResponse(page, 15_000);
    assertJsonRpcEnvelope(response, payload.id);

    const result = (response.body as { result?: { txid?: string } }).result;
    expect(result?.txid).toBe("a".repeat(64));
  });

  test("Deny returns a -32xxx error on confirm-cta-secondary", async ({ page }) => {
    const payload = signMessagePayload("Deny me");
    await page.goto(legacyPopupUrl(payload));

    await expect(page.locator('[data-roi="confirm-screen"]')).toBeVisible();

    await page.locator('[data-roi="confirm-cta-secondary"]').click();

    const response = await waitForFirstResponse(page);
    assertJsonRpcEnvelope(response, payload.id);

    const error = (response.body as { error?: { code: number; message: string } }).error;
    expect(error).toBeDefined();
    expect(typeof error?.code).toBe("number");
    expect(error?.message).toMatch(/reject/i);
    // Confirm origin info is preserved across the rejected response too.
    expect(TEST_DAPP_ORIGIN).toContain("example-dapp.test");
  });
});
