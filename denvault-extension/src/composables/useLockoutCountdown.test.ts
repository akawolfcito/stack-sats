/**
 * Tests for the lockout countdown (issue #18).
 *
 * Before this, UnlockView showed "Too many attempts. Reset wallet to
 * continue." and disabled the keypad terminally, so the only escape from
 * a temporary lockout was destroying the wallet. LockoutManager already
 * expires the lockout on its own; the UI just never observed it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { formatLockoutRemaining, useLockoutCountdown } from "./useLockoutCountdown";

describe("formatLockoutRemaining", () => {
  it("renders sub-minute lockouts as m:ss", () => {
    expect(formatLockoutRemaining(30_000)).toBe("0:30");
    expect(formatLockoutRemaining(1_000)).toBe("0:01");
  });

  it("rounds partial seconds up so the label never reads 0:00 while locked", () => {
    expect(formatLockoutRemaining(1)).toBe("0:01");
    expect(formatLockoutRemaining(29_400)).toBe("0:30");
  });

  it("renders the escalated durations", () => {
    expect(formatLockoutRemaining(120_000)).toBe("2:00");
    expect(formatLockoutRemaining(600_000)).toBe("10:00");
    expect(formatLockoutRemaining(3_600_000)).toBe("1:00:00");
  });

  it("renders zero and negative input as 0:00", () => {
    expect(formatLockoutRemaining(0)).toBe("0:00");
    expect(formatLockoutRemaining(-5_000)).toBe("0:00");
  });
});

describe("useLockoutCountdown", () => {
  let now: number;
  let lockedUntil: number;

  /** Stand-in for sessionManager's lockout surface. */
  const source = {
    get isLockedOut() {
      return now < lockedUntil;
    },
    get lockoutRemainingMs() {
      return Math.max(0, lockedUntil - now);
    },
  };

  function advance(ms: number) {
    now += ms;
    vi.advanceTimersByTime(ms);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    now = 0;
    lockedUntil = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("reports not locked out when the session is free", () => {
    const countdown = useLockoutCountdown(source);
    countdown.start();

    expect(countdown.isLockedOut.value).toBe(false);
    expect(countdown.remainingLabel.value).toBe("0:00");
    countdown.stop();
  });

  it("exposes the remaining time while locked out", () => {
    lockedUntil = 30_000;
    const countdown = useLockoutCountdown(source);
    countdown.start();

    expect(countdown.isLockedOut.value).toBe(true);
    expect(countdown.remainingLabel.value).toBe("0:30");

    advance(10_000);
    expect(countdown.remainingLabel.value).toBe("0:20");

    countdown.stop();
  });

  it("clears the lockout by itself once it expires", () => {
    lockedUntil = 30_000;
    const countdown = useLockoutCountdown(source);
    countdown.start();

    expect(countdown.isLockedOut.value).toBe(true);

    advance(30_000);

    // This is the fix: no user action, no wallet reset — the keypad
    // comes back on its own.
    expect(countdown.isLockedOut.value).toBe(false);
    expect(countdown.remainingLabel.value).toBe("0:00");

    countdown.stop();
  });

  it("stops ticking after the lockout expires", () => {
    lockedUntil = 30_000;
    const countdown = useLockoutCountdown(source);
    countdown.start();

    advance(30_000);
    expect(vi.getTimerCount()).toBe(0);

    countdown.stop();
  });

  it("stop() halts the timer while still locked out", () => {
    lockedUntil = 60_000;
    const countdown = useLockoutCountdown(source);
    countdown.start();

    expect(vi.getTimerCount()).toBeGreaterThan(0);
    countdown.stop();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("start() is idempotent and does not stack timers", () => {
    lockedUntil = 60_000;
    const countdown = useLockoutCountdown(source);
    countdown.start();
    const timers = vi.getTimerCount();
    countdown.start();

    expect(vi.getTimerCount()).toBe(timers);
    countdown.stop();
  });

  it("picks up a lockout that starts after the countdown was created", () => {
    const countdown = useLockoutCountdown(source);
    countdown.start();
    expect(countdown.isLockedOut.value).toBe(false);

    // A failed attempt trips the lockout; the view calls start() again.
    lockedUntil = now + 120_000;
    countdown.start();

    expect(countdown.isLockedOut.value).toBe(true);
    expect(countdown.remainingLabel.value).toBe("2:00");
    countdown.stop();
  });
});
