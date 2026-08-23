/**
 * Open a link without taking the wallet down with it.
 *
 * `window.open` from an extension popup moves focus to the new tab, and a
 * popup that loses focus closes. So following an explorer link from the
 * popup opened the page and shut the wallet: the user came back to
 * nothing, having asked only to read a transaction. In the side panel it
 * is harmless, which is why this went unnoticed until someone tried it in
 * the popup.
 *
 * chrome.tabs.create does the same job without the popup being the one
 * that asked, so nothing closes.
 */

import { secureLog } from "../security/logger";

/**
 * @param url an absolute http(s) URL. Anything else is refused: this
 *   function exists to open explorers, and a javascript: or data: URL
 *   arriving here would mean something has gone wrong upstream.
 */
export function openExternalTab(url: string): void {
  if (!/^https?:\/\//i.test(url)) {
    secureLog("Refused to open a non-http URL", { url: url.slice(0, 24) });
    return;
  }

  if (typeof chrome !== "undefined" && chrome.tabs?.create) {
    chrome.tabs.create({ url });
    return;
  }

  // Outside the extension, in tests and in the dev server.
  window.open(url, "_blank", "noopener,noreferrer");
}
