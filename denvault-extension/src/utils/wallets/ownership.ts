/**
 * Proving a wallet is yours before it is removed.
 *
 * Removing a wallet used to ask for nothing. Anyone holding the PIN of one
 * wallet could delete every other wallet on the device, without ever showing
 * they owned them. The modal is right that funds survive if the recovery
 * phrase was written down, but when it was not, that is permanent data loss
 * performed by someone who never proved anything.
 *
 * The proof is the same one the vault already relies on: a PIN that decrypts
 * that wallet's blob is the PIN for that wallet. Nothing here keeps the
 * plaintext. It is decrypted, discarded, and only the yes or no survives.
 */

import { decryptWithPIN, isValidPIN } from "@/utils/security";
import type { VaultEntry } from "@/utils/security/vault";

import { getWalletsAsync } from "./index";

export type WalletAuth =
  | { ok: true }
  /** The PIN does not open this wallet. */
  | { ok: false; reason: "wrong-pin" }
  /** Six digits are the shape of a PIN. This was not that. */
  | { ok: false; reason: "malformed-pin" }
  /** The wallet is gone, most likely removed in another surface. */
  | { ok: false; reason: "not-found" };

/**
 * Does this PIN open this wallet?
 *
 * Takes the entry rather than an id so the caller can hold one it already
 * has, and so this stays testable without touching storage.
 */
export async function pinOpensWallet(
  entry: VaultEntry,
  pin: string
): Promise<boolean> {
  if (!isValidPIN(pin)) return false;

  try {
    // Decrypted only to learn whether it decrypts. The value is dropped on
    // the next line and never leaves this function.
    await decryptWithPIN(entry.encryptedData, pin);
    return true;
  } catch {
    return false;
  }
}

/** The same question by wallet id, against what is on disk right now. */
export async function verifyWalletPin(
  walletId: string,
  pin: string
): Promise<WalletAuth> {
  if (!isValidPIN(pin)) return { ok: false, reason: "malformed-pin" };

  const entry = (await getWalletsAsync()).find((w) => w.id === walletId);
  if (!entry) return { ok: false, reason: "not-found" };

  return (await pinOpensWallet(entry, pin))
    ? { ok: true }
    : { ok: false, reason: "wrong-pin" };
}

/** What to put on screen. Never says which wallet a PIN does open. */
export function describeWalletAuth(auth: Extract<WalletAuth, { ok: false }>): string {
  switch (auth.reason) {
    case "malformed-pin":
      return "A PIN is 6 digits.";
    case "wrong-pin":
      return "That is not this wallet's PIN.";
    case "not-found":
      return "This wallet is no longer on this device.";
  }
}
