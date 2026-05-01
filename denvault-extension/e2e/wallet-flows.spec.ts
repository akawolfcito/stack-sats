import { test, expect, type Page } from "@playwright/test";
import { deriveStxAddress } from "../src/utils/accounts/derive";
import { TEST_MNEMONIC, TEST_PIN } from "./fixtures/mock-wallet";

/**
 * Interactive E2E for wallet creation, import, and unlock flows (issue #10).
 *
 * Validates the implemented behavior of StartView, ImportRecoveryPhraseView,
 * and UnlockView via the Vite dev server. The dev server has no
 * `chrome.storage` API, so the WalletVault transparently falls back to
 * `localStorage`.
 */

const DEFAULT_NETWORK = "devnet" as const;

async function clearStorage(page: Page) {
  await page.evaluate(async () => {
    localStorage.clear();
    type ChromeLike = { storage?: { local?: { clear?: () => Promise<void> } } };
    const maybeChrome = (globalThis as unknown as { chrome?: ChromeLike }).chrome;
    if (maybeChrome?.storage?.local?.clear) {
      try {
        await maybeChrome.storage.local.clear();
      } catch {
        // localStorage fallback is sufficient for the dev server.
      }
    }
  });
}

async function gotoFresh(page: Page) {
  await page.goto("/");
  await clearStorage(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
}

async function revealAndReadMnemonic(page: Page): Promise<string[]> {
  const reveal = page.locator('[data-roi="reveal-btn"]');
  await reveal.waitFor({ state: "visible" });
  await reveal.click();
  const grid = page.locator('[data-roi="mnemonic-grid"]');
  await expect(grid).not.toHaveClass(/mnemonic-grid--hidden/);
  const wordTexts = await grid.locator(".word-text").allInnerTexts();
  return wordTexts.map((w) => w.trim()).filter((w) => w.length > 0);
}

async function extractVerifyOrdinals(page: Page): Promise<[number, number]> {
  const subtitle = await page.locator('[data-roi="verify-subtitle"]').innerText();
  const matches = [...subtitle.matchAll(/(\d+)(st|nd|rd|th)/gi)];
  if (matches.length < 2) {
    throw new Error(`Expected 2 ordinals in verify subtitle, got: "${subtitle}"`);
  }
  return [
    parseInt(matches[0][1], 10) - 1,
    parseInt(matches[1][1], 10) - 1,
  ];
}

async function fillVerifyWords(page: Page, mnemonicWords: string[]) {
  const [i1, i2] = await extractVerifyOrdinals(page);

  const w1 = page.locator('[data-roi="verify-word-1-input"]');
  await w1.click();
  await w1.fill("");
  await page.keyboard.type(mnemonicWords[i1], { delay: 10 });

  const w2 = page.locator('[data-roi="verify-word-2-input"]');
  await w2.click();
  await w2.fill("");
  await page.keyboard.type(mnemonicWords[i2], { delay: 10 });
}

async function enterPin(page: Page, pin: string) {
  const container = page.locator('[data-roi="pin-input"]').first();
  await container.waitFor({ state: "visible" });
  await container.focus();
  for (const digit of pin) {
    await page.keyboard.press(digit);
  }
}

async function completePinSetup(page: Page, pin: string) {
  await enterPin(page, pin);
  await expect(page.locator('[data-roi="pin-input"]')).toBeVisible();
  await enterPin(page, pin);
}

async function submitWrongPinThreeTimes(page: Page) {
  const wrongPin = "000000";
  const errorSlot = page.locator('[data-roi="pin-error-slot"]');

  // Attempts 1 and 2: expect "Wrong PIN. N attempts remaining."
  for (let attempt = 1; attempt <= 2; attempt++) {
    await enterPin(page, wrongPin);
    await expect(errorSlot).toContainText(/Wrong PIN/i, { timeout: 5_000 });
    // Wait for the PIN dots to clear before the next attempt.
    await expect(page.locator('[data-roi="pin-dots-rail"] .pin-dot--filled')).toHaveCount(0);
  }

  // Attempt 3: error transitions to terminal lockout copy.
  await enterPin(page, wrongPin);
}

async function importTestWalletThroughUi(page: Page) {
  await page.locator('[data-roi="start-secondary-cta"]').click();
  await expect(page.locator('[data-roi="import-recovery-screen"]')).toBeVisible();

  const textarea = page.locator('[data-roi="import-mnemonic-input"] textarea').first();
  await textarea.click();
  await textarea.fill(TEST_MNEMONIC);

  await expect(page.locator('[data-roi="import-cta-primary"]')).toBeEnabled();
  await page.locator('[data-roi="import-cta-primary"]').click();

  await expect(page.locator('[data-roi="mnemonic-step"]')).toBeVisible();
  const words = await revealAndReadMnemonic(page);

  await page.locator('[data-roi="cta-primary"]').click();
  await expect(page.locator('[data-roi="verify-phrase-step"]')).toBeVisible();
  await fillVerifyWords(page, words);
  await page.locator('[data-roi="verify-cta-primary"]').click();

  await completePinSetup(page, TEST_PIN);
  await expect(page).toHaveURL(/#\/user/, { timeout: 10_000 });
}

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
