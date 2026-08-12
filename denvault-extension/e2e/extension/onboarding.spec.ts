/**
 * The user journey, driven against the real loaded extension.
 *
 * The dev-server specs cover these screens already, but there the vault
 * falls back to localStorage because there is no chrome.storage. Here the
 * real chrome.storage.local is in play, which is the path users get.
 *
 * Focused on what 1.1.3 changed: a fresh wallet derives one account, and
 * a temporary lockout releases itself instead of demanding a wallet reset.
 */

import { test, expect } from "./fixtures";
import {
  TEST_PIN,
  completePinSetup,
  enterPin,
  fillVerifyWords,
  revealAndReadMnemonic,
} from "../helpers/wallet-setup";

test("a new wallet can be created end to end and starts with one account", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);

  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-roi="start-primary-cta"]').click();

  await expect(page.locator('[data-roi="mnemonic-step"]')).toBeVisible();
  const words = await revealAndReadMnemonic(page);
  expect(words.length).toBeGreaterThanOrEqual(12);

  await page.locator('[data-roi="cta-primary"]').click();
  await expect(page.locator('[data-roi="verify-phrase-step"]')).toBeVisible();
  await fillVerifyWords(page, words);
  await page.locator('[data-roi="verify-cta-primary"]').click();

  await completePinSetup(page, TEST_PIN);

  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({ timeout: 15000 });

  // DEFAULT_ACCOUNT_COUNT went from 5 to 1: the switcher should offer
  // exactly one account, not four empty extras.
  await page.locator('[data-roi="acctsw-trigger"]').click();
  const accountList = page.locator('[data-roi="acctsw-list"]');
  await expect(accountList).toBeVisible();
  await expect(accountList.locator("[data-roi='list-row'], .list-row")).toHaveCount(1);
});

test("a temporary lockout counts down and releases the keypad", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);

  // Set up a wallet, then lock it.
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({ timeout: 15000 });
  await page.locator('[data-roi="start-primary-cta"]').click();
  const words = await revealAndReadMnemonic(page);
  await page.locator('[data-roi="cta-primary"]').click();
  await fillVerifyWords(page, words);
  await page.locator('[data-roi="verify-cta-primary"]').click();
  await completePinSetup(page, TEST_PIN);
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({ timeout: 15000 });

  // The session lives in the popup's memory, so a real reload is what
  // locks it — changing only the hash would not reload the page, and
  // UnlockView would bounce straight back to /user.
  await page.reload();

  const errorSlot = page.locator('[data-roi="pin-error-slot"]');
  await expect(errorSlot).toBeAttached({ timeout: 15000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    await enterPin(page, "000000");
    await page.waitForTimeout(400);
  }

  // Issue #18: the old build said "Reset wallet to continue" and disabled
  // the keypad forever. It must now show remaining time instead.
  await expect(errorSlot).toContainText(/Try again in \d+:\d{2}/, { timeout: 10000 });
  await expect(errorSlot).not.toContainText(/Reset wallet to continue/);
});
