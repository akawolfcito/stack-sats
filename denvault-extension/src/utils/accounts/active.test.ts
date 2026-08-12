/**
 * Tests for the active-account selection shared by the wallet home and
 * the dApp approval screen.
 *
 * Before this, the key lived only in UserHomeView and Confirmation.vue
 * ignored it entirely — it always started at account 0 with a hardcoded
 * list of three. Approving a dApp request from account 3 signed with
 * account 1's key.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  ACTIVE_ACCOUNT_STORAGE_KEY,
  buildAccountOptions,
  getActiveAccountIndex,
  setActiveAccountIndex,
} from "./active";

describe("getActiveAccountIndex", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to the first account when nothing is stored", () => {
    expect(getActiveAccountIndex(5)).toBe(0);
  });

  it("returns the stored index when it is in range", () => {
    setActiveAccountIndex(3);
    expect(getActiveAccountIndex(5)).toBe(3);
  });

  it("accepts the last valid index", () => {
    setActiveAccountIndex(4);
    expect(getActiveAccountIndex(5)).toBe(4);
  });

  it("falls back to the first account when the index exceeds the count", () => {
    // Happens after removeLastAccount: the stored index outlives the
    // account it pointed at. Signing with a different account than the
    // user expects is worse than resetting to the first one.
    setActiveAccountIndex(7);
    expect(getActiveAccountIndex(5)).toBe(0);
  });

  it("ignores a negative stored index", () => {
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, "-1");
    expect(getActiveAccountIndex(5)).toBe(0);
  });

  it("ignores a non-numeric stored value", () => {
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, "abc");
    expect(getActiveAccountIndex(5)).toBe(0);
  });

  it("ignores a fractional stored value", () => {
    localStorage.setItem(ACTIVE_ACCOUNT_STORAGE_KEY, "2.5");
    expect(getActiveAccountIndex(5)).toBe(0);
  });

  it("returns the first account when the count is zero or negative", () => {
    setActiveAccountIndex(3);
    expect(getActiveAccountIndex(0)).toBe(0);
    expect(getActiveAccountIndex(-1)).toBe(0);
  });

  it("honours indices beyond the old hardcoded ceiling of 20", () => {
    // UserHomeView used to clamp at < 20 while MAX_ACCOUNT_COUNT is 100,
    // so account 25 silently reset to account 0.
    setActiveAccountIndex(25);
    expect(getActiveAccountIndex(30)).toBe(25);
  });
});

describe("buildAccountOptions", () => {
  it("builds one option per account", () => {
    expect(buildAccountOptions(3, {})).toEqual([
      { index: 0, label: "Account 1" },
      { index: 1, label: "Account 2" },
      { index: 2, label: "Account 3" },
    ]);
  });

  it("uses custom names where the user set them", () => {
    expect(buildAccountOptions(3, { 1: "Savings" })).toEqual([
      { index: 0, label: "Account 1" },
      { index: 1, label: "Savings" },
      { index: 2, label: "Account 3" },
    ]);
  });

  it("reflects the real account count, not a fixed list", () => {
    // The approval screen used to offer exactly three accounts while the
    // default was five, hiding the last two from the selector.
    expect(buildAccountOptions(5, {})).toHaveLength(5);
    expect(buildAccountOptions(1, {})).toHaveLength(1);
  });

  it("returns nothing for a non-positive count", () => {
    expect(buildAccountOptions(0, {})).toEqual([]);
  });

  it("ignores blank custom names", () => {
    expect(buildAccountOptions(2, { 0: "   " })[0].label).toBe("Account 1");
  });
});
