import type { Page } from "@playwright/test";

/**
 * Captured RPC response sent by the wallet for an inbound dApp request.
 * In legacy mode the wallet calls `chrome.tabs.sendMessage(tabId, body)`.
 */
export interface CapturedRpcResponse {
  tabId: number;
  body: unknown;
}

declare global {
  interface Window {
    __rpcResponses?: CapturedRpcResponse[];
  }
}

/**
 * Install a minimal `chrome.*` shim before app code runs. The Vite dev
 * server has no extension APIs, so without this shim Confirmation.vue would
 * throw when trying to ship the RPC response back to the page that issued
 * the request.
 *
 * The shim:
 *   - records every `chrome.tabs.sendMessage(tabId, body)` call into
 *     `window.__rpcResponses`
 *   - no-ops `chrome.storage.session.set` (used to cache getAddresses)
 *   - no-ops `chrome.runtime.sendMessage` and listener registrations
 *   - neutralises `chrome.tabs.getCurrent` / `chrome.tabs.remove` so the
 *     auto-close logic does not try to terminate the test page
 *   - replaces `window.close` with a no-op for the same reason
 */
export async function installChromeShim(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const noop = () => undefined;

    type Sender = { id: string };
    type RuntimeMessageListener = (
      message: unknown,
      sender: Sender,
      sendResponse: (response?: unknown) => void,
    ) => void;

    window.__rpcResponses = [];

    const fakeChrome = {
      runtime: {
        id: "denvault-test",
        sendMessage: noop,
        onMessage: {
          addListener: (_listener: RuntimeMessageListener) => undefined,
          removeListener: noop,
        },
      },
      tabs: {
        sendMessage: (tabId: number, body: unknown): Promise<void> => {
          window.__rpcResponses!.push({ tabId, body });
          return Promise.resolve();
        },
        getCurrent: (callback: (tab?: { id?: number }) => void) => {
          callback(undefined);
        },
        remove: noop,
      },
      storage: {
        local: {
          get: (_key: unknown, callback: (result: unknown) => void) => {
            callback({});
          },
          set: (_items: unknown, callback?: () => void) => {
            callback?.();
          },
          clear: () => Promise.resolve(),
          remove: () => Promise.resolve(),
        },
        session: {
          get: (_key: unknown, callback: (result: unknown) => void) => {
            callback({});
          },
          set: (_items: unknown) => Promise.resolve(),
        },
      },
    };

    Object.defineProperty(window, "chrome", {
      value: fakeChrome,
      writable: true,
      configurable: true,
    });

    // Confirmation.vue closes the popup ~150ms after a successful response.
    // In Playwright that closes the test page; replace with a no-op.
    window.close = noop;
  });
}

/**
 * Read all captured RPC responses for the current page.
 */
export async function getCapturedResponses(
  page: Page,
): Promise<CapturedRpcResponse[]> {
  return page.evaluate(() => window.__rpcResponses ?? []);
}

/**
 * Wait until the wallet has emitted at least one RPC response.
 */
export async function waitForFirstResponse(
  page: Page,
  timeoutMs = 10_000,
): Promise<CapturedRpcResponse> {
  await page.waitForFunction(
    () => (window.__rpcResponses?.length ?? 0) > 0,
    null,
    { timeout: timeoutMs },
  );
  const responses = await getCapturedResponses(page);
  return responses[0];
}
