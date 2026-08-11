/**
 * Manifest permission tripwire.
 *
 * Google rejected 1.1.0 under "Use of Permissions" (violation reference
 * Purple Potassium): requesting a permission the extension does not use.
 * The policy is to request only the narrowest permissions the shipped
 * features actually need — no future-proofing.
 *
 * These tests pin the exact permission set so a new one cannot slip into
 * the manifest without someone updating this file and writing down why
 * it is needed. Each entry below must name the API that requires it.
 */

import { describe, it, expect } from "vitest";
import manifest from "../../public/manifest.json";

/**
 * Every permission must map to an API that genuinely requires it.
 *
 * - storage:   chrome.storage.local / .session / .onChanged — the
 *              encrypted vault, settings and session cache.
 * - sidePanel: chrome.sidePanel.open + setOptions in background.js.
 *
 * Deliberately absent:
 * - tabs:      chrome.tabs.create/getCurrent/query/remove/sendMessage all
 *              work without it. The permission only gates reading
 *              Tab.url, Tab.title, Tab.pendingUrl and Tab.favIconUrl,
 *              none of which this extension reads.
 * - scripting: never used; the page bridge ships through the declared
 *              content script, not programmatic injection.
 */
const EXPECTED_PERMISSIONS = ["storage", "sidePanel"];

/**
 * Hosts the production bundle actually contacts.
 *
 * api.platform.hiro.so is deliberately absent: it is only reachable from
 * the devnet branch in src/utils/balance/index.ts, which is dead-code
 * eliminated when VITE_PLATFORM_HIRO_API_KEY is unset — the state
 * verify-production.sh enforces for every release build.
 */
const EXPECTED_HOST_PERMISSIONS = [
  "https://api.hiro.so/*",
  "https://api.testnet.hiro.so/*",
];

describe("manifest permissions", () => {
  it("requests exactly the permissions the shipped features use", () => {
    expect(manifest.permissions).toEqual(EXPECTED_PERMISSIONS);
  });

  it("does not request the tabs permission", () => {
    // Reading only tab.id and tab.windowId never needs it.
    expect(manifest.permissions).not.toContain("tabs");
  });

  it("does not request the scripting permission", () => {
    // The exact permission Google's rejection named.
    expect(manifest.permissions).not.toContain("scripting");
  });

  it("requests exactly the hosts the production bundle contacts", () => {
    expect(manifest.host_permissions).toEqual(EXPECTED_HOST_PERMISSIONS);
  });

  it("does not request broad host access", () => {
    for (const host of manifest.host_permissions) {
      expect(host).not.toBe("<all_urls>");
      expect(host).not.toMatch(/^https:\/\/\*\/\*$/);
      expect(host.startsWith("https://")).toBe(true);
    }
  });

  it("keeps the content script scoped to https origins", () => {
    for (const script of manifest.content_scripts) {
      expect(script.matches).toEqual(["https://*/*"]);
      expect(script.all_frames).toBe(false);
    }
  });
});
