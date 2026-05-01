import { expect, type Page } from "@playwright/test";
import { TEST_MNEMONIC, TEST_PIN } from "../fixtures/mock-wallet";

/**
 * Reusable interactions for DenVault wallet flows in E2E specs.
 * Mirrors the canonical paths validated by `wallet-flows.spec.ts` (issue #10).
 */

export { TEST_MNEMONIC, TEST_PIN };

export async function revealAndReadMnemonic(page: Page): Promise<string[]> {
  const reveal = page.locator('[data-roi="reveal-btn"]');
  await reveal.waitFor({ state: "visible" });
  await reveal.click();
  const grid = page.locator('[data-roi="mnemonic-grid"]');
  await expect(grid).not.toHaveClass(/mnemonic-grid--hidden/);
  const wordTexts = await grid.locator(".word-text").allInnerTexts();
  return wordTexts.map((w) => w.trim()).filter((w) => w.length > 0);
}

export async function extractVerifyOrdinals(
  page: Page,
): Promise<[number, number]> {
  const subtitle = await page
    .locator('[data-roi="verify-subtitle"]')
    .innerText();
  const matches = [...subtitle.matchAll(/(\d+)(st|nd|rd|th)/gi)];
  if (matches.length < 2) {
    throw new Error(
      `Expected 2 ordinals in verify subtitle, got: "${subtitle}"`,
    );
  }
  return [
    parseInt(matches[0][1], 10) - 1,
    parseInt(matches[1][1], 10) - 1,
  ];
}

export async function fillVerifyWords(
  page: Page,
  mnemonicWords: string[],
): Promise<void> {
  const [i1, i2] = await extractVerifyOrdinals(page);

  const w1 = page.locator('[data-roi="verify-word-1-input"]');
  await w1.click();
  await w1.fill("");
  await page.keyboard.type(mnemonicWords[i1], { delay: 10 });
  // Close the typeahead dropdown so it does not intercept the next click.
  await page.keyboard.press("Escape");

  const w2 = page.locator('[data-roi="verify-word-2-input"]');
  await w2.click();
  await w2.fill("");
  await page.keyboard.type(mnemonicWords[i2], { delay: 10 });
  await page.keyboard.press("Escape");
}

export async function enterPin(page: Page, pin: string): Promise<void> {
  const container = page.locator('[data-roi="pin-input"]').first();
  await container.waitFor({ state: "visible" });
  await container.focus();
  for (const digit of pin) {
    await page.keyboard.press(digit);
  }
}

export async function completePinSetup(
  page: Page,
  pin: string,
): Promise<void> {
  await enterPin(page, pin);
  await expect(page.locator('[data-roi="pin-input"]')).toBeVisible();
  await enterPin(page, pin);
}

export async function submitWrongPinThreeTimes(page: Page): Promise<void> {
  const wrongPin = "000000";
  const errorSlot = page.locator('[data-roi="pin-error-slot"]');

  for (let attempt = 1; attempt <= 2; attempt++) {
    await enterPin(page, wrongPin);
    await expect(errorSlot).toContainText(/Wrong PIN/i, { timeout: 5_000 });
    await expect(
      page.locator('[data-roi="pin-dots-rail"] .pin-dot--filled'),
    ).toHaveCount(0);
  }

  await enterPin(page, wrongPin);
}

/**
 * Drive the import flow end-to-end with TEST_MNEMONIC + TEST_PIN.
 * Leaves the page on `/#/user`.
 */
export async function importTestWalletThroughUi(page: Page): Promise<void> {
  await page.locator('[data-roi="start-secondary-cta"]').click();
  await expect(
    page.locator('[data-roi="import-recovery-screen"]'),
  ).toBeVisible();

  const textarea = page
    .locator('[data-roi="import-mnemonic-input"] textarea')
    .first();
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
