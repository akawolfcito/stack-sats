/**
 * The Home header at popup width.
 *
 * Nothing was watching this size. Adding the copy button pushed the
 * network chip and the two view buttons past the right edge of a 400px
 * popup, and it took a screenshot from a real session to notice: the
 * extension e2e runs at 1280px, and no golden covers this screen either.
 */

import { test, expect, pinNetwork } from "./fixtures";
import { importTestWalletThroughUi } from "../helpers/wallet-setup";

/** Chrome's action popup is 400px wide. */
const POPUP = { width: 400, height: 600 };

test("every header control fits inside the popup", async ({
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

  const header = page.locator(".header").first();
  await expect(header).toBeVisible();

  // The account pill truncates, so the row has a way to fit. If anything
  // else refuses to yield, this overflows.
  const overflow = await header.evaluate((element) => ({
    scrollWidth: element.scrollWidth,
    clientWidth: element.clientWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

  // The pill has to clip its own label rather than spill over its box:
  // that overflow is what read as a collision with the next control.
  const pill = await page
    .locator('[data-roi="acctsw-trigger"]')
    .evaluate((element) => ({
      scrollWidth: element.scrollWidth,
      clientWidth: element.clientWidth,
    }));
  expect(pill.scrollWidth).toBeLessThanOrEqual(pill.clientWidth + 1);

  // And every control is actually on screen, not clipped at the edge.
  for (const roi of ["acctsw-trigger", "home-copy-address", "home-sidepanel"]) {
    const control = page.locator(`[data-roi="${roi}"]`);
    await expect(control).toBeVisible();
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(POPUP.width);
  }
});
