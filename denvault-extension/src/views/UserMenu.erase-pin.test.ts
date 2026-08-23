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

vi.mock("@/utils/wallets", () => ({
  getWalletsAsync: vi.fn().mockResolvedValue([{ id: "w1", name: "Wallet 1" }]),
  getWalletCountAsync: vi.fn().mockResolvedValue(1),
}));
vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn() }));
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
});
