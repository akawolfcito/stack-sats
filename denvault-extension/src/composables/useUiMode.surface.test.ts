/**
 * Which surface the wallet is being shown in.
 *
 * The unlock screen offers "Open in side panel" and hides it with
 * `v-if="!isSidePanel"`. It kept appearing inside the side panel, offering
 * to open the thing already open.
 *
 * Two reasons, and the second is the one that bites. isSidePanel is only
 * true when the URL carries ?view=sidepanel, so a tall surface without it
 * reads as "panel" instead. And handleResize recomputes the mode from
 * viewport height alone, which can only answer popup or panel, so the
 * first resize discards what the URL said. A side panel resizes whenever
 * the window does.
 *
 * The URL is a statement of fact about the surface. Height is a guess.
 * A guess must not overwrite a fact.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { defineComponent, h } from "vue";
import { mount } from "@vue/test-utils";
import { useUiMode } from "./useUiMode";

/** Mount a probe that exposes what useUiMode decided. */
function probe() {
  const seen: { mode?: string; isPopup?: boolean; isSidePanel?: boolean } = {};
  const Probe = defineComponent({
    setup() {
      const ui = useUiMode();
      return () => {
        seen.mode = ui.mode.value;
        seen.isPopup = ui.isPopup.value;
        seen.isSidePanel = ui.isSidePanel.value;
        return h("div");
      };
    },
  });
  const wrapper = mount(Probe);
  return { seen, wrapper };
}

function setSurface(search: string, height: number) {
  Object.defineProperty(window, "location", {
    value: { ...window.location, search },
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "innerHeight", {
    value: height,
    writable: true,
    configurable: true,
  });
}

describe("useUiMode", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("believes the URL over the viewport", () => {
    setSurface("?view=sidepanel", 800);
    const { seen, wrapper } = probe();

    expect(seen.mode).toBe("sidepanel");
    expect(seen.isSidePanel).toBe(true);
    wrapper.unmount();
  });

  it("keeps believing it after a resize", async () => {
    setSurface("?view=sidepanel", 800);
    const { seen, wrapper } = probe();

    // A side panel resizes whenever its window does.
    Object.defineProperty(window, "innerHeight", { value: 500, configurable: true });
    window.dispatchEvent(new Event("resize"));
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    expect(seen.mode, "the URL said sidepanel and nothing changed that").toBe("sidepanel");
    expect(seen.isSidePanel).toBe(true);
    wrapper.unmount();
  });

  it("keeps believing fullpage after a resize too", async () => {
    setSurface("?view=fullpage", 900);
    const { seen, wrapper } = probe();

    Object.defineProperty(window, "innerHeight", { value: 400, configurable: true });
    window.dispatchEvent(new Event("resize"));
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    expect(seen.mode).toBe("fullpage");
    expect(seen.isPopup).toBe(false);
    wrapper.unmount();
  });

  it("still guesses from height when the URL says nothing", async () => {
    setSurface("", 500);
    const { seen, wrapper } = probe();
    expect(seen.isPopup).toBe(true);

    Object.defineProperty(window, "innerHeight", { value: 800, configurable: true });
    window.dispatchEvent(new Event("resize"));
    await vi.runAllTimersAsync();
    await wrapper.vm.$nextTick();

    expect(seen.isPopup).toBe(false);
    wrapper.unmount();
  });
});
