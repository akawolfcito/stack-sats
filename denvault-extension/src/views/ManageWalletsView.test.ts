/**
 * Renaming a wallet, from the click on the pencil to the focused field.
 *
 * The rename input lives inside a v-for, so Vue compiles its ref with
 * ref_for and hands back an array of elements rather than one element.
 * `renameInputRef.value?.focus()` therefore threw "focus is not a
 * function" on every rename: the optional chaining does not help, because
 * an array is not null. The field appeared but never took focus, and the
 * error surfaced in chrome://extensions.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

/** Fresh objects per load: the view renames in place, so shared ones leak. */
const listWallets = () => [
  { id: "w1", name: "WWolf", createdAt: 1 },
  { id: "w2", name: "Spare", createdAt: 2 },
];

vi.mock("@/utils/wallets", () => ({
  getWalletsAsync: vi.fn(async () => listWallets()),
  getActiveWalletIdAsync: vi.fn(async () => "w1"),
  setActiveWalletIdAsync: vi.fn(async () => undefined),
  deleteWalletAsync: vi.fn(async () => undefined),
  renameWalletAsync: vi.fn(async () => undefined),
}));

vi.mock("@/utils/security/session", () => ({
  sessionManager: {
    lock: vi.fn(),
    switchWalletAsync: vi.fn(async () => undefined),
  },
}));

vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn() }));

const push = vi.fn();
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import { renameWalletAsync } from "@/utils/wallets";
import ManageWalletsView from "./ManageWalletsView.vue";

/** Mount attached to the document: focus only moves on a live element. */
async function mountView(): Promise<VueWrapper> {
  const wrapper = mount(ManageWalletsView, { attachTo: document.body });
  await flushPromises();
  return wrapper;
}

/** The focus is scheduled a tick after the field renders. */
const afterFocusTick = () => new Promise((resolve) => setTimeout(resolve, 80));

describe("ManageWalletsView rename", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    push.mockClear();
    renameWalletAsync.mockClear();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("focuses and selects the field when rename starts", async () => {
    wrapper = await mountView();

    await wrapper.get('button[title="Rename wallet"]').trigger("click");
    await flushPromises();

    const input = wrapper.get<HTMLInputElement>("input.rename-input");
    expect(input.element.value).toBe("WWolf");

    await afterFocusTick();

    expect(document.activeElement).toBe(input.element);
    expect(input.element.selectionStart).toBe(0);
    expect(input.element.selectionEnd).toBe("WWolf".length);
  });

  it("saves the new name and leaves editing", async () => {
    wrapper = await mountView();

    await wrapper.get('button[title="Rename wallet"]').trigger("click");
    await afterFocusTick();

    const input = wrapper.get<HTMLInputElement>("input.rename-input");
    await input.setValue("  Cold storage  ");
    await input.trigger("keydown", { key: "Enter" });
    await flushPromises();

    expect(renameWalletAsync).toHaveBeenCalledWith("w1", "Cold storage");
    expect(wrapper.find("input.rename-input").exists()).toBe(false);
    expect(wrapper.text()).toContain("Cold storage");
  });

  it("drops the edit on Escape without renaming", async () => {
    wrapper = await mountView();

    await wrapper.get('button[title="Rename wallet"]').trigger("click");
    await afterFocusTick();

    const input = wrapper.get<HTMLInputElement>("input.rename-input");
    await input.setValue("Discarded");
    await input.trigger("keydown", { key: "Escape" });
    await flushPromises();

    expect(renameWalletAsync).not.toHaveBeenCalled();
    expect(wrapper.find("input.rename-input").exists()).toBe(false);
    expect(wrapper.text()).toContain("WWolf");
  });
});
