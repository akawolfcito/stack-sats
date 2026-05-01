import type { Page } from "@playwright/test";

/**
 * Clear in-page storage layers used by DenVault.
 *
 * The Vite dev server has no `chrome.storage` API, so the WalletVault falls
 * back to `localStorage`. We try both to keep the helper safe against future
 * environments where chrome.storage is shimmed.
 */
export async function clearStorage(page: Page): Promise<void> {
  await page.evaluate(async () => {
    localStorage.clear();
    type ChromeLike = {
      storage?: { local?: { clear?: () => Promise<void> } };
    };
    const maybeChrome = (globalThis as unknown as { chrome?: ChromeLike })
      .chrome;
    if (maybeChrome?.storage?.local?.clear) {
      try {
        await maybeChrome.storage.local.clear();
      } catch {
        // localStorage fallback is sufficient for the dev server.
      }
    }
  });
}

/**
 * Navigate to a hash-based route after clearing storage and reloading.
 * Default route is `/` (StartView).
 */
export async function gotoFresh(page: Page, route = "/"): Promise<void> {
  await page.goto(route);
  await clearStorage(page);
  await page.reload();
  await page.waitForLoadState("networkidle");
}
