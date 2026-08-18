/**
 * The standing approvals a site holds, and when they stop being true.
 *
 * Approving `getAddresses` caches the whole response, addresses included,
 * under `approved_{origin}` for 24 hours, and the service worker replays
 * it verbatim on every later call. That makes the approval a recording
 * rather than a permission, so once the user switched account the site
 * kept receiving the previous account's addresses, with no prompt and no
 * way to tell. A wallet that answers "who are you" with an address the
 * user no longer has selected is stating something false about them.
 *
 * Resolving addresses fresh on each call is the real fix, and it needs the
 * worker to reach an unlocked session, which it cannot today. Until then
 * the recording is dropped the moment it stops matching: the site is asked
 * again, which is honest, rather than answered wrongly, which is not.
 *
 * Called from the choke points that change what an address means, so no
 * caller has to remember: the active account, the selected network and the
 * active wallet.
 */

const APPROVAL_PREFIX = "approved_";

function sessionStorageAvailable(): boolean {
  return (
    typeof chrome !== "undefined" &&
    !!chrome.storage &&
    !!chrome.storage.session &&
    typeof chrome.storage.session.get === "function"
  );
}

/**
 * Drop every cached approval, so the next dApp call asks again.
 *
 * Never throws: this runs inside account and network switches, and a
 * failure to clear a cache must not take a wallet screen down with it.
 * The cost of failing is one stale answer; the cost of throwing here is
 * the switch itself.
 */
export async function clearOriginApprovals(): Promise<void> {
  if (!sessionStorageAvailable()) return;

  try {
    // No argument means every key: passing null does the same at
    // runtime but is outside the typings.
    const all = await chrome.storage.session.get();
    const keys = Object.keys(all).filter((key) => key.startsWith(APPROVAL_PREFIX));
    if (keys.length === 0) return;
    await chrome.storage.session.remove(keys);
  } catch {
    // Nothing to do about it here, and nothing worth breaking over.
  }
}

/** Drop the approval held by one site. For an explicit disconnect. */
export async function revokeOriginApproval(origin: string): Promise<void> {
  if (!sessionStorageAvailable() || !origin) return;

  try {
    await chrome.storage.session.remove(`${APPROVAL_PREFIX}${origin}`);
  } catch {
    // As above.
  }
}

/** Which origins currently hold an approval. For a Connected Sites screen. */
export async function listApprovedOrigins(): Promise<string[]> {
  if (!sessionStorageAvailable()) return [];

  try {
    // No argument means every key: passing null does the same at
    // runtime but is outside the typings.
    const all = await chrome.storage.session.get();
    return Object.keys(all)
      .filter((key) => key.startsWith(APPROVAL_PREFIX))
      .map((key) => key.slice(APPROVAL_PREFIX.length));
  } catch {
    return [];
  }
}
