/**
 * What the keypad does after a wrong confirmation.
 *
 * PinInput keeps six slots and writes into the first empty one. With all
 * six full, currentIndex is 6, the `index < PIN_LENGTH` guard drops the
 * keypress, and nothing on screen moves. So a screen that reports "PINs do
 * not match" without clearing the field leaves a keypad that answers no
 * key at all: the user is told to try again by a control that has stopped
 * working. Backspace still frees a slot, but nothing says so.
 *
 * StartView and AddWalletView both left the field full on mismatch. This
 * pins the behaviour the fix depends on.
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import PinInput from "./PinInput.vue";

/** Press digits in order, as a person would. */
async function type(wrapper: ReturnType<typeof mount>, digits: string) {
  for (const digit of digits) {
    const key = wrapper
      .findAll("button")
      .find((b) => b.text().trim() === digit);
    expect(key, `no key for ${digit}`).toBeTruthy();
    await key!.trigger("click");
  }
}

describe("PinInput after a full entry", () => {
  it("ignores every key while all six slots are full", async () => {
    const wrapper = mount(PinInput);
    await type(wrapper, "123456");

    const before = wrapper.emitted("change")?.length ?? 0;
    await type(wrapper, "9");

    expect(wrapper.emitted("change")?.length ?? 0).toBe(before);
  });

  it("takes keys again once cleared", async () => {
    const wrapper = mount(PinInput);
    await type(wrapper, "123456");

    (wrapper.vm as unknown as { clear: () => void }).clear();
    await wrapper.vm.$nextTick();

    const before = wrapper.emitted("change")?.length ?? 0;
    await type(wrapper, "9");

    expect(wrapper.emitted("change")?.length ?? 0).toBe(before + 1);
    expect(wrapper.emitted("change")?.at(-1)?.[0]).toBe("9");
  });

  it("emits complete again on a second full entry after clearing", async () => {
    const wrapper = mount(PinInput);
    await type(wrapper, "111111");
    expect(wrapper.emitted("complete")).toHaveLength(1);

    (wrapper.vm as unknown as { clear: () => void }).clear();
    await wrapper.vm.$nextTick();
    await type(wrapper, "222222");

    expect(wrapper.emitted("complete")).toHaveLength(2);
    expect(wrapper.emitted("complete")?.at(-1)?.[0]).toBe("222222");
  });
});
