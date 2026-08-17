/**
 * A one-time, short-lived permission to reveal the recovery phrase.
 *
 * The phrase used to be visible exactly once, while creating the wallet, and
 * never again. That left anyone who lost their paper copy depending on the
 * extension staying installed, which is not what self-custody promises. The
 * reveal screen closes that gap, so it has to be as hard to reach as the
 * secret behind it.
 *
 * Two things it deliberately does not rely on:
 *
 * - An unlocked session. The wallet stays unlocked for minutes at a time, so
 *   reading the mnemonic straight from the session would let anyone in front
 *   of an open popup see the seed by typing a route.
 * - A query parameter. `?pinVerified=true` is a string in a URL; it proves
 *   nothing about a PIN having been entered.
 *
 * Instead the grant lives in module memory, so it dies with the popup, is
 * issued only by a successful PIN verification, is spent by the first reveal,
 * and expires on its own if the user wanders off.
 */

/** Long enough to walk from the keypad to the phrase, short enough to matter. */
export const GRANT_TTL_MS = 60_000;

/** When the current grant stops being valid; null when there is none. */
let expiresAt: number | null = null;

/** Issue a grant. Called only after the PIN has been verified. */
export function grantReveal(now: number = Date.now()): void {
  expiresAt = now + GRANT_TTL_MS;
}

/**
 * Spend the grant.
 *
 * @returns true if the phrase may be shown, and never true twice for the same
 * PIN entry: a second look costs a second PIN.
 */
export function consumeReveal(now: number = Date.now()): boolean {
  const granted = expiresAt !== null && now < expiresAt;
  expiresAt = null;
  return granted;
}

/** Drop the grant, for leaving the screen or locking the wallet. */
export function clearReveal(): void {
  expiresAt = null;
}
