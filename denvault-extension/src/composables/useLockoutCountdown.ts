/**
 * Lockout countdown (issue #18).
 *
 * `LockoutManager` already expires a lockout on its own — 30s, then 2min,
 * 10min, 1hr. But nothing polled it, so the unlock screen stayed disabled
 * forever and told the user to reset the wallet, destroying it over a
 * temporary block.
 *
 * This polls the session's lockout surface on a timer, exposes the
 * remaining time for display, and flips back to unlocked by itself the
 * moment the block expires.
 */

import { computed, ref, type ComputedRef, type Ref } from "vue";

/** The slice of sessionManager this countdown observes. */
export interface LockoutSource {
  readonly isLockedOut: boolean;
  readonly lockoutRemainingMs: number;
}

export interface LockoutCountdown {
  isLockedOut: Ref<boolean>;
  remainingMs: Ref<number>;
  remainingLabel: ComputedRef<string>;
  /** Sync now and keep ticking while locked out. Idempotent. */
  start(): void;
  /** Stop ticking. Safe to call when not running. */
  stop(): void;
}

const DEFAULT_INTERVAL_MS = 500;

/**
 * Format a remaining duration for display.
 *
 * Seconds round up so the label never reads 0:00 while the user is still
 * blocked. Durations of an hour or more get an h:mm:ss form.
 */
export function formatLockoutRemaining(ms: number): string {
  if (ms <= 0) return "0:00";

  const totalSeconds = Math.ceil(ms / 1000);
  const seconds = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const minutes = totalMinutes % 60;
  const hours = Math.floor(totalMinutes / 60);

  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

export function useLockoutCountdown(
  source: LockoutSource,
  options: { intervalMs?: number } = {}
): LockoutCountdown {
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;

  const isLockedOut = ref(source.isLockedOut);
  const remainingMs = ref(source.lockoutRemainingMs);
  const remainingLabel = computed(() => formatLockoutRemaining(remainingMs.value));

  let timer: ReturnType<typeof setInterval> | null = null;

  function stop(): void {
    if (timer === null) return;
    clearInterval(timer);
    timer = null;
  }

  function sync(): void {
    isLockedOut.value = source.isLockedOut;
    remainingMs.value = source.lockoutRemainingMs;
    // Nothing left to count: release the keypad and drop the timer.
    if (!isLockedOut.value) stop();
  }

  function start(): void {
    sync();
    if (!isLockedOut.value || timer !== null) return;
    timer = setInterval(sync, intervalMs);
  }

  return { isLockedOut, remainingMs, remainingLabel, start, stop };
}
