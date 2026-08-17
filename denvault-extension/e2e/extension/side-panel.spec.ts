/**
 * The side panel entry point, against the real loaded extension.
 *
 * The panel is where background delivers a dApp approval when it shares a
 * window with the requesting tab, and it is usually already unlocked. That
 * only helps if the user can open it: until this button existed the sole
 * way in was Chrome's own extensions menu.
 *
 * Playwright does not expose a side panel as a page, so the assertion is
 * on the call: that chrome.sidePanel.open() runs with the right window and
 * that Chrome accepts the gesture, which is what fails when the call is
 * moved out of the click handler. The fallback path is covered by
 * src/composables/useSidePanel.test.ts.
 */

import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures";
import { TEST_PIN, importTestWalletThroughUi } from "../helpers/wallet-setup";

interface SidePanelCall {
  method: "setOptions" | "open";
  args: { path?: string; enabled?: boolean; windowId?: number };
  rejected?: string;
}

/** Record what the page asks of chrome.sidePanel, without blocking it. */
async function recordSidePanelCalls(page: Page): Promise<void> {
  await page.evaluate(() => {
    const scope = window as unknown as { __sidePanelCalls: unknown[] };
    scope.__sidePanelCalls = [];

    const track = (method: string, original: (arg: unknown) => Promise<unknown>) => {
      return async (arg: unknown) => {
        const entry: Record<string, unknown> = { method, args: arg };
        scope.__sidePanelCalls.push(entry);
        try {
          return await original(arg);
        } catch (error) {
          entry.rejected = String(error);
          throw error;
        }
      };
    };

    const api = chrome.sidePanel as unknown as Record<string, unknown>;
    api.setOptions = track("setOptions", (api.setOptions as never));
    api.open = track("open", (api.open as never));
  });
}

test("the Home header opens the wallet in the side panel", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });
  await importTestWalletThroughUi(page);
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({
    timeout: 20000,
  });

  await recordSidePanelCalls(page);

  const entry = page.locator('[data-roi="home-sidepanel"]');
  await expect(entry).toBeVisible();
  await entry.click();

  const calls = await page.waitForFunction(() => {
    const scope = window as unknown as { __sidePanelCalls: unknown[] };
    return scope.__sidePanelCalls.length >= 2 ? scope.__sidePanelCalls : null;
  });
  const recorded = (await calls.jsonValue()) as SidePanelCall[];

  const setOptions = recorded.find((call) => call.method === "setOptions");
  expect(setOptions?.args.enabled).toBe(true);
  expect(setOptions?.args.path).toBe("index.html?view=sidepanel");

  const open = recorded.find((call) => call.method === "open");
  expect(typeof open?.args.windowId).toBe("number");
  // Chrome refuses this outside a user gesture. Moving the call behind a
  // message to the service worker is exactly how that gesture gets lost.
  expect(open?.rejected).toBeUndefined();
});

test("the Home header copies the address on screen", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });
  await importTestWalletThroughUi(page);
  await expect(page.locator('[data-roi="home-screen"]')).toBeVisible({
    timeout: 20000,
  });

  // The address lives in the balance block now, as the copy target
  // itself, so the label of the control is the address.
  const shown = await page
    .locator('[data-roi="home-copy-address"]')
    .innerText();

  // Chrome refuses clipboard permissions on a chrome-extension:// origin,
  // which is an opaque origin, so the write is recorded instead of read
  // back. What matters here is the value the wallet hands over.
  await page.evaluate(() => {
    const scope = window as unknown as { __copied?: string };
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          scope.__copied = text;
        },
      },
    });
  });

  await page.locator('[data-roi="home-copy-address"]').click();

  const clipboard = await page.evaluate(
    () => (window as unknown as { __copied?: string }).__copied ?? ""
  );
  expect(clipboard).toMatch(/^ST[0-9A-Z]{38,}$/);

  // The header shows a truncated form of the same address, so the copy
  // cannot be of some other account.
  const [head] = shown.match(/ST[0-9A-Z]{4,}/) ?? [];
  expect(clipboard.startsWith(head ?? "never")).toBe(true);

  // The chip names the chain, because this wallet holds two and the
  // Bitcoin send screen is one Paste away from the wrong one.
  expect(shown).toContain("STX");

  // Feedback in words, not just a 16px icon swap.
  await expect(page.locator('[data-roi="home-copy-address"]')).toContainText(
    "copied"
  );
});

test("the panel does not offer to open itself", async ({
  context,
  extensionId,
}) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/index.html`);
  await expect(page.locator('[data-roi="start-hero"]')).toBeVisible({
    timeout: 20000,
  });
  await importTestWalletThroughUi(page);

  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/index.html?view=sidepanel`);

  const pinInput = panel.locator('[data-roi="pin-input"]').first();
  await expect(pinInput).toBeVisible({ timeout: 20000 });
  await pinInput.focus();
  for (const digit of TEST_PIN) {
    await panel.keyboard.press(digit);
  }

  await expect(panel.locator('[data-roi="home-screen"]')).toBeVisible({
    timeout: 20000,
  });
  await expect(panel.locator('[data-roi="home-sidepanel"]')).toHaveCount(0);
});
