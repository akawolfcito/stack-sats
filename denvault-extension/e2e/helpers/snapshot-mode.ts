import type { Page } from "@playwright/test";
import { TEST_MNEMONIC } from "../fixtures/mock-wallet";

const SNAPSHOT_MODE_KEY = "__UI_SNAPSHOT_MODE__";
const SNAPSHOT_MNEMONIC_KEY = "__UI_SNAPSHOT_MNEMONIC__";

/**
 * Enable snapshot mode for the next navigation. The session manager
 * auto-unlocks with the test mnemonic instead of requiring PIN entry, which
 * lets RPC confirmation flows skip the unlock UI.
 */
export async function installSnapshotMode(
  page: Page,
  mnemonic: string = TEST_MNEMONIC,
): Promise<void> {
  await page.addInitScript(
    ({ modeKey, mnemonicKey, mnemonicValue }) => {
      try {
        localStorage.setItem(modeKey, "true");
        localStorage.setItem(mnemonicKey, mnemonicValue);
      } catch {
        // localStorage may be unavailable on the very first navigation;
        // the dev server retries shortly after.
      }
    },
    {
      modeKey: SNAPSHOT_MODE_KEY,
      mnemonicKey: SNAPSHOT_MNEMONIC_KEY,
      mnemonicValue: mnemonic,
    },
  );
}
