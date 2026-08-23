/**
 * The permission to reveal the recovery phrase.
 *
 * Revealing the seed is the single most sensitive thing this wallet does, and
 * until now it was impossible: the phrase was shown once during creation and
 * never again. Adding a way to see it again must not also add a way to see it
 * without the PIN.
 *
 * An unlocked session is not enough. Someone who walks up to an open popup
 * would otherwise reach the phrase by typing a route. Neither is a query
 * parameter, which is a string in a URL that anything can write. So the grant
 * lives in memory, is issued only by a successful PIN verification, works
 * once, and expires on its own.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { grantReveal, consumeReveal, clearReveal, GRANT_TTL_MS } from './grant';

describe('reveal grant', () => {
  beforeEach(() => {
    clearReveal();
  });

  it('refuses when nothing was ever granted', () => {
    expect(consumeReveal()).toBe(false);
  });

  it('allows exactly one reveal after a PIN verification', () => {
    grantReveal();

    expect(consumeReveal()).toBe(true);
    // A second look needs a second PIN. Going back and forward in the popup
    // must not reopen the phrase.
    expect(consumeReveal()).toBe(false);
  });

  it('expires on its own', () => {
    const issued = 1_000_000;
    grantReveal(issued);

    expect(consumeReveal(issued + GRANT_TTL_MS + 1)).toBe(false);
  });

  it('still works just before it expires', () => {
    const issued = 1_000_000;
    grantReveal(issued);

    expect(consumeReveal(issued + GRANT_TTL_MS - 1)).toBe(true);
  });

  it('is forgotten on demand, for leaving the screen', () => {
    grantReveal();
    clearReveal();

    expect(consumeReveal()).toBe(false);
  });

  it('does not survive in any storage', () => {
    grantReveal();

    // Nothing about a permission to show a seed phrase belongs on disk, where
    // it would outlive the popup and the session that earned it.
    const persisted = [
      ...Object.keys(localStorage),
      ...Object.keys(sessionStorage),
    ].join(' ');

    expect(persisted).not.toMatch(/reveal/i);
  });
});
