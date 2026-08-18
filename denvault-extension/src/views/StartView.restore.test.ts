/**
 * Restoring an encrypted backup when there is no wallet to restore into.
 *
 * Settings offers "Export Secret Key", which downloads an encrypted vault
 * file, and "Import Backup File", which reads one back. Settings is behind
 * an unlocked wallet, so the only door for that file was the one situation
 * where the file is not needed. Someone who reset the extension, or who
 * moved to another computer, met "Set Up Your Wallet" offering to create
 * one or to type a recovery phrase, and their backup had nowhere to go.
 *
 * The file and the code that reads it were both fine. What was missing was
 * a way in.
 *
 * importWalletAsync writes an already encrypted entry, so it needs no
 * session: the PIN comes later, at the unlock screen, and it is the PIN
 * that was in use when the backup was made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mount, flushPromises, type VueWrapper } from "@vue/test-utils";

const { push, parseBackupFile, importWalletAsync, walletExistsAsync } = vi.hoisted(() => ({
  push: vi.fn(),
  parseBackupFile: vi.fn(),
  importWalletAsync: vi.fn(async () => "added" as const),
  walletExistsAsync: vi.fn(async () => false),
}));

const WALLET = { id: "w1", name: "The Wolf", createdAt: 1, encryptedData: {}, version: 1 };

vi.mock("@/utils/backup", () => ({ parseBackupFile }));
vi.mock("@/utils/wallets", () => ({ importWalletAsync, walletExistsAsync }));
vi.mock("@stacks/wallet-sdk", () => ({ randomSeedPhrase: () => "unused here" }));
vi.mock("@/utils/security/logger", () => ({ secureLog: vi.fn(), secureWarn: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({ push }) }));

import StartView from "./StartView.vue";

/** A File the parser will be handed. Its contents never matter: the parse
 *  is stubbed, and what is under test is the wiring, not the JSON. */
function backupFile() {
  return new File(["{}"], "denvault-backup.json", { type: "application/json" });
}

async function chooseFile(wrapper: VueWrapper, file: File) {
  const input = wrapper.get<HTMLInputElement>('input[type="file"]');
  Object.defineProperty(input.element, "files", { value: [file], configurable: true });
  await input.trigger("change");
  await flushPromises();
}

describe("StartView restoring from a backup file", () => {
  let wrapper: VueWrapper;

  beforeEach(() => {
    push.mockClear();
    importWalletAsync.mockClear();
    parseBackupFile.mockResolvedValue({ wallet: WALLET });
    walletExistsAsync.mockResolvedValue(false);
    wrapper = mount(StartView);
  });

  afterEach(() => {
    wrapper?.unmount();
  });

  it("offers a way in at all", () => {
    expect(wrapper.find('[data-roi="start-restore-cta"]').exists()).toBe(true);
  });

  it("writes the wallet and sends the user to unlock it", async () => {
    await chooseFile(wrapper, backupFile());

    expect(importWalletAsync).toHaveBeenCalledWith(WALLET, false);
    expect(push).toHaveBeenCalledWith("/unlock");
  });

  it("says so when the file is not a backup, without navigating", async () => {
    parseBackupFile.mockResolvedValue(null);

    await chooseFile(wrapper, backupFile());

    expect(importWalletAsync).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/backup/i);
  });

  it("says so when the wallet cannot be written, without navigating", async () => {
    importWalletAsync.mockResolvedValue(null as unknown as "added");

    await chooseFile(wrapper, backupFile());

    expect(push).not.toHaveBeenCalled();
    expect(wrapper.text()).toMatch(/restore|import|backup/i);
  });
});
