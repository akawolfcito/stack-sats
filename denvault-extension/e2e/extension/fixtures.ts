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

import { test as base, chromium, type BrowserContext, type Page, type Worker } from "@playwright/test";
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

/**
 * The network these specs run on, and the address prefix it produces.
 *
 * A fresh Chrome profile has an empty localStorage, and a wallet with
 * nothing stored defaults to mainnet — deliberately, since `6caddce`, and
 * fixed by src/utils/network/index.test.ts. These specs used to inherit
 * that default while hard-coding `/^ST/` beside it, so the day the default
 * moved every address assertion failed against a wallet that was behaving
 * correctly. A test that does not choose its own network is a test that
 * reports someone else's decision as its own failure.
 *
 * Pinning it here is what golden-matrix, golden-roi and store-screenshots
 * already do. The prefix is derived so the two can never drift apart.
 */
export const TEST_NETWORK = "testnet" as const;

const ADDRESS_PREFIXES = { testnet: "ST", mainnet: "SP" } as const;

/** The prefix a TEST_NETWORK address starts with. */
export const ADDRESS_PREFIX = ADDRESS_PREFIXES[TEST_NETWORK];

/** A full TEST_NETWORK address, anchored at both ends. */
export const ADDRESS_PATTERN = new RegExp(`^${ADDRESS_PREFIX}[0-9A-Z]{38,}$`);

/**
 * Pin the network before the wallet derives a single address.
 *
 * localStorage is per-origin, so this has to run on an extension page. The
 * reload is what makes it stick: anything that read the network at mount
 * would otherwise keep the default it started with.
 */
export async function pinNetwork(page: Page): Promise<void> {
  await page.evaluate(
    (network) => localStorage.setItem("selected_network", network),
    TEST_NETWORK
  );
  await page.reload();
}
