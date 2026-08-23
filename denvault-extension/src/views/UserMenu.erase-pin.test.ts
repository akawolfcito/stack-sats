import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

// Injected from public/manifest.json at build time. See version-display.test.
vi.stubGlobal("__APP_VERSION__", "1.1.3");

/**
 * The last step of erasing every wallet.
 *
 * The screen said "Enter your PIN to confirm deletion:" and then showed
 * nothing at all. PinInput was written into the template but never
 * imported, so Vue resolved it to an unknown element and rendered an empty
 * tag. Every other view that uses PinInput imports it; this one did not,
 * and no test drove the flow far enough to notice. The destructive path
 * was unfinishable.
 */

// The mock has to cover every export the view imports, not just the ones a
// test drives. onMounted calls getActiveWalletIdAsync, so leaving it out threw
// an unhandled rejection after each test had already passed: green tests, red
// exit code.
vi.mock("@/utils/wallets", () => ({
  getWalletsAsync: vi.fn().mockResolvedValue([{ id: "w1", name: "Wallet 1" }]),
  getWalletCountAsync: vi.fn().mockResolvedValue(1),
  getActiveWalletIdAsync: vi.fn().mockResolvedValue("w1"),
  getActiveWalletAsync: vi.fn().mockResolvedValue({ id: "w1", name: "Wallet 1" }),
  importWalletAsync: vi.fn().mockResolvedValue(undefined),
  walletExistsAsync: vi.fn().mockResolvedValue(false),
}));
vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn() }));

const unlock = vi.hoisted(() => vi.fn());
vi.mock("@/utils/security/session", () => ({
  sessionManager: {
    unlock,
    failedAttempts: 1,
    deleteWalletAsync: vi.fn(),
    getMnemonic: () => null,
    isLocked: false,
    hasWallet: true,
  },
}));
vi.mock("vue-router", () => ({
  useRouter: () => ({ push: vi.fn() }),
  useRoute: () => ({ query: {}, path: "/usermenu" }),
}));

import UserMenu from "./UserMenu.vue";

describe("UserMenu erase confirmation", () => {
  let wrapper: VueWrapper | undefined;

  beforeEach(() => {
    wrapper = undefined;
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("renders a real PIN control, not an unknown element", async () => {
    wrapper = mount(UserMenu);
    await flushPromises();

    // Driven through the real gate, because <script setup> internals are
    // not reachable on vm and because this is the path a person walks.
    await wrapper.get('[data-roi="menu-action-delete"]').trigger("click");
    await flushPromises();

    await wrapper.get('[data-roi="erase-acknowledge"] input').setValue(true);
    await wrapper.get("input.confirm-input").setValue("ERASE");
    await wrapper.get('[data-roi="erase-confirm-cta"]').trigger("click");
    await flushPromises();

    const html = wrapper.html();
    expect(html).toContain("Enter your PIN to confirm deletion");

    // The keypad is what proves the component resolved. An unrecognised
    // <PinInput> would leave the prompt with nothing under it.
    expect(wrapper.find('[data-roi="pin-input"]').exists()).toBe(true);
    expect(wrapper.find('[data-roi="pin-keypad"]').exists()).toBe(true);
    expect(html.toLowerCase()).not.toContain("<pininput");
  });

  /**
   * The button lit up on the checkbox alone, so it could be pressed on a
   * destructive screen only to answer that a field was empty.
   */
  it("stays out of reach until both the box and the word are done", async () => {
    wrapper = mount(UserMenu);
    await flushPromises();
    await wrapper.get('[data-roi="menu-action-delete"]').trigger("click");
    await flushPromises();

    const cta = () =>
      wrapper!.get('[data-roi="erase-confirm-cta"]').element as HTMLButtonElement;

    expect(cta().disabled).toBe(true);

    await wrapper.get('[data-roi="erase-acknowledge"] input').setValue(true);
    expect(cta().disabled, "the box alone is not enough").toBe(true);

    await wrapper.get("input.confirm-input").setValue("ERAS");
    expect(cta().disabled, "a partial word is not enough").toBe(true);

    await wrapper.get("input.confirm-input").setValue("erase");
    expect(cta().disabled, "case should not matter").toBe(false);
  });

  /** Same defect as the PIN dead end in StartView, on a worse screen. */
  it("empties the keypad after a refused PIN", async () => {
    unlock.mockResolvedValue(null);

    wrapper = mount(UserMenu);
    await flushPromises();
    await wrapper.get('[data-roi="menu-action-delete"]').trigger("click");
    await flushPromises();
    await wrapper.get('[data-roi="erase-acknowledge"] input').setValue(true);
    await wrapper.get("input.confirm-input").setValue("ERASE");
    await wrapper.get('[data-roi="erase-confirm-cta"]').trigger("click");
    await flushPromises();

    const keypad = wrapper.get('[data-roi="pin-keypad"]');
    for (const digit of "000000") {
      await keypad.findAll("button").find((b) => b.text() === digit)!.trigger("click");
    }
    await flushPromises();
    await flushPromises();

    expect(wrapper.html()).toContain("Incorrect PIN");
    expect(
      wrapper.findAll('[data-roi="pin-dots-rail"] .pin-dot--filled'),
      "the dots should be empty, ready for the next attempt"
    ).toHaveLength(0);
  });
});
