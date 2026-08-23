import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { openExternalTab } from "./open-tab";

vi.mock("../security/logger", () => ({ secureLog: vi.fn() }));

const create = vi.fn();
const originalChrome = globalThis.chrome;

describe("openExternalTab", () => {
  beforeEach(() => {
    create.mockClear();
    // @ts-expect-error - narrow stub
    globalThis.chrome = { tabs: { create } };
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error - restoring the shared mock
    globalThis.chrome = originalChrome;
  });

  it("asks the browser, not the popup, so the popup survives", () => {
    openExternalTab("https://blockstream.info/testnet/tx/abc");

    expect(create).toHaveBeenCalledWith({ url: "https://blockstream.info/testnet/tx/abc" });
    expect(window.open).not.toHaveBeenCalled();
  });

  it("falls back to window.open where the extension APIs are absent", () => {
    // @ts-expect-error - outside the extension
    globalThis.chrome = undefined;

    openExternalTab("https://explorer.hiro.so/txid/abc");

    expect(window.open).toHaveBeenCalledWith(
      "https://explorer.hiro.so/txid/abc",
      "_blank",
      "noopener,noreferrer"
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "chrome-extension://abc/index.html",
    "",
  ])("refuses %s", (url) => {
    openExternalTab(url);

    expect(create).not.toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
  });
});
