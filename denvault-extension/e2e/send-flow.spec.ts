import { test, expect, type Page } from "@playwright/test";
import { gotoFresh } from "./helpers/storage";
import { mockStacksNetwork } from "./helpers/network-mocks";
import {
  TEST_PIN,
  enterPin,
  importTestWalletThroughUi,
} from "./helpers/wallet-setup";

/**
 * Interactive E2E for the Send STX flow (issue #11).
 *
 * All Stacks API endpoints are intercepted; no real broadcast or balance
 * fetch escapes the test boundary. The flow walks SendView → ConfirmTxView
 * → SendView (PIN step) → TxResultView with a mocked txid.
 */

// Valid testnet/devnet (ST*) STX address used for the recipient field.
const VALID_RECIPIENT = "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM";
// 1000 STX in microSTX. Matches the default mock balance and the
// formatStxDisplay output (no thousands separator at this magnitude).
const MOCKED_BALANCE_DISPLAY = "Available: 1000 STX";
const MOCKED_TXID = "a".repeat(64);

async function navigateToSendForm(page: Page) {
  // Avoid clicking through the home ActionBar: the Send action button has no
  // data-roi yet, so we navigate directly via the hash route. SendView's
  // onBeforeMount will redirect to /unlock if the wallet is locked.
  await page.goto("/#/send");
  await expect(page.locator('[data-roi="send-screen"]')).toBeVisible();
  await expect(page.locator('[data-roi="send-form"]')).toBeVisible();
}

async function fillSendForm(
  page: Page,
  opts: { recipient: string; amount: string },
) {
  const recipient = page
    .locator('[data-roi="send-textfield-to"] input')
    .first();
  await recipient.click();
  await recipient.fill(opts.recipient);
  // Trigger validation via blur.
  await recipient.blur();

  const amount = page
    .locator('[data-roi="send-textfield-amount"] input')
    .first();
  await amount.click();
  await amount.fill(opts.amount);
  await amount.blur();
}

test.describe.serial("DenVault send STX flow (issue #11)", () => {
  test.beforeEach(async ({ page }) => {
    await mockStacksNetwork(page);
    await gotoFresh(page);
    await importTestWalletThroughUi(page);
  });

  test("renders the send form with mocked balance available", async ({ page }) => {
    await navigateToSendForm(page);
    // The form pulls balance via fetchStxBalance which is mocked.
    await expect(page.locator('[data-roi="send-form"]')).toContainText(
      MOCKED_BALANCE_DISPLAY,
      { timeout: 10_000 },
    );
  });

  test("flags an invalid recipient address", async ({ page }) => {
    await navigateToSendForm(page);
    await fillSendForm(page, { recipient: "not-an-address", amount: "1" });

    await expect(
      page.locator('[data-roi="send-error-recipient"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-roi="send-error-recipient"]'),
    ).toContainText(/invalid|address/i);
  });

  test("flags insufficient funds when amount exceeds balance", async ({ page }) => {
    await navigateToSendForm(page);
    // Mocked balance is 1000 STX. Send well past it.
    await fillSendForm(page, { recipient: VALID_RECIPIENT, amount: "999999" });

    await expect(page.locator('[data-roi="send-error-amount"]')).toBeVisible();
  });

  test("walks form → confirm-tx summary → PIN prompt", async ({ page }) => {
    await navigateToSendForm(page);
    await fillSendForm(page, { recipient: VALID_RECIPIENT, amount: "1" });

    await page.getByRole("button", { name: /Continue/ }).click();

    await expect(page).toHaveURL(/#\/confirm-tx/, { timeout: 10_000 });
    await expect(page.locator('[data-roi="confirm-view-root"]')).toBeVisible();
    await expect(page.locator('[data-roi="confirm-summary"]')).toBeVisible();
    await expect(page.locator('[data-roi="confirm-to-row"]')).toContainText(
      /ST1PQHQ/,
    );

    await page.getByRole("button", { name: /Confirm & Send/ }).click();

    await expect(page).toHaveURL(/#\/send/, { timeout: 10_000 });
    await expect(page.locator('[data-roi="send-confirm-pin"]')).toBeVisible();
    await expect(page.locator('[data-roi="send-confirm-amount"]')).toContainText(
      "STX",
    );
  });

  test("submits the transaction and lands on tx-result with the mocked txid", async ({ page }) => {
    await navigateToSendForm(page);
    await fillSendForm(page, { recipient: VALID_RECIPIENT, amount: "1" });

    await page.getByRole("button", { name: /Continue/ }).click();
    await expect(page.locator('[data-roi="confirm-view-root"]')).toBeVisible();
    await page.getByRole("button", { name: /Confirm & Send/ }).click();

    await expect(page.locator('[data-roi="send-confirm-pin"]')).toBeVisible();
    await enterPin(page, TEST_PIN);

    await expect(page).toHaveURL(/#\/tx-result/, { timeout: 15_000 });
    await expect(page.locator('[data-roi="tx-result-screen"]')).toBeVisible();
    await expect(page.locator('[data-roi="tx-result-summary"]')).toBeVisible();
    // The mocked txid is the lowercase 64-char hex string.
    await expect(page.locator('[data-roi="tx-result-txid"]')).toContainText(
      MOCKED_TXID.slice(0, 8),
    );
  });
});
