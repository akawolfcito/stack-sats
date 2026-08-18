import { describe, it, expect } from "vitest";
import {
  ERASE_CONFIRM_WORD,
  ERASE_ROW_LABEL,
  ERASE_SCREEN_TITLE,
  eraseBody,
  eraseButtonLabel,
} from "./erase-copy";

describe("erasing every wallet, in words", () => {
  it("never says wallet in the singular", () => {
    // The card said "Delete Wallet" and "your wallet" while deleting two.
    // That singular is the whole reason a user lost both.
    const everything = [
      ERASE_ROW_LABEL,
      ERASE_SCREEN_TITLE,
      eraseBody(2),
      eraseButtonLabel(2),
    ].join(" ");

    expect(everything).not.toMatch(/\byour wallet\b/i);
    expect(everything).not.toMatch(/\bDelete Wallet\b/i);
    expect(everything).not.toMatch(/\bReset Wallet\b/i);
  });

  it("puts the count on the button, which is the last thing read", () => {
    expect(eraseButtonLabel(2)).toBe("Erase 2 wallets");
    expect(eraseButtonLabel(5)).toBe("Erase 5 wallets");
  });

  it("counts one correctly, without inventing a plural", () => {
    expect(eraseButtonLabel(1)).toBe("Erase 1 wallet");
    expect(eraseBody(1)).toContain("all 1 wallet on this device");
    expect(eraseBody(1)).not.toContain("1 wallets");
  });

  it("says something sound before the count has loaded", () => {
    expect(eraseButtonLabel(0)).toBe("Erase all wallets");
    expect(eraseBody(0)).toContain("every wallet");
    expect(eraseBody(0)).not.toContain("0");
  });

  it("states the count in the body as well as the button", () => {
    expect(eraseBody(3)).toContain("all 3 wallets");
  });

  it("says there is no copy elsewhere, because there is not", () => {
    expect(eraseBody(2)).toMatch(/recovery phrase/i);
    expect(eraseBody(2)).toMatch(/only place/i);
  });

  it("uses a confirmation word that matches the button's verb", () => {
    expect(ERASE_CONFIRM_WORD).toBe("ERASE");
    expect(eraseButtonLabel(2).toUpperCase()).toContain(ERASE_CONFIRM_WORD);
  });

  it("does not share a verb with removing a single wallet", () => {
    // Manage Wallets removes one. This erases all. Sharing "delete" is
    // what made them look like the same action.
    expect(ERASE_ROW_LABEL.toLowerCase()).not.toContain("remove");
    expect(ERASE_SCREEN_TITLE.toLowerCase()).not.toContain("remove");
  });
});
