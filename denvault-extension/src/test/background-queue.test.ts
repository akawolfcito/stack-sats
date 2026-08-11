/**
 * Vitest harness for public/background.js
 *
 * Loads the service worker script in a sandboxed Function and exercises
 * the message dispatcher with a mocked chrome.* API. Targets the contract
 * between popup and background introduced for P0-3 (canonical params)
 * and P1-4 (explicit mismatch error).
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BACKGROUND_PATH = resolve(__dirname, "../../public/background.js");
const BACKGROUND_SOURCE = readFileSync(BACKGROUND_PATH, "utf-8");

type Listener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => unknown;

interface ChromeHarness {
  messageListeners: Listener[];
  windowsRemovedListeners: Array<(id: number) => void>;
  tabsSendMessage: ReturnType<typeof vi.fn>;
  runtimeSendMessage: ReturnType<typeof vi.fn>;
  windowsCreate: ReturnType<typeof vi.fn>;
  storageSessionGet: ReturnType<typeof vi.fn>;
  storageSessionSet: ReturnType<typeof vi.fn>;
}

function installChromeMock(): ChromeHarness {
  const messageListeners: Listener[] = [];
  const windowsRemovedListeners: Array<(id: number) => void> = [];

  const tabsSendMessage = vi.fn().mockResolvedValue(undefined);
  const runtimeSendMessage = vi.fn().mockResolvedValue(undefined);
  const windowsCreate = vi.fn().mockResolvedValue({ id: 99 });
  const storageSessionGet = vi.fn().mockResolvedValue({});
  const storageSessionSet = vi.fn().mockResolvedValue(undefined);

  const chromeMock = {
    runtime: {
      id: "denvault-test",
      getURL: (p: string) => `chrome-extension://test/${p}`,
      sendMessage: runtimeSendMessage,
      onMessage: {
        addListener: (l: Listener) => {
          messageListeners.push(l);
        },
        removeListener: vi.fn(),
      },
    },
    tabs: {
      sendMessage: tabsSendMessage,
      query: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      remove: vi.fn(),
      getCurrent: vi.fn(),
    },
    windows: {
      create: windowsCreate,
      get: vi.fn().mockResolvedValue({ id: 99 }),
      update: vi.fn().mockResolvedValue({}),
      onRemoved: {
        addListener: (l: (id: number) => void) => {
          windowsRemovedListeners.push(l);
        },
      },
    },
    storage: {
      session: {
        get: storageSessionGet,
        set: storageSessionSet,
        remove: vi.fn().mockResolvedValue(undefined),
      },
    },
    sidePanel: {
      setOptions: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(undefined),
    },
  };

  (globalThis as unknown as { chrome: unknown }).chrome = chromeMock;

  return {
    messageListeners,
    windowsRemovedListeners,
    tabsSendMessage,
    runtimeSendMessage,
    windowsCreate,
    storageSessionGet,
    storageSessionSet,
  };
}

function loadBackground(): void {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(BACKGROUND_SOURCE)();
}

interface DispatchOptions {
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  origin?: string;
  tabId?: number;
}

/**
 * Simulate a dApp request reaching background via the content-script
 * message listener. Returns the listener's tabs.sendMessage spy so the
 * caller can verify the JSON-RPC envelope sent back to the page.
 */
async function dispatchDappRequest(
  harness: ChromeHarness,
  opts: DispatchOptions = {}
): Promise<{ id: string; sender: { tab: { id: number }; origin: string } }> {
  const id = opts.id ?? "rpc-1";
  const method = opts.method ?? "stx_transferStx";
  const params = opts.params ?? { recipient: "ST123", amount: "100" };
  const origin = opts.origin ?? "https://app.example.com";
  const tabId = opts.tabId ?? 42;

  // Background registers two listeners; the second one (index 1) is the
  // content-script handler that enqueues incoming dApp requests.
  const contentListener = harness.messageListeners[1];
  if (!contentListener) {
    throw new Error("content-script listener not registered");
  }

  const sender = {
    tab: { id: tabId },
    origin,
    id: "denvault-test",
  };

  contentListener(
    { jsonrpc: "2.0", id, method, params },
    sender,
    () => undefined
  );

  // Allow microtasks (window create + sendToUI) to flush.
  await Promise.resolve();
  await Promise.resolve();

  return { id, sender };
}

/**
 * Simulate a popup → background message via runtime.onMessage. The popup
 * messages are routed by the first registered listener (no sender.tab).
 */
function dispatchPopupMessage(
  harness: ChromeHarness,
  message: unknown,
  sendResponse: (response?: unknown) => void = () => undefined
): unknown {
  const popupListener = harness.messageListeners[0];
  if (!popupListener) {
    throw new Error("popup listener not registered");
  }
  return popupListener(message, { id: "denvault-test" }, sendResponse);
}

describe("background queue: canonical params + explicit mismatch", () => {
  let harness: ChromeHarness;

  beforeEach(() => {
    harness = installChromeMock();
    loadBackground();
  });

  describe("GET_ACTIVE_REQUEST", () => {
    it("returns canonical params for the active request", async () => {
      await dispatchDappRequest(harness, {
        id: "req-canonical",
        method: "stx_transferStx",
        params: { recipient: "ST_CANONICAL", amount: "1000000" },
        origin: "https://canonical.example",
      });

      // UI signals ready so any pending sendToUI is flushed.
      dispatchPopupMessage(harness, { type: "UI_READY" });

      const sendResponse = vi.fn();
      const result = dispatchPopupMessage(
        harness,
        { type: "GET_ACTIVE_REQUEST", requestId: "req-canonical" },
        sendResponse
      );

      // Listener must keep channel open for async sendResponse.
      expect(result).toBe(true);
      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as {
        ok: boolean;
        request?: {
          id: string;
          method: string;
          params: Record<string, unknown>;
          origin: string;
        };
      };
      expect(response.ok).toBe(true);
      expect(response.request).toEqual({
        id: "req-canonical",
        method: "stx_transferStx",
        params: { recipient: "ST_CANONICAL", amount: "1000000" },
        origin: "https://canonical.example",
      });
    });

    it("returns ok:false when there is no active request", () => {
      const sendResponse = vi.fn();
      dispatchPopupMessage(
        harness,
        { type: "GET_ACTIVE_REQUEST", requestId: "missing" },
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledTimes(1);
      const response = sendResponse.mock.calls[0][0] as {
        ok: boolean;
        error?: { code: number; message: string };
      };
      expect(response.ok).toBe(false);
      expect(response.error?.code).toBe(4002);
    });

    it("returns ok:false when the requestId does not match the active one", async () => {
      await dispatchDappRequest(harness, { id: "req-A" });

      const sendResponse = vi.fn();
      dispatchPopupMessage(
        harness,
        { type: "GET_ACTIVE_REQUEST", requestId: "req-DIFFERENT" },
        sendResponse
      );

      const response = sendResponse.mock.calls[0][0] as {
        ok: boolean;
        error?: { code: number; message: string };
      };
      expect(response.ok).toBe(false);
      expect(response.error?.code).toBe(4002);
      expect(response.error?.message).toMatch(/expired|no longer active|mismatch/i);
    });
  });

  describe("DAPP_APPROVE — explicit mismatch error (P1-4)", () => {
    it("dispatches DAPP_RESPONSE_ERROR to the popup when requestId mismatches", async () => {
      await dispatchDappRequest(harness, { id: "req-real" });
      dispatchPopupMessage(harness, { type: "UI_READY" });

      harness.runtimeSendMessage.mockClear();
      harness.tabsSendMessage.mockClear();

      dispatchPopupMessage(harness, {
        type: "DAPP_APPROVE",
        id: "req-WRONG",
        result: { addresses: [] },
      });

      // Background must surface an explicit error to the popup.
      expect(harness.runtimeSendMessage).toHaveBeenCalledTimes(1);
      const errorMessage = harness.runtimeSendMessage.mock.calls[0][0] as {
        type: string;
        requestId: string;
        error: { code: number; message: string };
      };
      expect(errorMessage.type).toBe("DAPP_RESPONSE_ERROR");
      expect(errorMessage.requestId).toBe("req-WRONG");
      expect(errorMessage.error.code).toBe(4002);
      expect(errorMessage.error.message).toMatch(/expired|no longer active|mismatch/i);

      // The dApp tab must NOT receive the popup's payload.
      expect(harness.tabsSendMessage).not.toHaveBeenCalled();
    });

    it("preserves the active request after a mismatched approve", async () => {
      await dispatchDappRequest(harness, { id: "req-keep" });
      dispatchPopupMessage(harness, { type: "UI_READY" });

      dispatchPopupMessage(harness, {
        type: "DAPP_APPROVE",
        id: "stale-id",
        result: { foo: "bar" },
      });

      // Active request still resolvable via canonical IPC.
      const sendResponse = vi.fn();
      dispatchPopupMessage(
        harness,
        { type: "GET_ACTIVE_REQUEST", requestId: "req-keep" },
        sendResponse
      );
      const response = sendResponse.mock.calls[0][0] as { ok: boolean };
      expect(response.ok).toBe(true);
    });

    it("forwards the result to the dApp tab when requestId matches", async () => {
      const { sender } = await dispatchDappRequest(harness, { id: "req-good" });
      dispatchPopupMessage(harness, { type: "UI_READY" });

      harness.tabsSendMessage.mockClear();

      dispatchPopupMessage(harness, {
        type: "DAPP_APPROVE",
        id: "req-good",
        result: { addresses: [{ symbol: "STX", address: "ST_OK" }] },
      });

      expect(harness.tabsSendMessage).toHaveBeenCalledTimes(1);
      const [tabId, body] = harness.tabsSendMessage.mock.calls[0];
      expect(tabId).toBe(sender.tab.id);
      expect(body).toMatchObject({
        jsonrpc: "2.0",
        id: "req-good",
        result: { addresses: [{ symbol: "STX", address: "ST_OK" }] },
      });
    });

    it("rejects double approve (request already resolved)", async () => {
      await dispatchDappRequest(harness, { id: "req-once" });
      dispatchPopupMessage(harness, { type: "UI_READY" });

      // First approve consumes the request.
      dispatchPopupMessage(harness, {
        type: "DAPP_APPROVE",
        id: "req-once",
        result: { addresses: [] },
      });

      harness.runtimeSendMessage.mockClear();
      harness.tabsSendMessage.mockClear();

      // Second approve for same id should not reach the dApp tab.
      dispatchPopupMessage(harness, {
        type: "DAPP_APPROVE",
        id: "req-once",
        result: { tampered: true },
      });

      expect(harness.tabsSendMessage).not.toHaveBeenCalled();
      // Background should explicitly tell the popup the request is gone.
      expect(harness.runtimeSendMessage).toHaveBeenCalled();
      const errorMessage = harness.runtimeSendMessage.mock.calls[0][0] as {
        type: string;
        error: { code: number };
      };
      expect(errorMessage.type).toBe("DAPP_RESPONSE_ERROR");
      expect(errorMessage.error.code).toBe(4002);
    });
  });

  describe("DAPP_REJECT — explicit mismatch error", () => {
    it("dispatches DAPP_RESPONSE_ERROR for mismatched reject", async () => {
      await dispatchDappRequest(harness, { id: "req-reject" });
      dispatchPopupMessage(harness, { type: "UI_READY" });

      harness.runtimeSendMessage.mockClear();

      dispatchPopupMessage(harness, {
        type: "DAPP_REJECT",
        id: "wrong-reject",
      });

      expect(harness.runtimeSendMessage).toHaveBeenCalled();
      const errorMessage = harness.runtimeSendMessage.mock.calls[0][0] as {
        type: string;
        requestId: string;
      };
      expect(errorMessage.type).toBe("DAPP_RESPONSE_ERROR");
      expect(errorMessage.requestId).toBe("wrong-reject");
    });

    it("forwards rejection envelope when requestId matches", async () => {
      const { sender } = await dispatchDappRequest(harness, { id: "req-r-good" });
      dispatchPopupMessage(harness, { type: "UI_READY" });

      harness.tabsSendMessage.mockClear();

      dispatchPopupMessage(harness, {
        type: "DAPP_REJECT",
        id: "req-r-good",
        error: { code: 4001, message: "User rejected the request" },
      });

      expect(harness.tabsSendMessage).toHaveBeenCalledTimes(1);
      const [tabId, body] = harness.tabsSendMessage.mock.calls[0];
      expect(tabId).toBe(sender.tab.id);
      expect(body).toMatchObject({
        jsonrpc: "2.0",
        id: "req-r-good",
        error: { code: 4001 },
      });
    });
  });
});
