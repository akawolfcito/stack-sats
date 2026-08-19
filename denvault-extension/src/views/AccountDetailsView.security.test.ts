/**
 * The Security section of an account, which promised two things it did
 * not do.
 *
 * Both rows opened a "Coming Soon" modal. Meanwhile the reveal flow was
 * built and working two clicks away in Settings: /verify-pin issues a
 * single-use grant and /recovery-phrase spends it on arrival. Telling
 * someone their recovery phrase is a pending feature, in the security
 * section of a wallet, while it sits finished elsewhere, is worse than
 * having no row at all.
 *
 * View Private Key had no destination anywhere, so it makes no promise
 * now either.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

const { push, ACCOUNT } = vi.hoisted(() => ({
  push: vi.fn(),
  ACCOUNT: {
    stxAddress: "ST2NJ5K0XKKPTSDZ0KGZF5XRFZTVDQK56VQQWSJBQ",
    stxPrivateKey: "unused",
    btcP2PKHAddress: "mw7qXcn8ij3rLiVX",
    btcP2TRAddress: "tb1p0lh86qs7q4fz",
    index: 0,
  },
}));

vi.mock("@/utils/accounts", () => ({
  generateInitialAccounts: vi.fn(async () => [ACCOUNT]),
}));

vi.mock("@/utils/security/session", () => ({
  sessionManager: {
    hasWallet: true,
    isLocked: false,
    getMnemonic: () => "test mnemonic never used, accounts are stubbed",
  },
}));

vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn(), secureWarn: vi.fn() }));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: { index: "0" }, query: {} }),
}));

import AccountDetailsView from "./AccountDetailsView.vue";

const originalChromeStorage = globalThis.chrome?.storage;

describe("AccountDetailsView security section", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    push.mockClear();
    // @ts-expect-error - removing storage triggers the localStorage fallback
    globalThis.chrome = { ...globalThis.chrome, storage: undefined };
    wrapper = mount(AccountDetailsView);
    await flushPromises();
    await flushPromises();
  });

  afterEach(() => {
    wrapper?.unmount();
    if (originalChromeStorage) {
      // @ts-expect-error - restoring the shared mock for other files
      globalThis.chrome.storage = originalChromeStorage;
    }
  });

  /** The row whose title reads `title`. */
  function row(title: string) {
    return wrapper.findAll("button.action-row").find((b) => b.text().includes(title));
  }

  it("sends the phrase row through the PIN, to the screen that exists", async () => {
    const phrase = row("View Secret Phrase");
    expect(phrase, "the phrase row should be on screen").toBeTruthy();

    await phrase!.trigger("click");

    expect(push).toHaveBeenCalledWith({
      path: "/verify-pin",
      query: { action: "reveal", returnTo: "/recovery-phrase" },
    });
  });

  it("promises nothing it cannot do", async () => {
    expect(wrapper.text()).not.toMatch(/coming soon/i);
    expect(row("View Private Key")).toBeUndefined();
  });
});
