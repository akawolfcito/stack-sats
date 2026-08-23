/**
 * What it takes to remove a wallet.
 *
 * Reported from a real session: unlocked with one wallet's PIN, the other
 * wallet could be removed without ever proving it was yours. The modal is
 * right that funds survive if the recovery phrase was written down, but
 * when it was not, that is permanent loss carried out by someone who never
 * showed ownership. Erase-all asks for a typed word and a ticked box;
 * removing one wallet, which destroys exactly the same thing for that
 * wallet, asked for nothing.
 */

import { test, expect, pinNetwork } from "./fixtures";
import {
  TEST_PIN,
  completePinSetup,
  fillVerifyWords,
  importTestWalletThroughUi,
  revealAndReadMnemonic,
} from "../helpers/wallet-setup";

/** Deliberately not TEST_PIN: the whole point is that they differ. */
const SECOND_PIN = "424242";

async function setUpTwoWallets(page: import("@playwright/test").Page, extensionId: string) {
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await pinNetwork(page);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({ timeout: 20000 });

  await importTestWalletThroughUi(page);
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({ timeout: 20000 });

  await page.goto(`chrome-extension://${extensionId}/index.html#/add-wallet`);
  await page.locator('[data-roi="add-wallet-create-cta"]').click();
  await expect(page.locator('[data-roi="add-wallet-mnemonic"]')).toBeVisible({ timeout: 15000 });

  const words = await revealAndReadMnemonic(page);
  await page.locator('[data-roi="cta-primary"]').click();
  await expect(page.locator('[data-roi="add-wallet-verify"]')).toBeVisible();
  await fillVerifyWords(page, words);
  await page.locator('[data-roi="verify-cta-primary"]').click();
  await page.getByRole("button", { name: "Continue" }).click();

  await completePinSetup(page, SECOND_PIN);
  await expect(page).toHaveURL(/#\/user/, { timeout: 15000 });
}

test("a wallet cannot be removed with a different wallet's PIN", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await setUpTwoWallets(page, extensionId);

  await page.goto(`chrome-extension://${extensionId}/index.html#/manage-wallets`);
  const rows = page.locator('[data-roi="wallet-remove"], .wallet-remove-btn');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });

  // Remove the wallet that is not the one the session was opened with.
  await rows.last().click();
  // The Sheet wrapper carries no size of its own, so the field is what tells
  // us the modal is really up.
  await expect(page.locator('[data-roi="remove-wallet-pin"]')).toBeVisible();

  // Nothing is destructible until a PIN is offered.
  await expect(page.locator('[data-roi="remove-wallet-confirm"]')).toBeDisabled();

  // The session's own PIN is not authority over this wallet.
  await page.locator('[data-roi="remove-wallet-pin"]').fill(SECOND_PIN);
  await page.locator('[data-roi="remove-wallet-confirm"]').click();

  await expect(page.locator('[data-roi="remove-wallet-error"]')).toContainText(
    /not this wallet's PIN/i
  );
  await expect(page.locator('[data-roi="remove-wallet-pin"]')).toBeVisible();

  // And the wallet is still there.
  await page.goto(`chrome-extension://${extensionId}/index.html#/manage-wallets`);
  await expect(rows).toHaveCount(2);
});

test("its own PIN removes it", async ({ context, extensionId }) => {
  const page = await context.newPage();
  await setUpTwoWallets(page, extensionId);

  await page.goto(`chrome-extension://${extensionId}/index.html#/manage-wallets`);
  const rows = page.locator('[data-roi="wallet-remove"], .wallet-remove-btn');
  await expect(rows.first()).toBeVisible({ timeout: 15000 });
  await rows.last().click();

  await page.locator('[data-roi="remove-wallet-pin"]').fill(TEST_PIN);
  await page.locator('[data-roi="remove-wallet-confirm"]').click();

  await expect(page.locator('[data-roi="remove-wallet-pin"]')).toBeHidden({
    timeout: 10000,
  });
  await expect(rows).toHaveCount(1);
});
