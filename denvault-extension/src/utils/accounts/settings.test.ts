/**
 * Unit tests for accounts/settings.ts
 *
 * Tests account settings management including count, visibility,
 * naming, and multi-wallet isolation.
 *
 * Uses localStorage mock from setup.ts and mocks getActiveWalletIdAsync.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Module-level mocks (hoisted) ---

vi.mock("../wallets", () => ({
  getActiveWalletIdAsync: vi.fn(),
}));

// --- Import mocked modules ---

import { getActiveWalletIdAsync } from "../wallets";

// --- Import module under test ---

import {
  getAccountSettings,
  getAccountCount,
  setAccountCount,
  addAccount,
  removeLastAccount,
  isAccountHidden,
  hideAccount,
  showAccount,
  getVisibleAccountCount,
  deleteAccountSettings,
  getAccountName,
  getAllAccountNames,
  setAccountName,
  clearAccountName,
  DEFAULT_ACCOUNT_COUNT,
  MIN_ACCOUNT_COUNT,
  MAX_ACCOUNT_COUNT,
} from "./settings";

// --- Setup ---

const WALLET_ID = "test-wallet-1";
const WALLET_ID_2 = "test-wallet-2";

beforeEach(() => {
  vi.mocked(getActiveWalletIdAsync).mockResolvedValue(WALLET_ID);
});

// --- Tests ---

describe("accounts/settings", () => {
  describe("exported constants", () => {
    it("should have correct default values", () => {
      expect(DEFAULT_ACCOUNT_COUNT).toBe(5);
      expect(MIN_ACCOUNT_COUNT).toBe(1);
      expect(MAX_ACCOUNT_COUNT).toBe(100);
    });
  });

  describe("getAccountSettings", () => {
    it("should return defaults when no settings are stored", async () => {
      const settings = await getAccountSettings(WALLET_ID);
      expect(settings.count).toBe(DEFAULT_ACCOUNT_COUNT);
      expect(settings.hiddenIndices).toEqual([]);
      expect(settings.names).toEqual({});
    });

    it("should return saved settings", async () => {
      await setAccountCount(10, WALLET_ID);
      const settings = await getAccountSettings(WALLET_ID);
      expect(settings.count).toBe(10);
    });

    it("should return defaults when walletId is null", async () => {
      vi.mocked(getActiveWalletIdAsync).mockResolvedValue(null);
      const settings = await getAccountSettings();
      expect(settings.count).toBe(DEFAULT_ACCOUNT_COUNT);
    });

    it("should merge defaults for older stored settings missing names field", async () => {
      // Simulate old settings without names field
      localStorage.setItem(
        "account_settings",
        JSON.stringify({ [WALLET_ID]: { count: 8, hiddenIndices: [1] } })
      );
      const settings = await getAccountSettings(WALLET_ID);
      expect(settings.count).toBe(8);
      expect(settings.hiddenIndices).toEqual([1]);
      expect(settings.names).toEqual({});
    });
  });

  describe("getAccountCount", () => {
    it("should return default count when no settings exist", async () => {
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(DEFAULT_ACCOUNT_COUNT);
    });

    it("should return saved count", async () => {
      await setAccountCount(15, WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(15);
    });
  });

  describe("setAccountCount", () => {
    it("should set a normal value", async () => {
      await setAccountCount(10, WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(10);
    });

    it("should clamp to MIN when value is below minimum", async () => {
      await setAccountCount(0, WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(MIN_ACCOUNT_COUNT);
    });

    it("should clamp negative values to MIN", async () => {
      await setAccountCount(-5, WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(MIN_ACCOUNT_COUNT);
    });

    it("should clamp to MAX when value exceeds maximum", async () => {
      await setAccountCount(200, WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(MAX_ACCOUNT_COUNT);
    });

    it("should set exactly MIN_ACCOUNT_COUNT", async () => {
      await setAccountCount(MIN_ACCOUNT_COUNT, WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(MIN_ACCOUNT_COUNT);
    });

    it("should set exactly MAX_ACCOUNT_COUNT", async () => {
      await setAccountCount(MAX_ACCOUNT_COUNT, WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(MAX_ACCOUNT_COUNT);
    });

    it("should do nothing when walletId is null", async () => {
      vi.mocked(getActiveWalletIdAsync).mockResolvedValue(null);
      await setAccountCount(10);
      // No error thrown, localStorage unchanged
      expect(localStorage.getItem("account_settings")).toBeNull();
    });
  });

  describe("addAccount", () => {
    it("should increment account count by 1", async () => {
      await setAccountCount(5, WALLET_ID);
      const newCount = await addAccount(WALLET_ID);
      expect(newCount).toBe(6);
    });

    it("should cap at MAX_ACCOUNT_COUNT", async () => {
      await setAccountCount(MAX_ACCOUNT_COUNT, WALLET_ID);
      const newCount = await addAccount(WALLET_ID);
      expect(newCount).toBe(MAX_ACCOUNT_COUNT);
    });

    it("should increment from default count", async () => {
      const newCount = await addAccount(WALLET_ID);
      expect(newCount).toBe(DEFAULT_ACCOUNT_COUNT + 1);
    });
  });

  describe("removeLastAccount", () => {
    it("should decrement account count by 1", async () => {
      await setAccountCount(5, WALLET_ID);
      const newCount = await removeLastAccount(WALLET_ID);
      expect(newCount).toBe(4);
    });

    it("should floor at MIN_ACCOUNT_COUNT", async () => {
      await setAccountCount(MIN_ACCOUNT_COUNT, WALLET_ID);
      const newCount = await removeLastAccount(WALLET_ID);
      expect(newCount).toBe(MIN_ACCOUNT_COUNT);
    });

    it("should decrement from default count", async () => {
      const newCount = await removeLastAccount(WALLET_ID);
      expect(newCount).toBe(DEFAULT_ACCOUNT_COUNT - 1);
    });
  });

  describe("isAccountHidden", () => {
    it("should return false when no accounts are hidden", async () => {
      const hidden = await isAccountHidden(0, WALLET_ID);
      expect(hidden).toBe(false);
    });

    it("should return true for a hidden account", async () => {
      await hideAccount(2, WALLET_ID);
      const hidden = await isAccountHidden(2, WALLET_ID);
      expect(hidden).toBe(true);
    });

    it("should return false for a visible account when others are hidden", async () => {
      await hideAccount(2, WALLET_ID);
      const hidden = await isAccountHidden(3, WALLET_ID);
      expect(hidden).toBe(false);
    });
  });

  describe("hideAccount", () => {
    it("should add index to hiddenIndices", async () => {
      await hideAccount(1, WALLET_ID);
      const hidden = await isAccountHidden(1, WALLET_ID);
      expect(hidden).toBe(true);
    });

    it("should be idempotent (hiding twice does not duplicate)", async () => {
      await hideAccount(1, WALLET_ID);
      await hideAccount(1, WALLET_ID);
      const settings = await getAccountSettings(WALLET_ID);
      const occurrences = settings.hiddenIndices.filter((i) => i === 1).length;
      expect(occurrences).toBe(1);
    });

    it("should hide multiple different accounts", async () => {
      await hideAccount(0, WALLET_ID);
      await hideAccount(3, WALLET_ID);
      expect(await isAccountHidden(0, WALLET_ID)).toBe(true);
      expect(await isAccountHidden(3, WALLET_ID)).toBe(true);
      expect(await isAccountHidden(1, WALLET_ID)).toBe(false);
    });

    it("should do nothing when walletId is null", async () => {
      vi.mocked(getActiveWalletIdAsync).mockResolvedValue(null);
      await hideAccount(0);
      // No error, no settings stored
    });
  });

  describe("showAccount", () => {
    it("should remove index from hiddenIndices", async () => {
      await hideAccount(2, WALLET_ID);
      await showAccount(2, WALLET_ID);
      const hidden = await isAccountHidden(2, WALLET_ID);
      expect(hidden).toBe(false);
    });

    it("should be safe to call on already-visible account", async () => {
      await showAccount(5, WALLET_ID);
      const hidden = await isAccountHidden(5, WALLET_ID);
      expect(hidden).toBe(false);
    });

    it("should only remove the specified index", async () => {
      await hideAccount(1, WALLET_ID);
      await hideAccount(2, WALLET_ID);
      await showAccount(1, WALLET_ID);
      expect(await isAccountHidden(1, WALLET_ID)).toBe(false);
      expect(await isAccountHidden(2, WALLET_ID)).toBe(true);
    });
  });

  describe("getVisibleAccountCount", () => {
    it("should return total count when no accounts are hidden", async () => {
      await setAccountCount(5, WALLET_ID);
      const visible = await getVisibleAccountCount(WALLET_ID);
      expect(visible).toBe(5);
    });

    it("should subtract hidden accounts from total", async () => {
      await setAccountCount(5, WALLET_ID);
      await hideAccount(1, WALLET_ID);
      await hideAccount(3, WALLET_ID);
      const visible = await getVisibleAccountCount(WALLET_ID);
      expect(visible).toBe(3);
    });

    it("should exclude hidden indices that are >= count (critical branch)", async () => {
      await setAccountCount(3, WALLET_ID);
      await hideAccount(1, WALLET_ID); // within range
      await hideAccount(5, WALLET_ID); // beyond count, should not affect
      const visible = await getVisibleAccountCount(WALLET_ID);
      // count=3, hidden within range=[1], so visible = 3 - 1 = 2
      expect(visible).toBe(2);
    });

    it("should return default count when no settings exist", async () => {
      const visible = await getVisibleAccountCount(WALLET_ID);
      expect(visible).toBe(DEFAULT_ACCOUNT_COUNT);
    });
  });

  describe("deleteAccountSettings", () => {
    it("should remove settings for the specified wallet", async () => {
      await setAccountCount(10, WALLET_ID);
      deleteAccountSettings(WALLET_ID);
      const count = await getAccountCount(WALLET_ID);
      expect(count).toBe(DEFAULT_ACCOUNT_COUNT);
    });

    it("should not affect other wallets", async () => {
      await setAccountCount(10, WALLET_ID);
      await setAccountCount(20, WALLET_ID_2);
      deleteAccountSettings(WALLET_ID);
      const count = await getAccountCount(WALLET_ID_2);
      expect(count).toBe(20);
    });

    it("should be safe to call for non-existent wallet", () => {
      expect(() => deleteAccountSettings("non-existent")).not.toThrow();
    });
  });

  describe("getAccountName", () => {
    it("should return default name 'Account X' when no custom name is set", async () => {
      const name = await getAccountName(0, WALLET_ID);
      expect(name).toBe("Account 1");
    });

    it("should return correct default name for different indices", async () => {
      expect(await getAccountName(0, WALLET_ID)).toBe("Account 1");
      expect(await getAccountName(4, WALLET_ID)).toBe("Account 5");
      expect(await getAccountName(99, WALLET_ID)).toBe("Account 100");
    });

    it("should return custom name when set", async () => {
      await setAccountName(0, "My Main Account", WALLET_ID);
      const name = await getAccountName(0, WALLET_ID);
      expect(name).toBe("My Main Account");
    });
  });

  describe("getAllAccountNames", () => {
    it("should return empty object when no custom names exist", async () => {
      const names = await getAllAccountNames(WALLET_ID);
      expect(names).toEqual({});
    });

    it("should return all custom names", async () => {
      await setAccountName(0, "Primary", WALLET_ID);
      await setAccountName(2, "Savings", WALLET_ID);
      const names = await getAllAccountNames(WALLET_ID);
      expect(names[0]).toBe("Primary");
      expect(names[2]).toBe("Savings");
    });
  });

  describe("setAccountName", () => {
    it("should store a custom name", async () => {
      await setAccountName(0, "Custom Name", WALLET_ID);
      const name = await getAccountName(0, WALLET_ID);
      expect(name).toBe("Custom Name");
    });

    it("should trim whitespace from name", async () => {
      await setAccountName(0, "  Trimmed Name  ", WALLET_ID);
      const name = await getAccountName(0, WALLET_ID);
      expect(name).toBe("Trimmed Name");
    });

    it("should remove custom name when set to empty string", async () => {
      await setAccountName(0, "Custom", WALLET_ID);
      await setAccountName(0, "", WALLET_ID);
      const name = await getAccountName(0, WALLET_ID);
      expect(name).toBe("Account 1"); // reverts to default
    });

    it("should remove custom name when set to whitespace-only", async () => {
      await setAccountName(0, "Custom", WALLET_ID);
      await setAccountName(0, "   ", WALLET_ID);
      const name = await getAccountName(0, WALLET_ID);
      expect(name).toBe("Account 1");
    });

    it("should do nothing when walletId is null", async () => {
      vi.mocked(getActiveWalletIdAsync).mockResolvedValue(null);
      await setAccountName(0, "Test");
      // No error thrown
    });
  });

  describe("clearAccountName", () => {
    it("should revert to default name", async () => {
      await setAccountName(0, "Custom", WALLET_ID);
      await clearAccountName(0, WALLET_ID);
      const name = await getAccountName(0, WALLET_ID);
      expect(name).toBe("Account 1");
    });

    it("should be safe to clear when no custom name exists", async () => {
      await clearAccountName(5, WALLET_ID);
      const name = await getAccountName(5, WALLET_ID);
      expect(name).toBe("Account 6");
    });
  });

  describe("multi-wallet isolation", () => {
    it("should keep settings separate between wallets", async () => {
      await setAccountCount(10, WALLET_ID);
      await setAccountCount(20, WALLET_ID_2);

      expect(await getAccountCount(WALLET_ID)).toBe(10);
      expect(await getAccountCount(WALLET_ID_2)).toBe(20);
    });

    it("should keep hidden accounts separate between wallets", async () => {
      await hideAccount(1, WALLET_ID);
      expect(await isAccountHidden(1, WALLET_ID)).toBe(true);
      expect(await isAccountHidden(1, WALLET_ID_2)).toBe(false);
    });

    it("should keep account names separate between wallets", async () => {
      await setAccountName(0, "Wallet1-Primary", WALLET_ID);
      await setAccountName(0, "Wallet2-Primary", WALLET_ID_2);

      expect(await getAccountName(0, WALLET_ID)).toBe("Wallet1-Primary");
      expect(await getAccountName(0, WALLET_ID_2)).toBe("Wallet2-Primary");
    });
  });

  describe("corrupt localStorage data", () => {
    it("should return defaults when localStorage contains invalid JSON", async () => {
      localStorage.setItem("account_settings", "not valid json{{{");
      const settings = await getAccountSettings(WALLET_ID);
      expect(settings.count).toBe(DEFAULT_ACCOUNT_COUNT);
      expect(settings.hiddenIndices).toEqual([]);
      expect(settings.names).toEqual({});
    });

    it("should return defaults when localStorage is empty string", async () => {
      localStorage.setItem("account_settings", "");
      const settings = await getAccountSettings(WALLET_ID);
      expect(settings.count).toBe(DEFAULT_ACCOUNT_COUNT);
    });
  });
});
