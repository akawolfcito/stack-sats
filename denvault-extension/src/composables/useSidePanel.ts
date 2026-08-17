import { secureLog } from "@/utils/security/logger";

/** Matches side_panel.default_path in the manifest. */
export const SIDE_PANEL_PATH = "index.html?view=sidepanel";

export type OpenSidePanelOutcome =
  | "sidepanel"
  | "fallback"
  | "failed"
  | "unavailable";

/**
 * Open the wallet in Chrome's side panel.
 *
 * Called straight from the click handler on purpose: chrome.sidePanel.open()
 * only works while a user gesture is being handled, and a round trip to the
 * service worker is a good way to lose it.
 *
 * The panel matters beyond convenience. Background delivers a dApp approval
 * to a side panel open in the same window as the requesting tab, and that
 * panel is usually already unlocked, so the request does not spend the
 * dApp's patience on a PIN. Until this entry point existed the only way in
 * was Chrome's own extensions menu.
 *
 * @returns what actually happened, so the caller can decide whether to
 * close itself.
 */
export async function openSidePanel(): Promise<OpenSidePanelOutcome> {
  if (typeof chrome === "undefined" || !chrome.runtime) {
    secureLog("Side panel not available outside the extension");
    return "unavailable";
  }

  try {
    if (chrome.sidePanel && chrome.windows?.getCurrent) {
      const current = await chrome.windows.getCurrent();
      await chrome.sidePanel.setOptions({
        enabled: true,
        path: SIDE_PANEL_PATH,
      });
      if (current?.id !== undefined) {
        await chrome.sidePanel.open({ windowId: current.id });
        return "sidepanel";
      }
    }
  } catch (error) {
    console.warn("[StacksWallet] Side panel open failed:", error);
  }

  // Background retries with the active tab's window and, failing that,
  // opens the wallet as a full page.
  try {
    await chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" });
    return "fallback";
  } catch (error) {
    console.warn("[StacksWallet] Side panel fallback failed:", error);
    return "failed";
  }
}
