import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LockoutManager } from "./lockout";

describe("LockoutManager", () => {
  let lockout: LockoutManager;

  beforeEach(() => {
    lockout = new LockoutManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should not be locked out initially", () => {
    expect(lockout.isLockedOut()).toBe(false);
    expect(lockout.failedAttempts).toBe(0);
  });

  it("should track failed attempts", () => {
    lockout.recordFailure();
    expect(lockout.failedAttempts).toBe(1);
    lockout.recordFailure();
    expect(lockout.failedAttempts).toBe(2);
  });

  it("should lock out after 3 failures with 30s duration", () => {
    lockout.recordFailure();
    lockout.recordFailure();
    lockout.recordFailure();
    expect(lockout.isLockedOut()).toBe(true);
    expect(lockout.lockoutRemainingMs).toBeGreaterThan(0);
    expect(lockout.lockoutRemainingMs).toBeLessThanOrEqual(30000);
  });

  it("should escalate lockout duration on repeated failures", () => {
    // 3 failures -> 30s lockout
    for (let i = 0; i < 3; i++) lockout.recordFailure();
    expect(lockout.isLockedOut()).toBe(true);

    // Wait out the lockout
    vi.advanceTimersByTime(30001);
    expect(lockout.isLockedOut()).toBe(false);

    // 3 more -> 2min lockout
    for (let i = 0; i < 3; i++) lockout.recordFailure();
    expect(lockout.lockoutRemainingMs).toBeLessThanOrEqual(120000);
    expect(lockout.lockoutRemainingMs).toBeGreaterThan(30000);
  });

  it("should reset on successful unlock", () => {
    lockout.recordFailure();
    lockout.recordFailure();
    lockout.recordSuccess();
    expect(lockout.failedAttempts).toBe(0);
    expect(lockout.isLockedOut()).toBe(false);
  });

  it("should cap at maximum lockout duration", () => {
    // Trigger 4 lockout cycles
    for (let cycle = 0; cycle < 5; cycle++) {
      for (let i = 0; i < 3; i++) lockout.recordFailure();
      vi.advanceTimersByTime(3_600_001);
    }
    // Should still be capped at 1 hour
    for (let i = 0; i < 3; i++) lockout.recordFailure();
    expect(lockout.lockoutRemainingMs).toBeLessThanOrEqual(3_600_000);
  });
});
