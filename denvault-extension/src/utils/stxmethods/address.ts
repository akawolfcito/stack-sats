/**
 * Whether a string is a Stacks address, decided by c32check rather than
 * by a length we guessed.
 *
 * The schemas required SP/ST followed by 33 to 41 characters. c32 strips
 * leading zeros, so valid addresses can be far shorter, and every Stacks
 * boot contract is exactly that: pox-4 lives at
 * ST000000000000000000002AMW42H, 29 characters in total. A dApp calling
 * it got "Invalid parameters" before a handler ever saw the request, so
 * stacking, BNS and every other system contract were unreachable.
 *
 * Decoding also checks the checksum, which a regex cannot do.
 */

import { c32addressDecode } from 'c32check';

export function isStacksAddress(value: string): boolean {
  if (!value.startsWith('SP') && !value.startsWith('ST')) return false;

  try {
    c32addressDecode(value);
    return true;
  } catch {
    return false;
  }
}

/** Clarity contract names: a letter, then letters, digits, `_` or `-`. */
const CONTRACT_NAME = /^[a-zA-Z][a-zA-Z0-9_-]{0,127}$/;

/** Whether a string is `address.contract-name`. */
export function isContractId(value: string): boolean {
  const separator = value.indexOf('.');
  if (separator === -1) return false;

  const address = value.slice(0, separator);
  const name = value.slice(separator + 1);

  return isStacksAddress(address) && CONTRACT_NAME.test(name);
}
