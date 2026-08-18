/**
 * The words for erasing every wallet, in one place.
 *
 * This action had three names. The row in Settings said "Delete All
 * Wallets", the card it opened said "Delete Wallet" in the singular and
 * promised to delete "your wallet", and the same flow reached from the
 * unlock screen called itself "Reset Wallet". A user pressed the row that
 * said All, read the card that said one, believed the last thing they
 * read, and lost both wallets. The text in front of them at the moment of
 * deciding was false.
 *
 * Two screens implement this flow, so two screens is how it drifted to
 * three names. They now read from here.
 *
 * Naming rule: removing one wallet and erasing every wallet must not share
 * a verb. Manage Wallets removes. This erases. "Reset" is the industry
 * convention but suggests returning to an earlier state, and nothing
 * returns; "delete" already belongs to the other action.
 */

/** Typed to confirm. Matches the verb on the button on purpose: a
 *  confirmation word that disagrees with the button erodes trust in every
 *  other warning the wallet gives. */
export const ERASE_CONFIRM_WORD = "ERASE";

export const ERASE_ROW_LABEL = "Erase all wallets";
export const ERASE_ROW_SUBTITLE = "Deletes every wallet on this device. This cannot be undone.";

export const ERASE_SCREEN_TITLE = "Erase all wallets";
export const ERASE_HEADLINE = "This erases everything, not just one wallet.";

/** The promise the user has to be able to make, before typing anything. */
export const ERASE_ACKNOWLEDGEMENT =
  "I have the recovery phrase for every wallet listed above.";

const plural = (count: number) => (count === 1 ? "wallet" : "wallets");

/**
 * What is about to be lost, counted.
 *
 * The count is the fact that stops a hand, and no screen carried it.
 */
export function eraseBody(walletCount: number): string {
  const subject =
    walletCount > 0
      ? `DenVault will delete all ${walletCount} ${plural(walletCount)} on this device.`
      : "DenVault will delete every wallet on this device.";

  return `${subject} Anything you have not written down is gone for good. Without the recovery phrase, this device is the only place these wallets exist.`;
}

/**
 * The last thing read before pressing. It said "Reset Wallet", which was
 * not what it did.
 */
export function eraseButtonLabel(walletCount: number): string {
  return walletCount > 0
    ? `Erase ${walletCount} ${plural(walletCount)}`
    : "Erase all wallets";
}
