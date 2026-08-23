/**
 * What the home screen says when it does not know the balance.
 *
 * The STX balance starts at "0" and loadBalance keeps the previous value
 * when the fetch fails, so a first load against a rate limited API (Hiro
 * answers 429 readily, and the wallet asks for /balances twice per
 * refresh) rendered a confident "0.00 STX" for an account holding 499.97.
 * Pressing refresh repeated the failure and repeated the zero. Bitcoin
 * already separates the two through isBtcBalanceUnknown; Stacks did not.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

// vi.mock factories are hoisted above the file, so what they close over
// has to be hoisted with them.
const { ACCOUNT, fetchStxBalance } = vi.hoisted(() => ({
  ACCOUNT: {
    stxAddress: "ST2NJ5K0XKKPTSDZ0KGZF5XRFZTVDQK56VQQWSJBQ",
    stxPrivateKey: "unused",
    btcP2PKHAddress: "mtest",
    btcP2TRAddress: "tb1ptest",
    index: 0,
  },
  fetchStxBalance: vi.fn(),
}));

vi.mock("../utils/accounts", () => ({
  generateInitialAccounts: vi.fn(async () => [ACCOUNT]),
}));

vi.mock("../utils/balance", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchStxBalance,
  fetchFungibleTokens: vi.fn(async () => null),
}));

vi.mock("../utils/bitcoin", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCombinedBtcBalance: vi.fn(async () => ({
    confirmed: 180489,
    unconfirmed: 0,
    total: 180489,
    txCount: 2,
  })),
}));

vi.mock("../utils/transactions", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchTransactions: vi.fn(async () => []),
  fetchMempoolTransactions: vi.fn(async () => []),
}));

vi.mock("@/utils/bitcoin/activity", () => ({ fetchBtcActivity: vi.fn(async () => []) }));

vi.mock("../utils/security/session", () => ({
  sessionManager: {
    hasWallet: true,
    isLocked: false,
    getMnemonic: () => "test mnemonic never used, accounts are stubbed",
  },
}));

vi.mock("../utils/security/logger", () => ({ secureLog: vi.fn() }));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {} }),
}));

import UserHomeView from "./UserHomeView.vue";

// The account settings the view reads on mount go through walletVault,
// which only falls back to the mocked localStorage when chrome.storage is
// absent. Left in place, its stub resolves to undefined and the view never
// leaves "Loading accounts...". Same approach as utils/security/vault.test.
const originalChromeStorage = globalThis.chrome?.storage;

async function mountHome(): Promise<VueWrapper> {
  const wrapper = mount(UserHomeView);
  await flushPromises();
  await flushPromises();
  return wrapper;
}

describe("UserHomeView STX balance", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    fetchStxBalance.mockReset();
    // @ts-expect-error - removing storage triggers the localStorage fallback
    globalThis.chrome = { ...globalThis.chrome, storage: undefined };
  });

  afterEach(() => {
    wrapper?.unmount();
    if (originalChromeStorage) {
      // @ts-expect-error - restoring the shared mock for other files
      globalThis.chrome.storage = originalChromeStorage;
    }
  });

  it("shows the balance the API returned", async () => {
    fetchStxBalance.mockResolvedValue("499970000");
    wrapper = await mountHome();

    expect(wrapper.text()).toContain("499.97");
    expect(wrapper.text()).not.toContain("Unavailable");
  });

  it("says Unavailable instead of zero when the fetch fails", async () => {
    fetchStxBalance.mockResolvedValue(null);
    wrapper = await mountHome();

    expect(wrapper.text()).toContain("Unavailable");
    // Not "0.00 STX" specifically: the BTC row legitimately reads 0.00180489.
    expect(wrapper.text()).not.toMatch(/0(\.0+)?\s*STX/);
  });

  it("says Unavailable when the fetch throws", async () => {
    fetchStxBalance.mockRejectedValue(new Error("429 Too Many Requests"));
    wrapper = await mountHome();

    expect(wrapper.text()).toContain("Unavailable");
  });

  it("clears Unavailable once a later fetch succeeds", async () => {
    fetchStxBalance.mockResolvedValueOnce(null).mockResolvedValue("499970000");
    wrapper = await mountHome();
    expect(wrapper.text()).toContain("Unavailable");

    await wrapper.get('[data-roi="home-balance-card"] [title="Refresh balance"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("499.97");
    expect(wrapper.text()).not.toContain("Unavailable");
  });

  it("does not report a real zero as unavailable", async () => {
    fetchStxBalance.mockResolvedValue("0");
    wrapper = await mountHome();

    expect(wrapper.text()).not.toContain("Unavailable");
    expect(wrapper.text()).toContain("0");
  });
});
