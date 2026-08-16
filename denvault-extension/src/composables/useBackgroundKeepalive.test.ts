import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  startBackgroundKeepalive,
  KEEPALIVE_PORT_NAME,
  KEEPALIVE_INTERVAL_MS,
} from "./useBackgroundKeepalive";

interface PortMock {
  name: string;
  postMessage: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  onDisconnect: { addListener: ReturnType<typeof vi.fn> };
}

let port: PortMock;
let connect: ReturnType<typeof vi.fn>;

function installChrome(): void {
  port = {
    name: KEEPALIVE_PORT_NAME,
    postMessage: vi.fn(),
    disconnect: vi.fn(),
    onDisconnect: { addListener: vi.fn() },
  };
  connect = vi.fn().mockReturnValue(port);
  (globalThis as unknown as { chrome: unknown }).chrome = {
    runtime: { id: "denvault-test", connect },
    windows: { getCurrent: vi.fn().mockResolvedValue({ id: 77 }) },
  };
}

describe("startBackgroundKeepalive", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    installChrome();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
  });

  it("opens a named port so the service worker stays alive", () => {
    startBackgroundKeepalive();

    expect(connect).toHaveBeenCalledWith("denvault-test", {
      name: KEEPALIVE_PORT_NAME,
    });
  });

  /** Pings only, ignoring the SURFACE_HELLO sent on connect. */
  function pingCount(): number {
    return port.postMessage.mock.calls.filter(
      (call) => (call[0] as { type: string }).type === "KEEPALIVE"
    ).length;
  }

  it("pings often enough to beat the 30s idle timeout", () => {
    // Chrome terminates an idle MV3 worker after ~30s. Anything slower
    // than that lets the queue die mid approval.
    expect(KEEPALIVE_INTERVAL_MS).toBeLessThan(30000);

    startBackgroundKeepalive();
    expect(pingCount()).toBe(0);

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS);
    expect(pingCount()).toBe(1);

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 2);
    expect(pingCount()).toBe(3);
  });

  it("announces which surface it is and which window hosts it", async () => {
    startBackgroundKeepalive("sidepanel");
    await vi.waitFor(() =>
      expect(port.postMessage).toHaveBeenCalledWith({
        type: "SURFACE_HELLO",
        surface: "sidepanel",
        windowId: 77,
      })
    );
  });

  it("announces the surface even when the window is unknown", async () => {
    delete (globalThis as unknown as { chrome: { windows?: unknown } }).chrome
      .windows;

    startBackgroundKeepalive("sidepanel");

    expect(port.postMessage).toHaveBeenCalledWith({
      type: "SURFACE_HELLO",
      surface: "sidepanel",
    });
  });

  it("defaults to the queue surface", async () => {
    startBackgroundKeepalive();
    await vi.waitFor(() =>
      expect(port.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: "SURFACE_HELLO", surface: "queue" })
      )
    );
  });

  it("stops pinging and drops the port when stopped", () => {
    const stop = startBackgroundKeepalive();

    stop();

    expect(port.disconnect).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 3);
    expect(pingCount()).toBe(0);
  });

  it("reconnects when the worker drops the port anyway", () => {
    startBackgroundKeepalive();

    const onDisconnect = port.onDisconnect.addListener.mock.calls[0][0] as () => void;
    connect.mockClear();
    onDisconnect();

    expect(connect).toHaveBeenCalledWith("denvault-test", {
      name: KEEPALIVE_PORT_NAME,
    });
  });

  it("is a no-op outside the extension", () => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;

    const stop = startBackgroundKeepalive();

    expect(() => stop()).not.toThrow();
  });
});
