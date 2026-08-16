/**
 * Keeps the MV3 service worker alive while an approval window is open.
 *
 * Chrome terminates an idle service worker after about 30 seconds, and the
 * request queue lives in that worker's memory (activeRequest, requestQueue,
 * uiReady in public/background.js). The popup sends UI_READY once and then
 * goes quiet while the user reads the request and types a PIN, which is
 * easily longer than 30s. The worker dies, its 55s timeout timer dies with
 * it, injection.js falls through to its own 60s timeout, and the approval
 * the user eventually gives lands on a restarted worker whose activeRequest
 * is null, so it is dropped without a word.
 *
 * A connected port plus regular traffic over it resets the idle timer, so
 * the worker survives exactly as long as the window the user is looking at.
 *
 * This is a mitigation, not durability: a crashed worker still loses the
 * queue. Persisting the queue in chrome.storage.session with chrome.alarms
 * is the durable answer and is tracked separately.
 */

export const KEEPALIVE_PORT_NAME = "denvault-keepalive";

/** Comfortably under Chrome's ~30s idle cutoff. */
export const KEEPALIVE_INTERVAL_MS = 20000;

/**
 * Open the keepalive port and start pinging.
 *
 * @returns a function that stops pinging and closes the port. Safe to call
 * outside an extension context, where it does nothing.
 */
export function startBackgroundKeepalive(): () => void {
  if (typeof chrome === "undefined" || !chrome.runtime?.connect) {
    return () => {};
  }

  let port: chrome.runtime.Port | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  const open = (): void => {
    if (stopped) return;

    // The id is explicit because chrome-types only declares the
    // connect(extensionId?, connectInfo?) overload. Connecting to our own
    // id behaves exactly like the object-only shorthand.
    port = chrome.runtime.connect(chrome.runtime.id, {
      name: KEEPALIVE_PORT_NAME,
    });
    // The worker can still recycle the port. Reopen so a long approval
    // does not silently lose its lifeline.
    port.onDisconnect.addListener(() => {
      port = null;
      open();
    });
  };

  open();

  timer = setInterval(() => {
    port?.postMessage({ type: "KEEPALIVE" });
  }, KEEPALIVE_INTERVAL_MS);

  return () => {
    stopped = true;
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    port?.disconnect();
    port = null;
  };
}
