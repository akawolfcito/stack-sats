import { describe, it, expect } from "vitest";
import { checkMnemonic, describeMnemonicIssue, splitPhrase } from "./validate";

/** The 12 word phrase the e2e fixtures use. Checksum valid. */
const VALID_12 =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

/** The canonical 24 word counterpart. Checksum valid. */
const VALID_24 = `${"abandon ".repeat(23)}art`;

describe("checkMnemonic", () => {
  it("accepts a real 12 word phrase", async () => {
    expect(await checkMnemonic(VALID_12)).toMatchObject({ valid: true });
  });

  it("accepts a real 24 word phrase", async () => {
    expect(await checkMnemonic(VALID_24)).toMatchObject({ valid: true });
  });

  it("is not fooled by casing or ragged spacing", async () => {
    expect(await checkMnemonic(`  ${VALID_12.toUpperCase()}\n`)).toMatchObject({
      valid: true,
    });
  });

  /**
   * The reported failure. Joining two words leaves 11, and the old import
   * screen would have taken it: every character is a lowercase letter.
   */
  it("rejects the phrase shape that broke the wallet", async () => {
    const joined = VALID_12.replace("abandon about", "abandonabout");
    expect(await checkMnemonic(joined)).toMatchObject({
      valid: false,
      issue: { kind: "word-count", count: 11 },
    });
  });

  it("names the word that is not a real one, and where it is", async () => {
    const words = VALID_12.split(" ");
    words[8] = "newtraffic";
    expect(await checkMnemonic(words.join(" "))).toMatchObject({
      valid: false,
      issue: { kind: "unknown-word", word: "newtraffic", position: 9 },
    });
  });

  it("names the first offender only", async () => {
    const words = VALID_12.split(" ");
    words[3] = "zzzz";
    words[10] = "qqqq";
    expect(await checkMnemonic(words.join(" "))).toMatchObject({
      issue: { kind: "unknown-word", word: "zzzz", position: 4 },
    });
  });

  /** Every word real, order wrong. Only the checksum catches this. */
  it("rejects real words that do not add up", async () => {
    const words = VALID_12.split(" ");
    words[11] = "zoo";
    expect(await checkMnemonic(words.join(" "))).toMatchObject({
      valid: false,
      issue: { kind: "checksum" },
    });
  });

  it("rejects an empty field without pretending it is a word", async () => {
    expect(await checkMnemonic("   ")).toMatchObject({
      valid: false,
      issue: { kind: "word-count", count: 0 },
    });
  });
});

describe("describeMnemonicIssue", () => {
  it("never puts the phrase on screen, only the offending word", () => {
    const message = describeMnemonicIssue({
      kind: "unknown-word",
      word: "newtraffic",
      position: 9,
    });
    expect(message).toContain("Word 9");
    expect(message).toContain("newtraffic");
    expect(message).not.toContain("abandon");
  });

  it("says what a phrase is supposed to look like", () => {
    expect(describeMnemonicIssue({ kind: "word-count", count: 23 })).toContain(
      "12 or 24"
    );
  });
});

describe("splitPhrase", () => {
  it("agrees with the import field about what a word is", () => {
    expect(splitPhrase("  One   TWO\tthree\n")).toEqual(["one", "two", "three"]);
  });
});
