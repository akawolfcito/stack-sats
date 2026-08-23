/**
 * What happens to the session when a second wallet is created.
 *
 * addWalletAsync only assigns activeId when the entry is the first one, so
 * every later wallet was stored without being activated. The view then
 * called sessionManager.unlock(pin) with the new PIN while the previous
 * wallet was still the active one, and:
 *
 *   1. with different PINs the decryption failed, unlock returned null,
 *      and the null was dropped: the next line navigated to /user as
 *      though nothing had happened;
 *   2. that failure counted against the previous wallet's lockout, so
 *      creating a wallet silently spent an attempt on another one;
 *   3. with the same PIN everything appeared to work, which is why it
 *      survived this long.
 *
 * The wallet you just made is the one you should land in, and the PIN was
 * typed twice seconds ago, so there is nothing to ask again.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

const { calls, state, push, saveEncryptedWalletAsync, switchWalletAsync, unlock } = vi.hoisted(() => {
  const calls: string[] = [];
  const state = { unlockResult: "the decrypted mnemonic" as string | null };
  return {
    calls,
    state,
    push: vi.fn(),
    saveEncryptedWalletAsync: vi.fn(async () => {
      calls.push("save");
      return { id: "w2", name: "Test Wallet", createdAt: 2 };
    }),
    switchWalletAsync: vi.fn(async (id: string) => {
      calls.push(`switch:${id}`);
    }),
    unlock: vi.fn(async () => {
      calls.push("unlock");
      return state.unlockResult;
    }),
  };
});

vi.mock("@stacks/wallet-sdk", () => ({
  randomSeedPhrase: () =>
    "alpha bravo charlie delta echo foxtrot golf hotel india juliet kilo lima",
}));

vi.mock("@/utils/security/session", () => ({
  sessionManager: { saveEncryptedWalletAsync, switchWalletAsync, unlock },
}));

vi.mock("@/utils/security/encryption", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  encryptWithPIN: vi.fn(async () => ({ ciphertext: "c", iv: "i", salt: "s" })),
}));

// getWalletCountAsync reaches the vault, which without this hangs on the
// chrome.storage stub and leaves the flow parked on the verify step.
vi.mock("@/utils/wallets", () => ({ getWalletCountAsync: vi.fn(async () => 1) }));

vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import AddWalletView from "./AddWalletView.vue";
import PinInput from "@/components/PinInput.vue";
import RecoveryPhraseDisplay from "@/components/RecoveryPhraseDisplay.vue";
import VerifyPhraseStep from "@/components/VerifyPhraseStep.vue";

describe("AddWalletView creating a second wallet", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    calls.length = 0;
    push.mockClear();
    unlock.mockClear();
    switchWalletAsync.mockClear();
    state.unlockResult = "the decrypted mnemonic";
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  /** Walk the flow up to the confirm step and enter `confirmPin` there. */
  async function createWallet(pin: string, confirmPin: string) {
    wrapper = mount(AddWalletView);
    await flushPromises();

    await wrapper.get('[data-roi="add-wallet-create-cta"]').trigger("click");
    await flushPromises();

    // The phrase and verification steps only gate progress; what gets
    // built is the same either way, so they are driven straight from the
    // components that own them.
    wrapper.findComponent(RecoveryPhraseDisplay).vm.$emit("continue");
    await flushPromises();
    wrapper.findComponent(VerifyPhraseStep).vm.$emit("verified");
    await flushPromises();

    const continueToPin = wrapper
      .findAll("button")
      .find((b) => b.text().trim() === "Continue");
    expect(continueToPin, "no Continue on the name step").toBeTruthy();
    await continueToPin!.trigger("click");
    await flushPromises();

    const keypad = wrapper.findComponent(PinInput);
    keypad.vm.$emit("complete", pin);
    await flushPromises();
    keypad.vm.$emit("complete", confirmPin);
    await flushPromises();
  }

  it("activates the new wallet before unlocking it", async () => {
    await createWallet("123456", "123456");

    expect(calls).toEqual(["save", "switch:w2", "unlock"]);
  });

  it("lands in the wallet that was just created", async () => {
    await createWallet("123456", "123456");

    expect(push).toHaveBeenCalledWith({ path: "/user" });
  });

  it("does not navigate when the unlock fails", async () => {
    state.unlockResult = null;

    await createWallet("123456", "123456");

    expect(push).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/unlock|PIN|wallet/i);
  });
});
