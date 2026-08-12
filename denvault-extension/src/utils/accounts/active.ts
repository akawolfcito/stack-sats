/**
 * Active account selection.
 *
 * Which account the user is operating as. Shared deliberately: the
 * wallet home writes it, and the dApp approval screen must read the same
 * value, because the index it holds is what derives the private key used
 * to sign. When the approval screen kept its own default of 0, a user
 * working in account 3 would approve a dApp request signed by account 1.
 */

export const ACTIVE_ACCOUNT_STORAGE_KEY = "selected_account_index";

export interface AccountOption {
  index: number;
  label: string;
}

/**
 * Read the active account index, validated against the accounts that
 * actually exist.
 *
 * Falls back to the first account whenever the stored value cannot be
 * trusted — missing, malformed, negative, or beyond `accountCount` after
 * the user removed accounts. Falling back to the first account is
 * predictable; silently signing with the last one would not be.
 */
export function getActiveAccountIndex(accountCount: number): number {
  if (!Number.isInteger(accountCount) || accountCount <= 0) return 0;

  const stored = localStorage.getItem(ACTIVE_ACCOUNT_STORAGE_KEY);
  if (stored === null) return 0;

  const index = Number(stored);
  if (!Number.isInteger(index)) return 0;
  if (index < 0 || index >= accountCount) return 0;

  return index;
}

/** Persist the active account index. */
export function setActiveAccountIndex(index: number): void {
  localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, String(index));
}

/**
 * Build the selector options from the real account count and whatever
 * names the user has set, rather than a fixed list.
 */
export function buildAccountOptions(
  accountCount: number,
  names: Record<number, string>
): AccountOption[] {
  if (!Number.isInteger(accountCount) || accountCount <= 0) return [];

  return Array.from({ length: accountCount }, (_, index) => {
    const custom = names[index]?.trim();
    return { index, label: custom || `Account ${index + 1}` };
  });
}
