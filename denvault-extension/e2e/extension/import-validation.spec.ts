/**
 * What the import screen accepts as a recovery phrase.
 *
 * A phrase with two words run together was taken, encrypted, and written
 * to disk. The word count and the lowercase check were the whole gate, and
 * "newtraffic" passes both. Deriving accounts from it then failed on the
 * home screen, in a redirect ring with no exit, long after the text could
 * still be corrected.
 *
 * These run against the real extension, because the vault falls back to
 * localStorage on the dev server and this is about what reaches storage.
 */

import { test, expect, pinNetwork } from "./fixtures";

/** Checksum valid, and what a correct import looks like. */
const VALID = `${"abandon ".repeat(11)}about`;

async function openImport(page: import("@playwright/test").Page) {
  await page.locator('[data-roi="start-secondary-cta"]').click();
  await expect(page.locator('[data-roi="import-recovery-screen"]')).toBeVisible();
  return page.locator('[data-roi="import-mnemonic-input"] textarea').first();
}

test.beforeEach(async ({ context, extensionId }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await pinNetwork(page);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });
});

test("a phrase with two words run together is refused, and says which", async ({
  context,
}) => {
  const page = context.pages()[context.pages().length - 1];
  const textarea = await openImport(page);

  // 12 words, every one lowercase letters, one of them not a real word.
  const words = VALID.split(" ");
  words[8] = "newtraffic";
  await textarea.click();
  await textarea.fill(words.join(" "));

  await page.locator('[data-roi="import-cta-primary"]').click();

  const error = page.locator('[data-roi="import-error"]');
  await expect(error).toBeVisible();
  await expect(error).toContainText("Word 9");
  await expect(error).toContainText("newtraffic");

  // Still here, with the text intact, which is the point of checking early.
  await expect(page.locator('[data-roi="import-recovery-screen"]')).toBeVisible();
});

test("real words in the wrong order are refused by the checksum", async ({
  context,
}) => {
  const page = context.pages()[context.pages().length - 1];
  const textarea = await openImport(page);

  const words = VALID.split(" ");
  words[11] = "zoo";
  await textarea.click();
  await textarea.fill(words.join(" "));

  await page.locator('[data-roi="import-cta-primary"]').click();

  await expect(page.locator('[data-roi="import-error"]')).toBeVisible();
  await expect(page.locator('[data-roi="import-recovery-screen"]')).toBeVisible();
});

test("a correct phrase still goes through", async ({ context }) => {
  const page = context.pages()[context.pages().length - 1];
  const textarea = await openImport(page);

  await textarea.click();
  await textarea.fill(VALID);
  await page.locator('[data-roi="import-cta-primary"]').click();

  await expect(page.locator('[data-roi="mnemonic-step"]')).toBeVisible({
    timeout: 15000,
  });
});
