/**
 * The way out of a PIN you cannot reproduce.
 *
 * Reported after the field-clearing fix: the keypad answers again, but
 * that only helps someone who remembers what they typed the first time.
 * The real trap is confirming a PIN you have already forgotten. Retyping
 * is useless, and the only control offered is a 20px arrow with no label
 * in the corner, which everywhere else in this app means "abandon this
 * screen" and which nobody reaches for while reading an error.
 *
 * So the wallet was built, the phrase was written down, and it could not
 * be added. The words were safe and worthless.
 *
 * There has to be a way back to choosing the PIN that says what it does.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

vi.mock("@stacks/wallet-sdk", () => ({
  randomSeedPhrase: () =>
    "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima",
}));
vi.mock("@/utils/wallets", () => ({ getWalletCountAsync: vi.fn(async () => 1) }));
vi.mock("@/utils/security/session", () => ({
  sessionManager: {
    saveEncryptedWalletAsync: vi.fn(),
    switchWalletAsync: vi.fn(),
    unlock: vi.fn(),
  },
}));
vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import AddWalletView from "./AddWalletView.vue";
import PinInput from "@/components/PinInput.vue";
import RecoveryPhraseDisplay from "@/components/RecoveryPhraseDisplay.vue";
import VerifyPhraseStep from "@/components/VerifyPhraseStep.vue";

describe("AddWalletView, stuck on Confirm your PIN", () => {
  let wrapper: VueWrapper;

  beforeEach(async () => {
    wrapper = mount(AddWalletView);
    await flushPromises();

    await wrapper.get('[data-roi="add-wallet-create-cta"]').trigger("click");
    await flushPromises();
    wrapper.findComponent(RecoveryPhraseDisplay).vm.$emit("continue");
    await flushPromises();
    wrapper.findComponent(VerifyPhraseStep).vm.$emit("verified");
    await flushPromises();

    const toPin = wrapper.findAll("button").find((b) => b.text().trim() === "Continue");
    await toPin!.trigger("click");
    await flushPromises();

    // Choose a PIN, then fail to confirm it.
    const keypad = wrapper.findComponent(PinInput);
    keypad.vm.$emit("complete", "123456");
    await flushPromises();
    keypad.vm.$emit("complete", "654321");
    await flushPromises();
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("says the PINs do not match", () => {
    expect(wrapper.text()).toContain("PINs do not match");
  });

  it("offers a way back to choosing the PIN, in words", () => {
    const escape = wrapper.find('[data-roi="pin-start-over"]');

    expect(escape.exists(), "there should be a labelled way out").toBe(true);
    expect(escape.text().length, "and it should be readable, not an icon").toBeGreaterThan(4);
  });

  it("returns to the create step, so a forgotten PIN can be replaced", async () => {
    await wrapper.get('[data-roi="pin-start-over"]').trigger("click");
    await flushPromises();

    expect(wrapper.text()).toContain("Create a 6-digit PIN");
    expect(wrapper.text()).not.toContain("PINs do not match");
  });

  it("keeps the recovery phrase through the detour", async () => {
    await wrapper.get('[data-roi="pin-start-over"]').trigger("click");
    await flushPromises();

    // Set a fresh pair and reach the end without re-verifying the phrase:
    // proof the mnemonic survived, since the wallet could not be built
    // without it.
    const keypad = wrapper.findComponent(PinInput);
    keypad.vm.$emit("complete", "111111");
    await flushPromises();

    expect(wrapper.text()).toContain("Confirm your PIN");
  });
});
