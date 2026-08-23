/**
 * Unlocking the second wallet, when the two PINs differ.
 *
 * Reported from a real session: create a second wallet with its own PIN,
 * land on it correctly, then enter that PIN at the lock screen and the
 * wallet never opens. The console fills with "Invalid mnemonic phrase
 * provided" and Chrome starts throttling navigation on #/user.
 *
 * The bounce is a closed circuit between three views:
 *
 *   UserHomeView  loadAccounts() throws  -> push("/")
 *   StartView     hasWallet              -> push("/unlock")
 *   UnlockView    !isLocked              -> push("/user")
 *
 * Nothing in that ring can break out, so whatever puts the session in a
 * state its own home screen cannot render turns into an endless spin
 * rather than a message. This spec drives the reported path.
 */

import { test, expect, pinNetwork } from "./fixtures";
import {
  TEST_PIN,
  completePinSetup,
  enterPin,
  fillVerifyWords,
  importTestWalletThroughUi,
  revealAndReadMnemonic,
} from "../helpers/wallet-setup";

/** Deliberately not TEST_PIN: matching PINs are what hid this for so long. */
const SECOND_PIN = "424242";

test("a second wallet with its own PIN opens from the lock screen", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();

  // Anything the page logs, so the reported error is evidence, not a guess.
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await pinNetwork(page);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });

  // Wallet one, on TEST_PIN.
  await importTestWalletThroughUi(page);
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({
    timeout: 20000,
  });

  // Wallet two, on a PIN of its own.
  await page.goto(`chrome-extension://${extensionId}/index.html#/add-wallet`);
  await page.locator('[data-roi="add-wallet-create-cta"]').click();

  await expect(page.locator('[data-roi="add-wallet-mnemonic"]')).toBeVisible({
    timeout: 15000,
  });
  const words = await revealAndReadMnemonic(page);
  await page.locator('[data-roi="cta-primary"]').click();

  await expect(page.locator('[data-roi="add-wallet-verify"]')).toBeVisible();
  await fillVerifyWords(page, words);
  await page.locator('[data-roi="verify-cta-primary"]').click();

  // Past the optional name step. Its Continue carries no data-roi.
  await page.getByRole("button", { name: "Continue" }).click();

  await completePinSetup(page, SECOND_PIN);
  await expect(page).toHaveURL(/#\/user/, { timeout: 15000 });
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({
    timeout: 20000,
  });

  // Reload: chrome.storage.session goes, the vault stays. This is what
  // reopening the popup does, and where the report picks up.
  await page.reload();
  await expect(page).toHaveURL(/#\/unlock/, { timeout: 15000 });

  await enterPin(page, SECOND_PIN);

  // The wallet opens, and stays open.
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({
    timeout: 20000,
  });
  await page.waitForTimeout(3000);
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible();

  expect(consoleErrors.join("\n")).not.toContain("Invalid mnemonic phrase");
});
