/**
 * The published docs must not claim permissions the extension does not ask
 * for.
 *
 * They had drifted badly: PRIVACY_POLICY.md, SECURITY.md and RELEASE.md all
 * listed `scripting`, `tabs` and `activeTab`, and two of them justified
 * api.platform.hiro.so. None of those are in the manifest. RELEASE.md is
 * the file the Chrome Web Store answers get copied from, so the drift was
 * one paste away from being a false statement on the submission form.
 *
 * Only the first cell of a markdown table row is inspected, which is where
 * the claims live. Prose mentioning `chrome.tabs.sendMessage`, or a note
 * saying a permission was removed, is left alone.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

const MANIFEST = JSON.parse(
  readFileSync(resolve(ROOT, "public/manifest.json"), "utf-8")
) as {
  permissions: string[];
  host_permissions: string[];
  content_scripts: Array<{ matches: string[] }>;
};

const DOCS = [
  "docs/PRIVACY_POLICY.md",
  "docs/SECURITY.md",
  "docs/RELEASE.md",
  "docs/handoff/cws-submit-1.1.3-copypaste.md",
];

/** Chrome permissions this project has held at some point, or might. */
const KNOWN_PERMISSIONS = [
  "storage",
  "sidePanel",
  "tabs",
  "scripting",
  "activeTab",
  "alarms",
  "clipboardWrite",
  "cookies",
  "notifications",
  "webRequest",
  "unlimitedStorage",
];

const DECLARED_HOSTS = [
  ...MANIFEST.host_permissions,
  ...MANIFEST.content_scripts.flatMap((entry) => entry.matches),
];

/** First cell of every markdown table row in a document. */
function tableKeys(markdown: string): string[] {
  return markdown
    .split("\n")
    .filter((line) => line.trimStart().startsWith("|"))
    .map((line) => line.split("|")[1] ?? "")
    .map((cell) => cell.trim().replace(/`/g, ""))
    .filter(Boolean)
    .filter((cell) => !/^-+$/.test(cell));
}

describe("docs match the manifest", () => {
  it.each(DOCS)("%s claims no permission the manifest lacks", (doc) => {
    const keys = tableKeys(readFileSync(resolve(ROOT, doc), "utf-8"));

    const claimed = keys.filter((key) => KNOWN_PERMISSIONS.includes(key));
    const undeclared = claimed.filter(
      (key) => !MANIFEST.permissions.includes(key)
    );

    expect(undeclared).toEqual([]);
  });

  it.each(DOCS)("%s claims no host pattern the manifest lacks", (doc) => {
    const keys = tableKeys(readFileSync(resolve(ROOT, doc), "utf-8"));

    // Only URL match patterns. Bare hostnames like blockstream.info are
    // prose about CORS calls, which need no permission and are declared
    // on purpose.
    const claimed = keys.filter((key) => /^https?:\/\/.*\*/.test(key));
    const undeclared = claimed.filter((key) => !DECLARED_HOSTS.includes(key));

    expect(undeclared).toEqual([]);
  });

  it("keeps the manifest itself down to what is used", () => {
    expect(MANIFEST.permissions).toEqual([
      "storage",
      "sidePanel",
      "clipboardRead",
    ]);
    expect(MANIFEST.host_permissions).toEqual([
      "https://api.hiro.so/*",
      "https://api.testnet.hiro.so/*",
    ]);
  });
});
