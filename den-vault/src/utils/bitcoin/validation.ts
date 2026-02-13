/**
 * Bitcoin Address Validation
 *
 * Validates Bitcoin addresses for different types:
 * - P2PKH: Legacy (1...)
 * - P2SH: Script Hash (3...)
 * - P2WPKH: Native SegWit (bc1q...)
 * - P2TR: Taproot (bc1p...)
 *
 * Supports both mainnet and testnet networks.
 */

import { getSelectedNetwork, type NetworkName } from '../network';

/**
 * Bitcoin address type
 */
export type BtcAddressType = 'p2pkh' | 'p2sh' | 'p2wpkh' | 'p2tr' | 'unknown';

/**
 * Validation result with address type
 */
export interface BtcAddressValidationResult {
  valid: boolean;
  addressType?: BtcAddressType;
  error?: string;
}

/**
 * Address prefixes by network
 */
const ADDRESS_PREFIXES = {
  mainnet: {
    p2pkh: '1',
    p2sh: '3',
    bech32: 'bc1',
    bech32m: 'bc1p',
  },
  testnet: {
    p2pkh: ['m', 'n'],
    p2sh: '2',
    bech32: 'tb1',
    bech32m: 'tb1p',
  },
};

/**
 * Base58 character set (Bitcoin uses this for legacy addresses)
 */
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Bech32 character set (for SegWit addresses)
 */
const BECH32_CHARS = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/**
 * Validate Base58 address format
 */
function isValidBase58(address: string): boolean {
  for (const char of address) {
    if (!BASE58_CHARS.includes(char)) {
      return false;
    }
  }
  return true;
}

/**
 * Validate Bech32/Bech32m address format
 * Basic format check (more thorough validation would require full bech32 decoding)
 */
function isValidBech32Format(address: string, prefix: string): boolean {
  const lowerAddr = address.toLowerCase();

  // Must start with prefix
  if (!lowerAddr.startsWith(prefix.toLowerCase())) {
    return false;
  }

  // Get the data part (after prefix)
  const dataPart = lowerAddr.slice(prefix.length);

  // Must have separator '1' after prefix for witness version
  // For bc1q... the 'q' is witness version 0
  // For bc1p... the 'p' is witness version 1
  if (dataPart.length === 0) {
    return false;
  }

  // Check all characters are valid bech32
  for (const char of dataPart) {
    if (!BECH32_CHARS.includes(char)) {
      return false;
    }
  }

  return true;
}

/**
 * Detect BTC address type based on prefix
 */
export function detectAddressType(
  address: string,
  network?: NetworkName
): BtcAddressType {
  const selectedNetwork = network || getSelectedNetwork();
  const isMainnet = selectedNetwork === 'mainnet';
  const prefixes = isMainnet ? ADDRESS_PREFIXES.mainnet : ADDRESS_PREFIXES.testnet;

  const addr = address.trim();

  // Taproot (P2TR) - bc1p... or tb1p...
  if (addr.toLowerCase().startsWith(prefixes.bech32m.toLowerCase())) {
    return 'p2tr';
  }

  // Native SegWit (P2WPKH) - bc1q... or tb1q...
  // Note: bc1q starts with bc1, and we need to check it's not bc1p
  if (addr.toLowerCase().startsWith(prefixes.bech32.toLowerCase())) {
    return 'p2wpkh';
  }

  // P2PKH (Legacy) - 1... or m.../n...
  if (isMainnet) {
    if (addr.startsWith(prefixes.p2pkh as string)) {
      return 'p2pkh';
    }
  } else {
    const testnetP2pkhPrefixes = prefixes.p2pkh as string[];
    if (testnetP2pkhPrefixes.some((p) => addr.startsWith(p))) {
      return 'p2pkh';
    }
  }

  // P2SH (Script Hash) - 3... or 2...
  if (addr.startsWith(prefixes.p2sh as string)) {
    return 'p2sh';
  }

  return 'unknown';
}

/**
 * Validate Bitcoin address with detailed error messages
 */
export function validateBtcAddress(
  address: string,
  network?: NetworkName
): BtcAddressValidationResult {
  if (!address || typeof address !== 'string') {
    return { valid: false, error: 'Address is required' };
  }

  const addr = address.trim();
  const selectedNetwork = network || getSelectedNetwork();
  const isMainnet = selectedNetwork === 'mainnet';
  const prefixes = isMainnet ? ADDRESS_PREFIXES.mainnet : ADDRESS_PREFIXES.testnet;

  if (addr.length === 0) {
    return { valid: false, error: 'Address cannot be empty' };
  }

  // Detect address type
  const addressType = detectAddressType(addr, selectedNetwork);

  if (addressType === 'unknown') {
    // Check if it's a wrong network address
    if (isMainnet) {
      // Check if it's a testnet address
      if (
        addr.toLowerCase().startsWith('tb1') ||
        addr.startsWith('m') ||
        addr.startsWith('n') ||
        addr.startsWith('2')
      ) {
        return {
          valid: false,
          error: 'This appears to be a testnet address. Please use a mainnet address.',
        };
      }
    } else {
      // Check if it's a mainnet address
      if (
        addr.toLowerCase().startsWith('bc1') ||
        addr.startsWith('1') ||
        addr.startsWith('3')
      ) {
        return {
          valid: false,
          error: 'This appears to be a mainnet address. Please use a testnet address.',
        };
      }
    }

    return {
      valid: false,
      error: `Invalid Bitcoin address format for ${selectedNetwork}`,
    };
  }

  // Validate based on address type
  switch (addressType) {
    case 'p2pkh':
    case 'p2sh': {
      // Legacy addresses: 25-35 characters, Base58
      if (addr.length < 25 || addr.length > 35) {
        return {
          valid: false,
          error: `Invalid address length (${addr.length}). Legacy addresses should be 25-35 characters.`,
        };
      }
      if (!isValidBase58(addr)) {
        return {
          valid: false,
          error: 'Invalid characters in address. Legacy addresses use Base58 encoding.',
        };
      }
      break;
    }

    case 'p2wpkh': {
      // Native SegWit: 42-62 characters for P2WPKH
      if (addr.length < 42 || addr.length > 62) {
        return {
          valid: false,
          error: `Invalid address length (${addr.length}). SegWit addresses should be 42-62 characters.`,
        };
      }
      if (!isValidBech32Format(addr, prefixes.bech32)) {
        return {
          valid: false,
          error: 'Invalid SegWit address format.',
        };
      }
      break;
    }

    case 'p2tr': {
      // Taproot: 62 characters (bc1p + 58 chars)
      if (addr.length !== 62) {
        return {
          valid: false,
          error: `Invalid Taproot address length (${addr.length}). Taproot addresses should be 62 characters.`,
        };
      }
      if (!isValidBech32Format(addr, prefixes.bech32m)) {
        return {
          valid: false,
          error: 'Invalid Taproot address format.',
        };
      }
      break;
    }
  }

  return {
    valid: true,
    addressType,
  };
}

/**
 * Simple boolean validation (for quick checks)
 */
export function isValidBtcAddress(address: string, network?: NetworkName): boolean {
  return validateBtcAddress(address, network).valid;
}

/**
 * Get user-friendly address type label
 */
export function getAddressTypeLabel(type: BtcAddressType): string {
  switch (type) {
    case 'p2pkh':
      return 'Legacy (P2PKH)';
    case 'p2sh':
      return 'Script Hash (P2SH)';
    case 'p2wpkh':
      return 'Native SegWit (P2WPKH)';
    case 'p2tr':
      return 'Taproot (P2TR)';
    default:
      return 'Unknown';
  }
}

/**
 * Validate that a Taproot address has the correct prefix for the selected network
 * This is a guardrail to catch mismatched network derivation bugs
 *
 * @param address - The Taproot address to validate
 * @param network - The expected network (mainnet/testnet/devnet)
 * @returns Object with valid flag and error message if invalid
 */
export function validateTaprootNetworkPrefix(
  address: string,
  network?: NetworkName
): { valid: boolean; error?: string } {
  if (!address) {
    return { valid: false, error: 'Address is required' };
  }

  const selectedNetwork = network || getSelectedNetwork();
  const isMainnet = selectedNetwork === 'mainnet';
  const addr = address.toLowerCase().trim();

  // Check for mainnet Taproot prefix
  const hasMainnetPrefix = addr.startsWith('bc1p');
  // Check for testnet Taproot prefix
  const hasTestnetPrefix = addr.startsWith('tb1p');

  if (isMainnet) {
    if (hasTestnetPrefix) {
      return {
        valid: false,
        error: `Network mismatch: Taproot address has testnet prefix (tb1p) but network is mainnet. Expected bc1p prefix.`,
      };
    }
    if (!hasMainnetPrefix) {
      return {
        valid: false,
        error: `Invalid Taproot address: expected bc1p prefix for mainnet.`,
      };
    }
  } else {
    // testnet or devnet (both use Bitcoin testnet)
    if (hasMainnetPrefix) {
      return {
        valid: false,
        error: `Network mismatch: Taproot address has mainnet prefix (bc1p) but network is ${selectedNetwork}. Expected tb1p prefix.`,
      };
    }
    if (!hasTestnetPrefix) {
      return {
        valid: false,
        error: `Invalid Taproot address: expected tb1p prefix for ${selectedNetwork}.`,
      };
    }
  }

  return { valid: true };
}
