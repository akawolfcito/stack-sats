/**
 * Is this actually a recovery phrase?
 *
 * The import screen used to accept anything that was 12 or 24 lowercase
 * words. "newtraffic" is ten lowercase letters, so a phrase with two words
 * accidentally joined sailed through, got encrypted, and reached disk. The
 * failure surfaced three screens later, inside account derivation, where
 * nothing could be corrected any more.
 *
 * Checking here means the person still has the text in front of them, and
 * can be told which word is wrong.
 */

import { BIP39_WORDLIST_EN } from "@/lib/bip39/wordlist-en";

export type MnemonicIssue =
  /** Not 12 or 24 words. */
  | { kind: "word-count"; count: number }
  /** A word that is not in the BIP39 list, with its 1-based position. */
  | { kind: "unknown-word"; word: string; position: number }
  /** Every word is real, but the phrase as a whole does not add up. */
  | { kind: "checksum" };

export type MnemonicCheck =
  | { valid: true; words: string[] }
  | { valid: false; issue: MnemonicIssue };

const VALID_LENGTHS = [12, 24];
const WORDS = new Set(BIP39_WORDLIST_EN);

/** Split the way the import field does, so both agree on what a word is. */
export function splitPhrase(phrase: string): string[] {
  return phrase.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/**
 * Async because the checksum needs a SHA-256, and Web Crypto is the only
 * digest this project carries. @noble/hashes is not a direct dependency
 * and this is not worth adding one for.
 */
export async function checkMnemonic(phrase: string): Promise<MnemonicCheck> {
  const words = splitPhrase(phrase);

  if (!VALID_LENGTHS.includes(words.length)) {
    return { valid: false, issue: { kind: "word-count", count: words.length } };
  }

  // The first offender is the one worth naming. Listing every bad word at
  // once buries the one the person needs to look at.
  for (let i = 0; i < words.length; i++) {
    if (!WORDS.has(words[i])) {
      return {
        valid: false,
        issue: { kind: "unknown-word", word: words[i], position: i + 1 },
      };
    }
  }

  if (!(await checksumHolds(words))) {
    return { valid: false, issue: { kind: "checksum" } };
  }

  return { valid: true, words };
}

/**
 * BIP39 spends the last few bits on a checksum over the entropy, which is
 * what catches two real words swapped round. Every word being in the list
 * is not enough on its own.
 */
async function checksumHolds(words: string[]): Promise<boolean> {
  const bits = words
    .map((word) => BIP39_WORDLIST_EN.indexOf(word).toString(2).padStart(11, "0"))
    .join("");

  const entropyBits = (words.length * 11 * 32) / 33;
  const checksumBits = bits.length - entropyBits;

  const entropy = new Uint8Array(entropyBits / 8);
  for (let i = 0; i < entropy.length; i++) {
    entropy[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  }

  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", entropy));
  const expected = digest[0] >> (8 - checksumBits);
  return expected === parseInt(bits.slice(entropyBits), 2);
}

/** What to put on screen. Names the position, never the whole phrase. */
export function describeMnemonicIssue(issue: MnemonicIssue): string {
  switch (issue.kind) {
    case "word-count":
      return `A recovery phrase has 12 or 24 words. This one has ${issue.count}.`;
    case "unknown-word":
      return `Word ${issue.position}, "${issue.word}", is not a recovery phrase word. Check for two words run together, or a typo.`;
    case "checksum":
      return "Every word is valid, but the phrase does not check out. One of them is probably in the wrong place.";
  }
}
