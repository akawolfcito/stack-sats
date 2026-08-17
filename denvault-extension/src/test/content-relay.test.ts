/**
 * Vitest harness for public/content.js
 *
 * Loads the content script in a sandboxed Function with a mocked chrome.*
 * API and drives the page-to-background relay. Covers H12: a content
 * script orphaned by an extension reload must tell the page instead of
 * throwing into it.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CONTENT_PATH = resolve(__dirname, "../../public/content.js");
const CONTENT_SOURCE = readFileSync(CONTENT_PATH, "utf-8");

const EXTENSION_ID = "denvault-test";
const PAGE_ORIGIN = "https://app.example.com";

interface Harness {
  sendMessage: ReturnType<typeof vi.fn>;
  postMessage: ReturnType<typeof vi.fn>;
  dispatch: (detail: unknown) => void;
}

function install(sendMessage: ReturnType<typeof vi.fn>): Harness {
  let requestListener: ((event: unknown) => void) | null = null;
  const postMessage = vi.fn();

  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: {
      id: EXTENSION_ID,
      getURL: (p: string) => `chrome-extension://${EXTENSION_ID}/${p}`,
      sendMessage,
      onMessage: { addListener: vi.fn() },
    },
  };

  const documentMock = {
    addEventListener: (type: string, listener: (event: unknown) => void) => {
      if (type === "stackswallet_request") requestListener = listener;
    },
    createElement: () => ({}),
    head: { prepend: vi.fn() },
    documentElement: { prepend: vi.fn() },
  };

  (globalThis as unknown as { document: unknown }).document = documentMock;
  (globalThis as unknown as { window: unknown }).window = {
    postMessage,
    location: { origin: PAGE_ORIGIN },
  };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function(CONTENT_SOURCE)();

  return {
    sendMessage,
    postMessage,
    dispatch: (detail: unknown) => {
      if (!requestListener) throw new Error("request listener not registered");
      requestListener({ target: documentMock, detail });
    },
  };
}

const REQUEST = {
  jsonrpc: "2.0",
  id: "rpc-1",
  method: "getAddresses",
  params: {},
};

describe("content script relay", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  it("forwards a valid request to background", () => {
    const harness = install(vi.fn().mockResolvedValue(undefined));

    harness.dispatch(REQUEST);

    expect(harness.sendMessage).toHaveBeenCalledWith(REQUEST);
    expect(harness.postMessage).not.toHaveBeenCalled();
  });

  it("swallows an async failure without touching the page", async () => {
    const harness = install(vi.fn().mockRejectedValue(new Error("asleep")));

    harness.dispatch(REQUEST);
    await Promise.resolve();

    // The real answer still arrives through onMessage, so a transient
    // failure must not fabricate a response.
    expect(harness.postMessage).not.toHaveBeenCalled();
  });

  it("answers the page when the extension context is gone", () => {
    // After an extension reload the injected script is orphaned and
    // chrome.runtime.sendMessage throws synchronously, which lands on the
    // dApp's console as an uncaught error and leaves the request hanging
    // until injection.js times out 60s later.
    const harness = install(
      vi.fn().mockImplementation(() => {
        throw new Error("Extension context invalidated.");
      })
    );

    expect(() => harness.dispatch(REQUEST)).not.toThrow();

    expect(harness.postMessage).toHaveBeenCalledTimes(1);
    const [body, targetOrigin] = harness.postMessage.mock.calls[0];
    expect(targetOrigin).toBe(PAGE_ORIGIN);
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      id: REQUEST.id,
      error: { code: -32603 },
    });
    expect(String((body as { error: { message: string } }).error.message)).toMatch(
      /reload/i
    );
  });

  it("ignores a malformed request", () => {
    const harness = install(vi.fn().mockResolvedValue(undefined));

    harness.dispatch({ jsonrpc: "1.0", id: "x", method: "getAddresses" });

    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(harness.postMessage).not.toHaveBeenCalled();
  });
});
