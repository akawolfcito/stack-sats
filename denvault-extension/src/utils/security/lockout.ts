/**
 * Brute-force lockout manager
 * Escalating lockout: 30s -> 2min -> 10min -> 1hr
 */

const LOCKOUT_DURATIONS_MS = [
  30_000, // 30 seconds
  120_000, // 2 minutes
  600_000, // 10 minutes
  3_600_000, // 1 hour
];

const MAX_ATTEMPTS_BEFORE_LOCKOUT = 3;

export class LockoutManager {
  private _failedAttempts = 0;
  private _lockoutUntil = 0;
  private _lockoutLevel = 0;

  get failedAttempts(): number {
    return this._failedAttempts;
  }

  get lockoutRemainingMs(): number {
    const remaining = this._lockoutUntil - Date.now();
    return Math.max(0, remaining);
  }

  isLockedOut(): boolean {
    return Date.now() < this._lockoutUntil;
  }

  recordFailure(): void {
    this._failedAttempts++;

    if (this._failedAttempts >= MAX_ATTEMPTS_BEFORE_LOCKOUT) {
      const duration =
        LOCKOUT_DURATIONS_MS[
          Math.min(this._lockoutLevel, LOCKOUT_DURATIONS_MS.length - 1)
        ];
      this._lockoutUntil = Date.now() + duration;
      this._lockoutLevel++;
      this._failedAttempts = 0; // Reset count for next cycle
    }
  }

  recordSuccess(): void {
    this._failedAttempts = 0;
    this._lockoutUntil = 0;
    this._lockoutLevel = 0;
  }
}
