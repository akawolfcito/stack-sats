import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { openSidePanel, SIDE_PANEL_PATH } from "./useSidePanel";

interface ChromeStub {
  sidePanel?: {
    setOptions: ReturnType<typeof vi.fn>;
    open: ReturnType<typeof vi.fn>;
  };
  windows?: { getCurrent: ReturnType<typeof vi.fn> };
  runtime: { sendMessage: ReturnType<typeof vi.fn> };
}

let stub: ChromeStub;

function install(overrides: Partial<ChromeStub> = {}): void {
  stub = {
    sidePanel: {
      setOptions: vi.fn().mockResolvedValue(undefined),
      open: vi.fn().mockResolvedValue(undefined),
    },
    windows: { getCurrent: vi.fn().mockResolvedValue({ id: 42 }) },
    runtime: { sendMessage: vi.fn().mockResolvedValue({ ok: true }) },
    ...overrides,
  };
  (globalThis as unknown as { chrome: unknown }).chrome = stub;
}

describe("openSidePanel", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    install();
  });

  afterEach(() => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    vi.restoreAllMocks();
  });

  it("opens the panel in the window the user is looking at", async () => {
    const outcome = await openSidePanel();

    expect(stub.sidePanel!.setOptions).toHaveBeenCalledWith(
      expect.objectContaining({ enabled: true, path: SIDE_PANEL_PATH })
    );
    // chrome.sidePanel.open() only works while a user gesture is being
    // handled, which is why the call stays here in the click handler
    // instead of hopping to the service worker first.
    expect(stub.sidePanel!.open).toHaveBeenCalledWith({ windowId: 42 });
    expect(outcome).toBe("sidepanel");
  });

  it("asks background to sort it out when the direct call fails", async () => {
    stub.sidePanel!.open.mockRejectedValue(new Error("no user gesture"));

    const outcome = await openSidePanel();

    expect(stub.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_SIDEPANEL",
    });
    expect(outcome).toBe("fallback");
  });

  it("falls back when the API is missing altogether", async () => {
    install({ sidePanel: undefined });

    const outcome = await openSidePanel();

    expect(stub.runtime.sendMessage).toHaveBeenCalledWith({
      type: "OPEN_SIDEPANEL",
    });
    expect(outcome).toBe("fallback");
  });

  it("reports failure when nothing can open it", async () => {
    install({ sidePanel: undefined });
    stub.runtime.sendMessage.mockRejectedValue(new Error("no background"));

    expect(await openSidePanel()).toBe("failed");
  });

  it("does nothing outside the extension", async () => {
    delete (globalThis as unknown as { chrome?: unknown }).chrome;

    expect(await openSidePanel()).toBe("unavailable");
  });
});
