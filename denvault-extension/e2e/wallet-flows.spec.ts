import { test, expect } from "@playwright/test";
import { deriveStxAddress } from "../src/utils/accounts/derive";
import { gotoFresh } from "./helpers/storage";
import {
  TEST_MNEMONIC,
  TEST_PIN,
  completePinSetup,
  enterPin,
  fillVerifyWords,
  importTestWalletThroughUi,
  revealAndReadMnemonic,
  submitWrongPinThreeTimes,
} from "./helpers/wallet-setup";

/**
 * Interactive E2E for wallet creation, import, and unlock flows (issue #10).
 *
 * Validates the implemented behavior of StartView, ImportRecoveryPhraseView,
 * and UnlockView via the Vite dev server. The dev server has no
 * `chrome.storage` API, so the WalletVault transparently falls back to
 * `localStorage`.
 */

const DEFAULT_NETWORK = "devnet" as const;

test.describe.serial("DenVault wallet flows (issue #10)", () => {
  test.beforeEach(async ({ page }) => {
    await gotoFresh(page);
  });

  test("creates a new wallet end-to-end", async ({ page }) => {
    await expect(page.locator('[data-roi="start-hero"]')).toBeVisible();

    await page.locator('[data-roi="start-primary-cta"]').click();
    await expect(page.locator('[data-roi="mnemonic-step"]')).toBeVisible();

    const words = await revealAndReadMnemonic(page);
    expect(words.length).toBeGreaterThanOrEqual(12);

    await page.locator('[data-roi="cta-primary"]').click();
    await expect(page.locator('[data-roi="verify-phrase-step"]')).toBeVisible();
    await fillVerifyWords(page, words);
    await page.locator('[data-roi="verify-cta-primary"]').click();

    await completePinSetup(page, TEST_PIN);

    await expect(page).toHaveURL(/#\/user/, { timeout: 10_000 });
    await expect(page.locator('[data-roi="home-screen"]')).toBeVisible();
  });

  test("imports an existing wallet and renders the derived address", async ({ page }) => {
    await importTestWalletThroughUi(page);

    const expectedAddress = await deriveStxAddress(TEST_MNEMONIC, 0, DEFAULT_NETWORK);
    // Mirrors the local 7...7 format used by `truncateAddress` inside
    // src/views/UserHomeView.vue (which shadows the 8...8 helper from useTxDraft).
    const expectedShort = `${expectedAddress.slice(0, 7)}...${expectedAddress.slice(-7)}`;

    const trigger = page.locator('[data-roi="acctsw-trigger"]');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText(expectedShort);
  });

  // NOTE: The current UI treats 3 failed PIN attempts as terminal.
  // Although LockoutManager supports temporary lockouts, UnlockView does not
  // currently re-enable the PIN input after the timeout.
  // Therefore this spec validates the implemented behavior: terminal lockout
  // followed by reset wallet flow.

  test("unlocks with the correct PIN", async ({ page }) => {
    await importTestWalletThroughUi(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/#\/unlock/, { timeout: 10_000 });

    await enterPin(page, TEST_PIN);
    await expect(page).toHaveURL(/#\/user/, { timeout: 10_000 });
    await expect(page.locator('[data-roi="home-screen"]')).toBeVisible();
  });

  test("locks the unlock UI after 3 failed PIN attempts", async ({ page }) => {
    await importTestWalletThroughUi(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/#\/unlock/, { timeout: 10_000 });

    await submitWrongPinThreeTimes(page);

    await expect(page.locator('[data-roi="pin-error-slot"]')).toContainText(
      /Too many attempts/i,
      { timeout: 5_000 },
    );

    const firstKey = page.locator('[data-roi="pin-keypad"] button').first();
    await expect(firstKey).toBeDisabled();
  });

  test("Forgot PIN reset returns the user to the start screen", async ({ page }) => {
    await importTestWalletThroughUi(page);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/#\/unlock/, { timeout: 10_000 });

    await submitWrongPinThreeTimes(page);

    await page.locator('[data-roi="forgot-pin-link"]').click();

    const deleteInput = page.locator("#delete-input");
    await expect(deleteInput).toBeVisible();
    await deleteInput.fill("DELETE");

    await page.getByRole("button", { name: /Reset Wallet/i }).click();

    await expect(page).toHaveURL(/#\/?$/, { timeout: 10_000 });
    await expect(page.locator('[data-roi="start-hero"]')).toBeVisible();
  });
});
