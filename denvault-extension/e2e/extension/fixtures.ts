/**
 * Fixtures that load the real built extension.
 *
 * Every other spec in e2e/ runs against the Vite dev server as an ordinary
 * page with a mocked `chrome.*` — which means background.js never runs as
 * a service worker and the content-script bridge is never exercised. These
 * fixtures close that gap: Chromium boots with `dist/` loaded, so the
 * tests see the actual worker, the actual injected page API, and the
 * actual popup.
 *
 * Requires a build first — `pnpm test:e2e:extension` does it for you.
 */

import { test as base, chromium, type BrowserContext, type Worker } from "@playwright/test";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.join(__dirname, "../../dist");

export const test = base.extend<{
  context: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
}>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext("", {
      // The chromium channel is what lets extensions run headless.
      channel: "chromium",
      args: [
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    let [worker] = context.serviceWorkers();
    if (!worker) {
      worker = await context.waitForEvent("serviceworker");
    }
    await use(worker);
  },

  extensionId: async ({ serviceWorker }, use) => {
    // chrome-extension://<id>/background.js
    await use(serviceWorker.url().split("/")[2]);
  },
});

export const expect = test.expect;

/**
 * Serve a fake dApp over https.
 *
 * The content script matches `https://*\/*`, so an http://localhost page
 * would never get the bridge injected. Fulfilling an https URL keeps the
 * match while staying offline.
 */
export async function openDapp(context: BrowserContext, origin = "https://dapp.test") {
  const page = await context.newPage();
  await page.route(`${origin}/**`, (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<!DOCTYPE html><html><body><h1>Test dApp</h1></body></html>",
    })
  );
  await page.goto(`${origin}/`);

  // content.js injects injection.js as a module script, which resolves
  // asynchronously — reading window.StacksWallet right after goto races it.
  await page.waitForFunction(
    () => Boolean((window as unknown as { StacksWallet?: unknown }).StacksWallet),
    undefined,
    { timeout: 15000 }
  );

  return page;
}
