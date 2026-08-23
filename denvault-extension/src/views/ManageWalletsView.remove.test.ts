/**
 * Removing one wallet must leave the others alone.
 *
 * Reported after a manual pass: a second wallet was created for testing,
 * removed, and the extension came back to "Set Up Your Wallet" with
 * Settings reading "0 wallets". Losing every wallet while asking to lose
 * one is the worst thing this screen could do, so the boundary is pinned
 * here rather than argued about.
 *
 * There are two functions named deleteWalletAsync in this codebase: the
 * one on sessionManager clears the lot, the one in @/utils/wallets removes
 * a single entry. This screen must use the second.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

const { push, deleteWalletAsync, lock, walletStore } = vi.hoisted(() => ({
  push: vi.fn(),
  deleteWalletAsync: vi.fn(),
  lock: vi.fn(),
  walletStore: {
    entries: [
      { id: "w1", name: "The Wolf", createdAt: 1 },
      { id: "w2", name: "Test Wallet", createdAt: 2 },
    ],
  },
}));

vi.mock("@/utils/wallets", () => ({
  getWalletsAsync: vi.fn(async () => walletStore.entries.map((e) => ({ ...e }))),
  getActiveWalletIdAsync: vi.fn(async () => "w1"),
  setActiveWalletIdAsync: vi.fn(async () => undefined),
  renameWalletAsync: vi.fn(async () => undefined),
  // Stands in for the vault: removes exactly the entry it was given.
  deleteWalletAsync: deleteWalletAsync.mockImplementation(async (id: string) => {
    walletStore.entries = walletStore.entries.filter((e) => e.id !== id);
    return true;
  }),
}));

vi.mock("@/utils/security/session", () => ({
  sessionManager: { lock, switchWalletAsync: vi.fn(async () => undefined) },
}));

vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn() }));

/*
 * Removing now needs the PIN of the wallet being removed. These cases are
 * about what removal does once authorised, so the proof is stubbed and its
 * own behaviour is covered in utils/wallets/ownership.test.ts.
 */
const verifyWalletPin = vi.hoisted(() => vi.fn());
vi.mock("@/utils/wallets/ownership", () => ({
  verifyWalletPin,
  describeWalletAuth: () => "That is not this wallet's PIN.",
}));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import ManageWalletsView from "./ManageWalletsView.vue";

describe("ManageWalletsView removal", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    push.mockClear();
    lock.mockClear();
    deleteWalletAsync.mockClear();
    walletStore.entries = [
      { id: "w1", name: "The Wolf", createdAt: 1 },
      { id: "w2", name: "Test Wallet", createdAt: 2 },
    ];
    verifyWalletPin.mockReset();
    verifyWalletPin.mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  /** Open the remove modal for the row whose label reads `name`. */
  async function startRemoving(name: string) {
    wrapper = mount(ManageWalletsView);
    await flushPromises();

    const rows = wrapper.findAll("button.list-row");
    const row = rows.find((r) => r.text().includes(name));
    expect(row, `no row for ${name}`).toBeTruthy();

    await row!.get('button[title="Remove wallet"]').trigger("click");
    await flushPromises();
  }

  /** Reach a teleported node by its ROI marker. */
  const roi = (name: string) =>
    document.querySelector<HTMLElement>(`[data-roi="${name}"]`);

  /** Type a PIN, since the confirm button stays disabled without one. */
  async function enterRemovalPin(pin = "111111") {
    const field = roi("remove-wallet-pin") as HTMLInputElement | null;
    expect(field, "the PIN field should be on screen").toBeTruthy();
    field!.value = pin;
    field!.dispatchEvent(new Event("input", { bubbles: true }));
    await flushPromises();
  }

  async function confirmRemoval(pin = "111111") {
    await enterRemovalPin(pin);
    const button = roi("remove-wallet-confirm");
    expect(button, "the confirm button should be on screen").toBeTruthy();
    button!.click();
    await flushPromises();
  }

  it("removes only the wallet that was asked for", async () => {
    await startRemoving("Test Wallet");

    await confirmRemoval();

    expect(deleteWalletAsync).toHaveBeenCalledTimes(1);
    expect(deleteWalletAsync).toHaveBeenCalledWith("w2");
    expect(walletStore.entries.map((e) => e.id)).toEqual(["w1"]);
  });

  it("keeps the user in the wallet they were already using", async () => {
    await startRemoving("Test Wallet");

    await confirmRemoval();

    // The active wallet survived, so there is nothing to re-authenticate
    // and nothing to set up: staying put is the correct outcome.
    expect(lock).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(wrapper.text()).toContain("The Wolf");
    expect(wrapper.text()).not.toContain("Test Wallet");
  });

  it("returns to setup only when the last wallet goes", async () => {
    walletStore.entries = [{ id: "w1", name: "The Wolf", createdAt: 1 }];
    await startRemoving("The Wolf");

    await confirmRemoval();

    expect(walletStore.entries).toEqual([]);
    expect(lock).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith({ path: "/" });
  });

  it("offers the remove control for the only wallet rather than greying it out", async () => {
    walletStore.entries = [{ id: "w1", name: "The Wolf", createdAt: 1 }];
    wrapper = mount(ManageWalletsView, { attachTo: document.body });
    await flushPromises();

    const remove = wrapper.get('button[title="Remove wallet"]');
    expect(remove.classes()).not.toContain("action-btn--disabled");
    expect(remove.attributes("disabled")).toBeUndefined();
  });

  it("warns before removing the only wallet, and not before removing one of two", async () => {
    await startRemoving("Test Wallet");
    expect(roi("remove-wallet-last")).toBeNull();
    wrapper.unmount();

    walletStore.entries = [{ id: "w1", name: "The Wolf", createdAt: 1 }];
    await startRemoving("The Wolf");
    expect(roi("remove-wallet-last")).toBeTruthy();
  });

  /** The reported hole: one wallet's PIN was authority over every wallet. */
  it("does not remove anything when the PIN is not this wallet's", async () => {
    verifyWalletPin.mockResolvedValue({ ok: false, reason: "wrong-pin" });
    await startRemoving("Test Wallet");

    await confirmRemoval("222222");

    expect(deleteWalletAsync).not.toHaveBeenCalled();
    expect(walletStore.entries.map((e) => e.id)).toEqual(["w1", "w2"]);
    expect(roi("remove-wallet-error")?.textContent).toContain("this wallet's PIN");
  });

  it("checks the PIN against the wallet being removed, not the open one", async () => {
    await startRemoving("Test Wallet");

    await confirmRemoval("111111");

    expect(verifyWalletPin).toHaveBeenCalledWith("w2", "111111");
  });

  it("keeps the destructive button out of reach until a full PIN is typed", async () => {
    await startRemoving("Test Wallet");

    const button = roi("remove-wallet-confirm") as HTMLButtonElement | null;
    expect(button?.disabled).toBe(true);

    await enterRemovalPin("11111");
    expect((roi("remove-wallet-confirm") as HTMLButtonElement).disabled).toBe(true);

    await enterRemovalPin("111111");
    expect((roi("remove-wallet-confirm") as HTMLButtonElement).disabled).toBe(false);
  });
});
