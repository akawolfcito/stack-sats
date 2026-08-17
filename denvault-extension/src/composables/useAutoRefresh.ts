/**
 * Keep the wallet's view of the chain current on its own.
 *
 * Nothing refreshed unless the user pressed the refresh icon. So a
 * transaction that had already been broadcast, and in several cases
 * already mined, left no trace on screen: the balance was the old one and
 * Activity was the old list. On 2026-08-17 that produced two contract
 * deploys and two contract calls, each one sent twice, because the first
 * looked like it had done nothing. In testnet that costs play money.
 *
 * Two triggers, both cheap:
 *
 * - Coming back into view. Reopening the popup or returning to the tab is
 *   the exact moment someone is asking "did it go through?".
 * - A poll while something is pending, backing off once nothing is.
 *
 * Nothing polls while the surface is hidden: there is no point asking the
 * network about a screen nobody is looking at.
 */

import type { Ref } from "vue";

/** While a transaction is unconfirmed. Stacks blocks land in minutes. */
export const PENDING_POLL_MS = 10_000;

/** Otherwise: enough to catch an incoming payment without hammering. */
export const IDLE_POLL_MS = 60_000;

export interface AutoRefreshOptions {
  onRefresh: () => void;
  /** True while any transaction on screen is still unconfirmed. */
  hasPending: Ref<boolean>;
}

/**
 * @returns a function that stops every timer and listener it installed.
 */
export function startAutoRefresh({
  onRefresh,
  hasPending,
}: AutoRefreshOptions): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  const isVisible = () =>
    typeof document === "undefined" || document.visibilityState === "visible";

  function schedule() {
    if (stopped) return;
    if (timer !== null) clearTimeout(timer);

    timer = setTimeout(() => {
      if (stopped) return;
      if (isVisible()) onRefresh();
      schedule();
    }, hasPending.value ? PENDING_POLL_MS : IDLE_POLL_MS);
  }

  function handleVisibility() {
    if (stopped || !isVisible()) return;
    onRefresh();
    // Restart the clock: a refresh just happened.
    schedule();
  }

  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", handleVisibility);
  }
  schedule();

  return () => {
    stopped = true;
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", handleVisibility);
    }
  };
}
