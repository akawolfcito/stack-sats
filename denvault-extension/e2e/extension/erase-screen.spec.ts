/**
 * The erase confirmation, at popup width.
 *
 * Sally's fourth backlog item said a destructive flow that no visual test
 * ever sees is one that breaks without anyone noticing, and it did: the
 * global `input` rule in main.css caught the acknowledgement checkbox and
 * gave it `width: 100%` and a 40-52px height. Paired with the
 * `flex-shrink: 0` next to it, the box could not give the width back, so
 * it pushed its own label into a one-word column and left the screen with
 * a horizontal scrollbar that clipped the wallet inventory. The two other
 * checkboxes in the app hide their input with `width: 0`, which is why
 * this was the only place it ever showed.
 *
 * Extracting the screen to its own route so a golden could photograph it
 * is still worth doing. This is the cheaper half: Playwright lays the page
 * out for real, so the size and the overflow are both measurable here.
 */

import { test, expect, pinNetwork } from "./fixtures";
import { importTestWalletThroughUi } from "../helpers/wallet-setup";

/** Chrome's action popup is 400px wide, the tightest case. */
const POPUP = { width: 400, height: 600 };

test("the acknowledgement box stays a checkbox and does not overflow the popup", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize(POPUP);
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await pinNetwork(page);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });
  await importTestWalletThroughUi(page);
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({
    timeout: 20000,
  });

  await page.goto(`chrome-extension://${extensionId}/index.html#/usermenu`);
  await page.locator('[data-roi="menu-action-delete"]').click();

  const acknowledgement = page.locator('[data-roi="erase-acknowledge"]');
  await expect(acknowledgement).toBeVisible({ timeout: 10000 });

  // A checkbox is a small square. 100% of a 400px popup is not.
  const box = await acknowledgement.locator("input").boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeLessThan(40);
  expect(box!.height).toBeLessThan(40);

  // The symptom the user reported: the screen scrolled sideways and took
  // the wallet inventory off the left edge with it.
  const overflow = await page.evaluate(() => {
    const el = document.documentElement;
    return el.scrollWidth - el.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);

  // The inventory names what is about to go. It is the fact that stops a
  // hand, so it has to be on screen, not scrolled off it.
  await expect(page.locator('[data-roi="erase-inventory"]')).toBeInViewport();
});

/**
 * The rule itself, probed directly.
 *
 * The test above measures the screen, and the screen now pins its own
 * checkbox size — so it stays green even if the global rule goes back to
 * catching checkboxes, and a future native checkbox elsewhere would break
 * with nothing to catch it. This one asks the cascade the question with
 * no local override in the way.
 */
test("the global input rule leaves checkboxes alone", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.setViewportSize(POPUP);
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });

  const sizes = await page.evaluate(() => {
    const probe = document.createElement("input");
    probe.type = "checkbox";
    document.body.appendChild(probe);
    const { width, height } = probe.getBoundingClientRect();
    probe.remove();
    return { width, height };
  });

  // Whatever the browser default checkbox is, it is nowhere near a
  // full-width control: with the rule unscoped this probe measures 400.
  expect(sizes.width).toBeLessThan(40);
  expect(sizes.height).toBeLessThan(40);
});
