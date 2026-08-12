/**
 * The version shown in Settings must come from the manifest.
 *
 * The footer carried a hardcoded "DENVAULT V1.0.1" while the manifest had
 * moved to 1.1.3 — three versions of drift, visible to every user and
 * baked into the Chrome Web Store screenshots. A version string a human
 * has to remember to update is one that goes stale.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const USER_MENU_SOURCE = readFileSync(
  resolve(__dirname, "../views/UserMenu.vue"),
  "utf-8"
);
const VITE_CONFIG_SOURCE = readFileSync(
  resolve(__dirname, "../../vite.config.ts"),
  "utf-8"
);

describe("version display", () => {
  it("renders the injected version rather than a literal", () => {
    expect(USER_MENU_SOURCE).toContain("__APP_VERSION__");
    expect(USER_MENU_SOURCE).toContain("DENVAULT V{{ appVersion }}");
  });

  it("has no hardcoded version literal in the settings screen", () => {
    // Catches "V1.0.1", "v 1.2.3" and friends re-entering the template.
    expect(USER_MENU_SOURCE).not.toMatch(/\bv\s?\d+\.\d+\.\d+/i);
  });

  it("sources the injected value from the manifest", () => {
    // package.json would drift from the manifest, and the manifest is
    // what the browser and the store report.
    expect(VITE_CONFIG_SOURCE).toMatch(
      /__APP_VERSION__:\s*JSON\.stringify\(manifest\.version\)/
    );
  });
});
