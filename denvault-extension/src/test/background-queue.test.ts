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

/** Mirrors chrome.runtime.id in the mock below. */
const EXTENSION_ID = "denvault-test";
const EXTENSION_ORIGIN = `chrome-extension://${EXTENSION_ID}`;
/** The queue popup window carries a tab id, like any other window. */
const POPUP_TAB_ID = 7;
/** Window hosting the dApp tab that makes the requests. */
const DAPP_WINDOW_ID = 500;

type Listener = (
  message: unknown,
  sender: unknown,
  sendResponse: (response?: unknown) => void
) => unknown;

interface PortMock {
  name: string;
  sender?: { origin?: string; url?: string; tab?: { id: number } };
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onMessage: { addListener: ReturnType<typeof vi.fn> };
  onDisconnect: { addListener: ReturnType<typeof vi.fn> };
}

type ConnectListener = (port: PortMock) => void;

interface ChromeHarness {
  messageListeners: Listener[];
  connectListeners: ConnectListener[];
  tabsGet: ReturnType<typeof vi.fn>;
  windowsRemovedListeners: Array<(id: number) => void>;
  tabsSendMessage: ReturnType<typeof vi.fn>;
  runtimeSendMessage: ReturnType<typeof vi.fn>;
  windowsCreate: ReturnType<typeof vi.fn>;
  storageSessionGet: ReturnType<typeof vi.fn>;
  storageSessionSet: ReturnType<typeof vi.fn>;
}

function installChromeMock(): ChromeHarness {
  const messageListeners: Listener[] = [];
  const connectListeners: ConnectListener[] = [];
  const windowsRemovedListeners: Array<(id: number) => void> = [];

  const tabsSendMessage = vi.fn().mockResolvedValue(undefined);
  const runtimeSendMessage = vi.fn().mockResolvedValue(undefined);
  const windowsCreate = vi.fn().mockResolvedValue({ id: 99 });
  const tabsGet = vi.fn().mockResolvedValue({ id: 42, windowId: DAPP_WINDOW_ID });
  const storageSessionGet = vi.fn().mockResolvedValue({});
  const storageSessionSet = vi.fn().mockResolvedValue(undefined);

  const chromeMock = {
    runtime: {
      id: EXTENSION_ID,
      getURL: (p: string) => `chrome-extension://test/${p}`,
      sendMessage: runtimeSendMessage,
      onMessage: {
        addListener: (l: Listener) => {
          messageListeners.push(l);
        },
        removeListener: vi.fn(),
      },
      onConnect: {
        addListener: (l: ConnectListener) => {
          connectListeners.push(l);
        },
      },
    },
    tabs: {
      sendMessage: tabsSendMessage,
      get: tabsGet,
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
    connectListeners,
    tabsGet,
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
    id: EXTENSION_ID,
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
 * Simulate a popup → background message via runtime.onMessage.
 *
 * The queue popup is opened with chrome.windows.create({ type: "popup" }),
 * so it is a real window with a real tab and its messages carry
 * sender.tab, same as a content script's. Chrome then offers the message
 * to every registered listener, so this helper does too: which listener
 * picks it up is exactly what is under test here. See H7 in
 * docs/handoff/smoke-1.1.3-hallazgos.md.
 */
function dispatchPopupMessage(
  harness: ChromeHarness,
  message: unknown,
  sendResponse: (response?: unknown) => void = () => undefined
): unknown {
  if (harness.messageListeners.length === 0) {
    throw new Error("no message listener registered");
  }

  const sender = {
    id: EXTENSION_ID,
    tab: { id: POPUP_TAB_ID },
    origin: EXTENSION_ORIGIN,
    url: `${EXTENSION_ORIGIN}/index.html?mode=queue`,
  };

  let handled: unknown;
  for (const listener of harness.messageListeners) {
    const result = listener(message, sender, sendResponse);
    if (result !== undefined) {
      handled = result;
    }
  }
  return handled;
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

    it("delivers addresses one level deep, the way the dApp reads them", async () => {
      const { sender } = await dispatchDappRequest(harness, {
        id: "req-shape",
        method: "getAddresses",
        params: {},
      });
      dispatchPopupMessage(harness, { type: "UI_READY" });
      harness.tabsSendMessage.mockClear();

      // What the popup sends after toQueueApproveResult unwraps the
      // handler's envelope. Sending the envelope itself would nest it.
      dispatchPopupMessage(harness, {
        type: "DAPP_APPROVE",
        id: "req-shape",
        result: {
          addresses: [{ symbol: "STX", address: "ST_SHAPE", publicKey: "pk" }],
          network: { name: "testnet", chainId: 2147483648 },
        },
      });

      const [tabId, body] = harness.tabsSendMessage.mock.calls[0];
      expect(tabId).toBe(sender.tab.id);
      const envelope = body as { result: Record<string, unknown> };
      // @stacks/connect reads response.result.addresses and throws
      // "No STX address found in response" when it is not there.
      expect(envelope.result.addresses).toEqual([
        { symbol: "STX", address: "ST_SHAPE", publicKey: "pk" },
      ]);
      expect(envelope.result).not.toHaveProperty("result");
      expect(envelope.result).not.toHaveProperty("jsonrpc");
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

  /**
   * The wallet used to advertise four methods it could not perform. A
   * dApp calling one got a full approval screen, entered its PIN, and
   * then received -32603 Internal Error. Rejecting at the background
   * boundary is what makes it enforceable — injection.js can be bypassed
   * because content.js relays any well-formed event.
   */
  describe("unsupported methods", () => {
    function dispatchRaw(method: string) {
      const contentListener = harness.messageListeners[1];
      const sendResponse = vi.fn();
      contentListener(
        { jsonrpc: "2.0", id: "rpc-unsupported", method, params: {} },
        { tab: { id: 7 }, origin: "https://app.example.com", id: EXTENSION_ID },
        sendResponse
      );
      return sendResponse;
    }

    it.each([
      "signPsbt",
      "sendTransfer",
      "stx_signTransaction",
      "stx_transferSip10Ft",
    ])("rejects %s with -32601 and never opens a popup", (method) => {
      const sendResponse = dispatchRaw(method);

      expect(sendResponse).toHaveBeenCalledTimes(1);
      expect(sendResponse.mock.calls[0][0]).toMatchObject({
        jsonrpc: "2.0",
        id: "rpc-unsupported",
        error: { code: -32601 },
      });

      // The whole point: the user is never asked to approve something
      // that cannot complete.
      expect(harness.windowsCreate).not.toHaveBeenCalled();
    });

    it("rejects an entirely unknown method", () => {
      const sendResponse = dispatchRaw("stx_drainWallet");

      expect(sendResponse.mock.calls[0][0]).toMatchObject({
        error: { code: -32601 },
      });
      expect(harness.windowsCreate).not.toHaveBeenCalled();
    });

    it("still accepts an implemented method", () => {
      const sendResponse = dispatchRaw("stx_transferStx");

      // No immediate error response: the request proceeds to the queue.
      const rejected = sendResponse.mock.calls.some(
        (call) => (call[0] as { error?: { code: number } })?.error?.code === -32601
      );
      expect(rejected).toBe(false);
    });
  });

  describe("H11 — keepalive port from the approval window", () => {
    function makePort(overrides: Partial<PortMock> = {}): PortMock {
      return {
        name: "denvault-keepalive",
        sender: { origin: EXTENSION_ORIGIN, tab: { id: POPUP_TAB_ID } },
        postMessage: vi.fn(),
        disconnect: vi.fn(),
        onMessage: { addListener: vi.fn() },
        onDisconnect: { addListener: vi.fn() },
        ...overrides,
      };
    }

    it("registers an onConnect listener", () => {
      expect(harness.connectListeners.length).toBeGreaterThan(0);
    });

    it("accepts the port from our own approval window", () => {
      const port = makePort();

      harness.connectListeners[0](port);

      // Holding the port open is what keeps the worker, and with it the
      // in-memory queue, alive while the user types a PIN.
      expect(port.disconnect).not.toHaveBeenCalled();
      expect(port.onMessage.addListener).toHaveBeenCalled();
    });

    it("drops a keepalive port from anywhere else", () => {
      const port = makePort({
        sender: { origin: "https://app.example.com", tab: { id: 42 } },
      });

      harness.connectListeners[0](port);

      expect(port.disconnect).toHaveBeenCalledTimes(1);
      expect(port.onMessage.addListener).not.toHaveBeenCalled();
    });

    it("ignores ports with another name", () => {
      const port = makePort({ name: "something-else" });

      harness.connectListeners[0](port);

      expect(port.disconnect).not.toHaveBeenCalled();
      expect(port.onMessage.addListener).not.toHaveBeenCalled();
    });
  });

  describe("side panel as the approval surface", () => {
    function connectSurface(
      surface: "queue" | "sidepanel",
      windowId: number | undefined = DAPP_WINDOW_ID
    ): { port: PortMock; disconnect: () => void } {
      const port: PortMock = {
        name: "denvault-keepalive",
        sender: { origin: EXTENSION_ORIGIN, tab: { id: POPUP_TAB_ID } },
        postMessage: vi.fn(),
        disconnect: vi.fn(),
        onMessage: { addListener: vi.fn() },
        onDisconnect: { addListener: vi.fn() },
      };

      harness.connectListeners[0](port);

      const onMessage = port.onMessage.addListener.mock.calls[0]?.[0] as (
        message: unknown
      ) => void;
      onMessage({ type: "SURFACE_HELLO", surface, windowId });

      const onDisconnect = port.onDisconnect.addListener.mock
        .calls[0]?.[0] as () => void;

      return { port, disconnect: onDisconnect };
    }

    it("delivers to an open side panel instead of opening a window", async () => {
      connectSurface("sidepanel");

      await dispatchDappRequest(harness, { id: "req-panel" });

      // The panel is already on screen, and often already unlocked. Opening
      // a second window on top of it is the behaviour being replaced.
      expect(harness.windowsCreate).not.toHaveBeenCalled();
      expect(harness.runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "DAPP_REQUEST",
          payload: expect.objectContaining({ id: "req-panel" }),
        })
      );
    });

    it("opens the window when the panel sits in another window", async () => {
      connectSurface("sidepanel", DAPP_WINDOW_ID + 1);

      await dispatchDappRequest(harness, { id: "req-elsewhere" });

      // Routing there would put the approval on a screen the user is not
      // looking at, which is worse than a popup in front of them.
      expect(harness.windowsCreate).toHaveBeenCalledTimes(1);
    });

    it("opens the window when no side panel is connected", async () => {
      await dispatchDappRequest(harness, { id: "req-nopanel" });

      expect(harness.windowsCreate).toHaveBeenCalledTimes(1);
    });

    it("ignores a queue window claiming to be a surface", async () => {
      connectSurface("queue");

      await dispatchDappRequest(harness, { id: "req-queue-surface" });

      expect(harness.windowsCreate).toHaveBeenCalledTimes(1);
    });

    it("forgets the panel once it closes", async () => {
      const { disconnect } = connectSurface("sidepanel");
      disconnect();

      await dispatchDappRequest(harness, { id: "req-after-close" });

      expect(harness.windowsCreate).toHaveBeenCalledTimes(1);
    });
  });

  it("survives a decision that lands while the surface is being prepared", async () => {
    // Preparing a surface is asynchronous. Reading activeRequest after the
    // await threw "Cannot read properties of null" whenever the request
    // resolved first.
    const { sender } = await dispatchDappRequest(harness, { id: "req-race" });
    dispatchPopupMessage(harness, { type: "UI_READY" });
    harness.tabsSendMessage.mockClear();

    dispatchPopupMessage(harness, {
      type: "DAPP_APPROVE",
      id: "req-race",
      result: { addresses: [] },
    });

    // Let anything still pending from the dispatch settle.
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.tabsSendMessage).toHaveBeenCalledWith(
      sender.tab.id,
      expect.objectContaining({ id: "req-race" })
    );
  });

  describe("GET_PENDING_REQUEST", () => {
    it("hands a surface the request waiting for a decision", async () => {
      await dispatchDappRequest(harness, {
        id: "req-pending",
        method: "stx_transferStx",
        params: { recipient: "ST_PENDING", amount: "7" },
        origin: "https://pending.example",
      });

      const sendResponse = vi.fn();
      const result = dispatchPopupMessage(
        harness,
        { type: "GET_PENDING_REQUEST" },
        sendResponse
      );

      expect(result).toBe(true);
      // This is what lets a surface the user opens themselves pick up a
      // request that is already in flight, instead of showing Home.
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        request: {
          id: "req-pending",
          method: "stx_transferStx",
          params: { recipient: "ST_PENDING", amount: "7" },
          origin: "https://pending.example",
        },
      });
    });

    it("reports nothing pending when the queue is idle", () => {
      const sendResponse = vi.fn();

      dispatchPopupMessage(harness, { type: "GET_PENDING_REQUEST" }, sendResponse);

      expect(sendResponse).toHaveBeenCalledWith({ ok: false, request: null });
    });
  });

  describe("H7 — routing messages from the queue popup window", () => {
    it("delivers the queued request once the popup signals UI_READY", async () => {
      await dispatchDappRequest(harness, {
        id: "req-h7",
        method: "stx_transferStx",
        params: { recipient: "ST_H7", amount: "500" },
        origin: "https://h7.example",
      });

      // Nothing reaches the popup before it announces itself.
      expect(harness.runtimeSendMessage).not.toHaveBeenCalled();

      dispatchPopupMessage(harness, { type: "UI_READY" });

      // The popup window has a sender.tab, so this is the assertion that
      // fails when the UI listener is gated on the absence of one.
      expect(harness.runtimeSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "DAPP_REQUEST",
          payload: expect.objectContaining({ id: "req-h7" }),
        })
      );
    });

    it("does not answer 'Origin not allowed' to the extension's own pages", () => {
      const sendResponse = vi.fn();

      dispatchPopupMessage(harness, { type: "UI_READY" }, sendResponse);

      const rejectedByOrigin = sendResponse.mock.calls.some(
        (call) =>
          (call[0] as { error?: { message?: string } })?.error?.message ===
          "Origin not allowed"
      );
      expect(rejectedByOrigin).toBe(false);
    });

    it("does not hold the page's message channel open", () => {
      // Responses travel back through chrome.tabs.sendMessage, never
      // through sendResponse. Returning true would make Chrome wait for a
      // reply that never comes and reject content.js's sendMessage promise
      // with "message channel closed before a response was received",
      // which surfaces as an uncaught error on the dApp page.
      const contentListener = harness.messageListeners[1];

      const returned = contentListener(
        {
          jsonrpc: "2.0",
          id: "rpc-channel",
          method: "stx_transferStx",
          params: { recipient: "ST123", amount: "1" },
        },
        { tab: { id: 42 }, origin: "https://app.example.com", id: EXTENSION_ID },
        () => undefined
      );

      expect(returned).not.toBe(true);
    });

    it("does not hold the channel open for auto-approved methods either", () => {
      const contentListener = harness.messageListeners[1];

      const returned = contentListener(
        { jsonrpc: "2.0", id: "rpc-addr", method: "getAddresses", params: {} },
        { tab: { id: 42 }, origin: "https://app.example.com", id: EXTENSION_ID },
        () => undefined
      );

      expect(returned).not.toBe(true);
    });

    it("still rejects an unlisted origin that fakes an extension URL", () => {
      const sendResponse = vi.fn();
      const contentListener = harness.messageListeners[1];

      contentListener(
        { jsonrpc: "2.0", id: "spoof", method: "stx_transferStx", params: {} },
        {
          tab: { id: 55 },
          // Another extension, not ours.
          origin: "chrome-extension://someotherextensionid",
          id: "someotherextensionid",
        },
        sendResponse
      );

      expect(sendResponse).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({ message: "Origin not allowed" }),
        })
      );
    });
  });
});
