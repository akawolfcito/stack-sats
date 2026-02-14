import { c32addressDecode } from "c32check";

/**
 * Validate a Stacks address including c32check checksum verification.
 * Returns true only if the address has valid format AND checksum.
 */
export function validateStxAddress(
  address: string,
  expectedNetwork: "mainnet" | "testnet"
): boolean {
  if (!address || address.length < 5) return false;

  const prefix = address.substring(0, 2);
  const expectedPrefix = expectedNetwork === "mainnet" ? "SP" : "ST";
  if (prefix !== expectedPrefix) return false;

  try {
    // c32addressDecode throws on invalid checksum
    c32addressDecode(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a Bitcoin address format.
 * Checks prefix and length for known address types.
 */
export function validateBtcAddress(address: string): boolean {
  if (!address || address.length < 14) return false;

  // P2PKH: 1... (25-34 chars, mainnet) or m/n... (testnet)
  // P2SH: 3... (mainnet) or 2... (testnet)
  // Bech32 P2WPKH: bc1q... (42 chars) or tb1q... (testnet)
  // Bech32m P2TR: bc1p... (62 chars) or tb1p... (testnet)
  const patterns = [
    /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // P2PKH / P2SH mainnet
    /^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/, // testnet
    /^bc1[qp][a-z0-9]{38,58}$/, // bech32/bech32m mainnet
    /^tb1[qp][a-z0-9]{38,58}$/, // bech32/bech32m testnet
  ];

  return patterns.some((p) => p.test(address));
}
