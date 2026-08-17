import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { ref } from "vue";
import { startAutoRefresh, PENDING_POLL_MS, IDLE_POLL_MS } from "./useAutoRefresh";

let visibility: DocumentVisibilityState = "visible";

function setVisibility(state: DocumentVisibilityState) {
  visibility = state;
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  vi.useFakeTimers();
  visibility = "visible";
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("startAutoRefresh", () => {
  it("refreshes when the wallet comes back into view", () => {
    const onRefresh = vi.fn();
    const stop = startAutoRefresh({ onRefresh, hasPending: ref(false) });

    setVisibility("hidden");
    expect(onRefresh).not.toHaveBeenCalled();

    // Reopening the popup or returning to the tab is the moment someone
    // is asking "did it go through?".
    setVisibility("visible");
    expect(onRefresh).toHaveBeenCalledTimes(1);

    stop();
  });

  it("polls quickly while something is pending", () => {
    const onRefresh = vi.fn();
    const hasPending = ref(true);
    const stop = startAutoRefresh({ onRefresh, hasPending });

    vi.advanceTimersByTime(PENDING_POLL_MS);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(PENDING_POLL_MS);
    expect(onRefresh).toHaveBeenCalledTimes(2);

    stop();
  });

  it("backs off once nothing is pending", () => {
    const onRefresh = vi.fn();
    const hasPending = ref(false);
    const stop = startAutoRefresh({ onRefresh, hasPending });

    vi.advanceTimersByTime(PENDING_POLL_MS);
    expect(onRefresh).not.toHaveBeenCalled();

    vi.advanceTimersByTime(IDLE_POLL_MS - PENDING_POLL_MS);
    expect(onRefresh).toHaveBeenCalledTimes(1);

    stop();
  });

  it("does not poll while the wallet is out of sight", () => {
    const onRefresh = vi.fn();
    const stop = startAutoRefresh({ onRefresh, hasPending: ref(true) });

    setVisibility("hidden");
    vi.advanceTimersByTime(PENDING_POLL_MS * 3);

    // No point asking the network about a screen nobody is looking at.
    expect(onRefresh).not.toHaveBeenCalled();

    stop();
  });

  it("stops for good when stopped", () => {
    const onRefresh = vi.fn();
    const stop = startAutoRefresh({ onRefresh, hasPending: ref(true) });

    stop();

    vi.advanceTimersByTime(PENDING_POLL_MS * 5);
    setVisibility("hidden");
    setVisibility("visible");

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it("polls fast enough to catch a Stacks block", () => {
    // A user who just approved something stares at this screen. Anything
    // slower and they conclude it failed and send it again, which is
    // exactly what happened on 2026-08-17: two deploys and two contract
    // calls, each paid for twice.
    expect(PENDING_POLL_MS).toBeLessThanOrEqual(15_000);
  });
});
