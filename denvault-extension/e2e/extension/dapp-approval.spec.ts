/**
 * The dApp approval chain, driven against the real loaded extension.
 *
 * This is the path that broke in four different places during the 1.1.3
 * smoke and that no automated test could see, because every other spec
 * either mocks chrome.* on the dev server or stops at the content-script
 * bridge:
 *
 * - H7  the queue popup's messages were dropped by both background listeners
 * - H8  the JSON-RPC envelope was wrapped twice on the way back
 * - H11 the service worker died mid approval and took the queue with it
 * - the review panel appeared to render nothing
 *
 * Here a real page calls the real injected provider, the real worker
 * queues it, the real approval window signs it, and the assertion is on
 * what the page actually receives.
 *
 * Only methods that stay offline are covered. stx_transferStx and
 * stx_callContract broadcast to testnet, so they need network stubbing
 * before they can join.
 */

import type { BrowserContext, Page } from "@playwright/test";
import { test, expect, openDapp } from "./fixtures";
import { TEST_PIN, importTestWalletThroughUi } from "../helpers/wallet-setup";

const DAPP_ORIGIN = "https://dapp.test";

interface WalletCallOutcome {
  status: "resolved" | "rejected";
  result?: {
    jsonrpc?: string;
    id?: string;
    result?: Record<string, unknown>;
  };
  error?: unknown;
}

/**
 * Import the deterministic test wallet, then close the page. The vault
 * lives in chrome.storage.local so it survives, while the unlocked
 * session does not: the approval window opens locked, exactly as a user
 * finds it.
 */
async function setUpWallet(
  context: BrowserContext,
  extensionId: string
): Promise<void> {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });
  await importTestWalletThroughUi(page);
  await page.close();
}

/**
 * Start a request from the page and park the promise on window, so the
 * test can drive the approval window before reading the outcome.
 */
async function callWallet(
  dapp: Page,
  method: string,
  params: unknown = {}
): Promise<void> {
  await dapp.evaluate(
    ({ method, params }) => {
      const w = window as unknown as {
        StacksWallet: { request: (m: string, p: unknown) => Promise<unknown> };
        __walletCall?: Promise<unknown>;
      };
      w.__walletCall = w.StacksWallet.request(method, params)
        .then((result) => ({ status: "resolved", result }))
        .catch((error) => ({ status: "rejected", error }));
    },
    { method, params }
  );
}

async function walletCallOutcome(dapp: Page): Promise<WalletCallOutcome> {
  return dapp.evaluate(
    () => (window as unknown as { __walletCall: Promise<WalletCallOutcome> }).__walletCall
  ) as Promise<WalletCallOutcome>;
}

/** Wait for the queue popup chrome.windows.create opens. */
function waitForApprovalWindow(context: BrowserContext): Promise<Page> {
  return context.waitForEvent("page", {
    predicate: (page) => page.url().includes("mode=queue"),
    timeout: 30000,
  });
}

/** Unlock if asked, then approve. */
async function approve(approval: Page): Promise<void> {
  const pinInput = approval.locator('[data-roi="pin-input"]').first();
  if (await pinInput.isVisible().catch(() => false)) {
    await pinInput.focus();
    for (const digit of TEST_PIN) {
      await approval.keyboard.press(digit);
    }
  }

  const primary = approval.locator('[data-roi="confirm-cta-primary"]');
  await expect(primary).toBeEnabled({ timeout: 10000 });
  await primary.click();
}

test.describe("dApp approval chain", () => {
  test("getAddresses reaches the page as an envelope connect can read", async ({
    context,
    extensionId,
  }) => {
    await setUpWallet(context, extensionId);
    const dapp = await openDapp(context, DAPP_ORIGIN);

    const approvalWindow = waitForApprovalWindow(context);
    await callWallet(dapp, "getAddresses");
    const approval = await approvalWindow;

    await expect(approval.locator('[data-roi="confirm-screen"]')).toBeVisible({
      timeout: 20000,
    });
    await expect(approval.locator('[data-roi="confirm-origin"]')).toContainText(
      "dapp.test"
    );
    // confirm-title is the window chrome ("Confirm Action"); the method
    // being approved is announced in the summary block.
    await expect(approval.locator('[data-roi="confirm-summary"]')).toContainText(
      /Request wallet addresses/i
    );

    await approve(approval);

    const outcome = await walletCallOutcome(dapp);
    expect(outcome.status).toBe("resolved");

    // @stacks/connect does `return n.result` on whatever the provider
    // resolves, then reads `.addresses` off it. Wrapping the handler's
    // envelope a second time buried the addresses one level too deep and
    // the dApp reported "No STX address found in response".
    const envelope = outcome.result!;
    expect(envelope.jsonrpc).toBe("2.0");
    expect(envelope.result).not.toHaveProperty("jsonrpc");
    expect(envelope.result).not.toHaveProperty("result");

    const addresses = envelope.result!.addresses as Array<{
      symbol: string;
      address: string;
      publicKey: string;
    }>;
    const stx = addresses.find((entry) => entry.symbol === "STX");
    expect(stx?.address).toMatch(/^ST/);
    expect(addresses.filter((entry) => entry.symbol === "BTC")).toHaveLength(2);
  });

  test("the review panel shows the request being approved", async ({
    context,
    extensionId,
  }) => {
    await setUpWallet(context, extensionId);
    const dapp = await openDapp(context, DAPP_ORIGIN);

    const approvalWindow = waitForApprovalWindow(context);
    await callWallet(dapp, "stx_signMessage", { message: "hello denvault" });
    const approval = await approvalWindow;

    await expect(approval.locator('[data-roi="confirm-screen"]')).toBeVisible({
      timeout: 20000,
    });

    // The panel renders background's canonical params, which is the whole
    // point: what the user reviews has to be what gets signed.
    await approval.locator('[data-roi="confirm-details-toggle"] summary').click();
    const panel = approval.locator('[data-roi="confirm-details-panel"]');

    await expect(panel).toBeVisible();
    await expect(panel).toContainText('"method": "stx_signMessage"');
    await expect(panel).toContainText("hello denvault");

    // Visible is not the same as legible: a zero-height box passes the
    // first check and shows the user nothing.
    const box = await panel.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThan(10);
    expect(box!.width).toBeGreaterThan(10);
  });

  test("stx_signMessage returns a signature to the page", async ({
    context,
    extensionId,
  }) => {
    await setUpWallet(context, extensionId);
    const dapp = await openDapp(context, DAPP_ORIGIN);

    const approvalWindow = waitForApprovalWindow(context);
    await callWallet(dapp, "stx_signMessage", { message: "hello denvault" });
    const approval = await approvalWindow;

    await expect(approval.locator('[data-roi="confirm-screen"]')).toBeVisible({
      timeout: 20000,
    });
    await approve(approval);

    const outcome = await walletCallOutcome(dapp);
    expect(outcome.status).toBe("resolved");

    const result = outcome.result!.result!;
    expect(result).not.toHaveProperty("result");
    expect(String(result.signature)).toMatch(/^[0-9a-f]{130}$/i);
    expect(String(result.publicKey)).toMatch(/^[0-9a-f]{66}$/i);
  });

  test("Deny sends a rejection instead of leaving the page waiting", async ({
    context,
    extensionId,
  }) => {
    await setUpWallet(context, extensionId);
    const dapp = await openDapp(context, DAPP_ORIGIN);

    const approvalWindow = waitForApprovalWindow(context);
    await callWallet(dapp, "getAddresses");
    const approval = await approvalWindow;

    await expect(approval.locator('[data-roi="confirm-screen"]')).toBeVisible({
      timeout: 20000,
    });
    await approval.locator('[data-roi="confirm-cta-secondary"]').click();

    const outcome = await walletCallOutcome(dapp);
    expect(outcome.status).toBe("rejected");
    expect(outcome.error).toMatchObject({ error: { code: 4001 } });
  });
});
