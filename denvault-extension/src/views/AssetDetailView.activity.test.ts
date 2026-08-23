/**
 * Tapping a row on /asset/btc.
 *
 * The detail screen reads the Stacks API, so every Bitcoin row on this
 * screen pushed /transaction/{txid} and rendered "Transaction not found",
 * for confirmed transactions that plainly existed. UserHomeView guarded
 * against it inline and this screen never got the guard, so the same list
 * behaved differently depending on where it was rendered.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

const { ACCOUNT, push, openTab, BTC_TXID } = vi.hoisted(() => ({
  ACCOUNT: {
    stxAddress: "ST2NJ5K0XKKPTSDZ0KGZF5XRFZTVDQK56VQQWSJBQ",
    stxPrivateKey: "unused",
    btcP2PKHAddress: "mtest",
    btcP2TRAddress: "tb1ptest",
    index: 0,
  },
  push: vi.fn(),
  openTab: vi.fn(),
  BTC_TXID: "33251914aabbccddeeff",
}));

vi.mock("@/utils/accounts", () => ({
  generateInitialAccounts: vi.fn(async () => [ACCOUNT]),
}));

vi.mock("@/utils/bitcoin/activity", () => ({
  fetchBtcActivity: vi.fn(async () => [
    {
      txid: BTC_TXID,
      confirmed: true,
      blockTime: 1_755_000_000,
      amountSats: 82881,
      isOutgoing: true,
      isSelfTransfer: false,
      counterparty: "tb1p0lh8example",
    },
  ]),
}));

vi.mock("@/utils/balance", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchStxBalance: vi.fn(async () => "499997438"),
  fetchFungibleTokens: vi.fn(async () => null),
}));

vi.mock("@/utils/bitcoin", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchCombinedBtcBalance: vi.fn(async () => ({
    confirmed: 180489,
    unconfirmed: 0,
    total: 180489,
    txCount: 2,
  })),
}));

vi.mock("@/utils/transactions", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  fetchTransactions: vi.fn(async () => []),
}));

vi.mock("@/utils/security/session", () => ({
  sessionManager: {
    hasWallet: true,
    isLocked: false,
    getMnemonic: () => "test mnemonic never used, accounts are stubbed",
  },
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({ push }),
  useRoute: () => ({ params: { assetId: "btc" }, query: {} }),
}));

import AssetDetailView from "./AssetDetailView.vue";

const originalChromeStorage = globalThis.chrome?.storage;

async function mountAssetDetail(): Promise<VueWrapper> {
  const wrapper = mount(AssetDetailView);
  await flushPromises();
  await flushPromises();
  return wrapper;
}

describe("AssetDetailView Bitcoin activity", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    push.mockClear();
    openTab.mockClear();
    // The link is opened through chrome.tabs.create, not window.open: a
    // popup that opens a tab itself loses focus and closes. See
    // utils/browser/open-tab.
    // @ts-expect-error - removing storage triggers the localStorage fallback
    globalThis.chrome = {
      ...globalThis.chrome,
      storage: undefined,
      tabs: { ...globalThis.chrome?.tabs, create: openTab },
    };
    localStorage.setItem("selected_network", "testnet");
  });

  afterEach(() => {
    wrapper?.unmount();
    vi.unstubAllGlobals();
    if (originalChromeStorage) {
      // @ts-expect-error - restoring the shared mock for other files
      globalThis.chrome.storage = originalChromeStorage;
    }
  });

  it("opens a Bitcoin explorer, not the Stacks detail screen", async () => {
    wrapper = await mountAssetDetail();

    const row = wrapper.findAll('[data-roi="activity-row"], .activity-row')[0];
    expect(row, "the Bitcoin history should render a row").toBeTruthy();
    await row.trigger("click");

    expect(push).not.toHaveBeenCalled();
    expect(openTab).toHaveBeenCalledTimes(1);
    expect(openTab.mock.calls[0][0].url).toContain(BTC_TXID);
    expect(openTab.mock.calls[0][0].url).toContain("testnet");
  });
});
