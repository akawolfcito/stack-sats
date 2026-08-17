/**
 * @vitest-environment node
 *
 * Address validation, against the real c32check.
 *
 * The schemas hand-rolled a length: SP/ST followed by 33 to 41 c32
 * characters. c32 strips leading zeros, so a valid address can be much
 * shorter than that, and every Stacks boot contract is exactly that case.
 * Calling pox-4 at ST000000000000000000002AMW42H, 29 characters, was
 * rejected as "Invalid parameters" before it reached a handler: stacking,
 * BNS and every other system contract were unreachable from a dApp.
 */

import { describe, it, expect } from 'vitest';
import { isStacksAddress, isContractId } from './address';

describe('isStacksAddress', () => {
  it('accepts a boot address, which is shorter than a normal one', () => {
    expect(isStacksAddress('ST000000000000000000002AMW42H')).toBe(true);
    expect(isStacksAddress('SP000000000000000000002Q6VF78')).toBe(true);
  });

  it('accepts an ordinary account address', () => {
    expect(isStacksAddress('ST2NJ5K0XKKPTSDZ0KGZF5XRFZTVDQK56VQQWSJBQ')).toBe(
      true
    );
  });

  it('rejects anything c32 cannot decode', () => {
    expect(isStacksAddress('no-an-address')).toBe(false);
    expect(isStacksAddress('')).toBe(false);
    // A Bitcoin address is not a Stacks one, however plausible it looks.
    expect(isStacksAddress('mw7qXcn8GSjKHLXQZJ5YVzzGvyij3rLiVX')).toBe(false);
  });

  it('rejects an address whose checksum does not hold', () => {
    // Last character altered: the shape survives, the checksum does not.
    expect(isStacksAddress('ST2NJ5K0XKKPTSDZ0KGZF5XRFZTVDQK56VQQWSJBA')).toBe(
      false
    );
  });
});

describe('isContractId', () => {
  it('accepts the boot contract a stacking dApp calls', () => {
    expect(isContractId('ST000000000000000000002AMW42H.pox-4')).toBe(true);
  });

  it('accepts an ordinary deployed contract', () => {
    expect(
      isContractId('ST2NJ5K0XKKPTSDZ0KGZF5XRFZTVDQK56VQQWSJBQ.registered-emerald-fowl')
    ).toBe(true);
  });

  it('rejects a missing or malformed name', () => {
    expect(isContractId('ST000000000000000000002AMW42H')).toBe(false);
    expect(isContractId('ST000000000000000000002AMW42H.')).toBe(false);
    expect(isContractId('ST000000000000000000002AMW42H.9starts-with-digit')).toBe(
      false
    );
  });

  it('rejects a bad address even with a good name', () => {
    expect(isContractId('NOTANADDRESS.pox-4')).toBe(false);
  });
});
