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

  it("pings often enough to beat the 30s idle timeout", () => {
    // Chrome terminates an idle MV3 worker after ~30s. Anything slower
    // than that lets the queue die mid approval.
    expect(KEEPALIVE_INTERVAL_MS).toBeLessThan(30000);

    startBackgroundKeepalive();
    expect(port.postMessage).not.toHaveBeenCalled();

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS);
    expect(port.postMessage).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 2);
    expect(port.postMessage).toHaveBeenCalledTimes(3);
  });

  it("stops pinging and drops the port when stopped", () => {
    const stop = startBackgroundKeepalive();

    stop();

    expect(port.disconnect).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(KEEPALIVE_INTERVAL_MS * 3);
    expect(port.postMessage).not.toHaveBeenCalled();
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
