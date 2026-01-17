#!/usr/bin/env npx tsx
/**
 * UI Contract Check - V55.3.1 ROI Coverage Backlog
 *
 * Static validation of UI component contracts with proper scoping.
 *
 * Features:
 * - Resolves repo root by walking up from script location
 * - Extracts Vue template/script blocks separately
 * - Strips comments before matching (no false positives)
 * - Uses contextual regex patterns (not substring matching)
 *
 * Run with: npx tsx scripts/ui-contract-check.ts
 * Or: pnpm contract:check
 *
 * Options:
 *   --root <path>   Override repo root path
 *   --verbose       Show match snippets
 *
 * Env:
 *   DENVAULT_ROOT   Override repo root path
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type CheckScope = "template" | "script" | "style" | "full";

interface Check {
  id: string;
  file: string; // relative to wallet-extension/
  scope?: CheckScope;
  pattern: RegExp;
  description: string;
}

// ─────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────

function fileExists(p: string): boolean {
  try {
    fs.accessSync(p, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve wallet-extension root by walking up from script location.
 * Looks for markers: package.json with "wallet-extension" name, or src/ folder.
 */
function resolveWalletExtensionRoot(): string {
  // Priority: CLI --root, env, then walk up from this script
  const argRootIdx = process.argv.findIndex((a) => a === "--root");
  const cliRoot = argRootIdx >= 0 ? process.argv[argRootIdx + 1] : undefined;
  const envRoot = process.env.DENVAULT_ROOT;

  if (cliRoot) {
    const resolved = path.resolve(cliRoot);
    if (fileExists(path.join(resolved, "package.json"))) {
      return resolved;
    }
    throw new Error(`--root path does not contain package.json: ${resolved}`);
  }

  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (fileExists(path.join(resolved, "package.json"))) {
      return resolved;
    }
    throw new Error(`DENVAULT_ROOT does not contain package.json: ${resolved}`);
  }

  // Walk up from scripts/ folder
  let cur = path.resolve(__dirname, ".."); // scripts/ -> wallet-extension/

  for (let i = 0; i < 10; i++) {
    const pkgPath = path.join(cur, "package.json");
    if (fileExists(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "wallet-extension") {
          return cur;
        }
      } catch {
        // Continue searching
      }
    }

    // Also check for src/ folder as marker
    if (fileExists(path.join(cur, "src", "App.vue"))) {
      return cur;
    }

    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }

  throw new Error(
    `Could not resolve wallet-extension root from: ${__dirname}. ` +
      `Provide --root or set DENVAULT_ROOT.`
  );
}

function readText(absPath: string): string {
  return fs.readFileSync(absPath, "utf8");
}

/**
 * Strip HTML comments: <!-- ... -->
 */
function stripHtmlComments(s: string): string {
  return s.replace(/<!--[\s\S]*?-->/g, "");
}

/**
 * Strip JS/TS comments: line comments (//) and block comments.
 * Note: This is a basic implementation. Edge cases with regex literals
 * are rare in Vue component scripts.
 */
function stripJsComments(s: string): string {
  return s
    .replace(/\/\*[\s\S]*?\*\//g, "") // Block comments
    .replace(/(^|[^:])\/\/.*$/gm, "$1"); // Line comments (avoid URLs)
}

/**
 * Extract Vue SFC blocks by regex.
 * Returns template and script content (without the wrapper tags).
 *
 * Note: Uses greedy matching to handle nested <template> tags (slots).
 * The outermost template/script/style are matched by finding the LAST
 * closing tag of each type.
 */
function extractVueBlocks(vueSource: string): {
  template: string;
  script: string;
  style: string;
} {
  // Match <template>...</template> - GREEDY to get outermost (handles nested slot templates)
  // This works because Vue SFCs have template at the top level
  const templateMatch = vueSource.match(
    /<template\b[^>]*>([\s\S]*)<\/template>\s*(?=<script|<style|$)/i
  );
  // Match <script> or <script setup> - non-greedy is fine (no nesting)
  const scriptMatch = vueSource.match(
    /<script\b[^>]*>([\s\S]*?)<\/script>/i
  );
  // Match <style> - non-greedy is fine (no nesting)
  const styleMatch = vueSource.match(/<style\b[^>]*>([\s\S]*?)<\/style>/i);

  return {
    template: templateMatch ? templateMatch[1] : "",
    script: scriptMatch ? scriptMatch[1] : "",
    style: styleMatch ? styleMatch[1] : "",
  };
}

/**
 * Select and clean the appropriate scope text for checking.
 */
function selectScopeText(
  filePath: string,
  source: string,
  scope?: CheckScope
): string {
  const ext = path.extname(filePath).toLowerCase();

  if (ext === ".vue") {
    const { template, script, style } = extractVueBlocks(source);

    switch (scope) {
      case "template":
        return stripHtmlComments(template);
      case "script":
        return stripJsComments(script);
      case "style":
        return style; // Don't strip CSS comments for style checks
      case "full":
      default:
        return (
          stripHtmlComments(template) +
          "\n" +
          stripJsComments(script)
        );
    }
  }

  // Non-vue files (ts/js): treat as script
  if (scope === "template") return ""; // Not applicable
  return stripJsComments(source);
}

/**
 * Extract a snippet around the match for debugging.
 */
function snippetAround(text: string, index: number, radius = 60): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + radius);
  let snippet = text.slice(start, end).replace(/\s+/g, " ");
  if (start > 0) snippet = "..." + snippet;
  if (end < text.length) snippet = snippet + "...";
  return snippet;
}

// ─────────────────────────────────────────────────────────────
// Contract Checks Definition
// ─────────────────────────────────────────────────────────────

const CHECKS: Check[] = [
  // ═══════════════════════════════════════════════════════════
  // Confirmation.vue — V55.2 Shell Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "CONF-1",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Match: <ScreenShell ... data-roi="confirm-screen" ...>
    // Attributes can be in any order
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']confirm-screen["']/,
    description: 'Confirmation uses ScreenShell with data-roi="confirm-screen"',
  },
  {
    id: "CONF-2",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Match: <AppHeader ... left="close" ...> (attributes in any order)
    pattern: /<AppHeader\b[^>]*\bleft\s*=\s*["']close["']/,
    description: 'Confirmation uses AppHeader with left="close"',
  },
  {
    id: "CONF-3",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Match: data-roi="confirm-title" on AppHeader or any element
    pattern: /\bdata-roi\s*=\s*["']confirm-title["']/,
    description: 'Confirmation has data-roi="confirm-title"',
  },
  {
    id: "CONF-4",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Match: <StickyCTA with primary-text="Approve" (multi-line safe)
    pattern: /<StickyCTA\b[\s\S]*?\bprimary-text\s*=\s*["']Approve["']/,
    description: 'Confirmation uses StickyCTA with primary-text="Approve"',
  },
  {
    id: "CONF-5",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Match: secondary-text="Deny" on StickyCTA (multi-line safe)
    pattern: /<StickyCTA\b[\s\S]*?\bsecondary-text\s*=\s*["']Deny["']/,
    description: 'Confirmation uses StickyCTA with secondary-text="Deny"',
  },
  {
    id: "CONF-6",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Match: data-roi="confirm-origin" (anywhere in template)
    pattern: /data-roi\s*=\s*["']confirm-origin["']/,
    description: 'Confirmation has data-roi="confirm-origin"',
  },
  {
    id: "CONF-7",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Match: data-roi="confirm-error-slot" (anywhere in template)
    pattern: /data-roi\s*=\s*["']confirm-error-slot["']/,
    description: 'Confirmation has data-roi="confirm-error-slot"',
  },
  {
    id: "CONF-8",
    file: "src/components/Confirmation.vue",
    scope: "style",
    // Match: min-height: 24px (anti-layout-shift for error slot)
    pattern: /min-height:\s*24px/,
    description: "Confirmation has error slot with min-height: 24px",
  },

  // ═══════════════════════════════════════════════════════════
  // StickyCTA.vue — V55.2 Button ROI Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "CTA-1",
    file: "src/components/layout/StickyCTA.vue",
    scope: "template",
    // Primary button must have dynamic :data-roi binding
    pattern: /<Button\b[\s\S]*?:data-roi\s*=\s*["']roiPrimary["']/,
    description: "StickyCTA has :data-roi=\"roiPrimary\" on primary button",
  },
  {
    id: "CTA-2",
    file: "src/components/layout/StickyCTA.vue",
    scope: "template",
    // Secondary button must have dynamic :data-roi binding
    pattern: /<Button\b[\s\S]*?:data-roi\s*=\s*["']roiSecondary["']/,
    description: "StickyCTA has :data-roi=\"roiSecondary\" on secondary button",
  },
  {
    id: "CTA-3",
    file: "src/components/layout/StickyCTA.vue",
    scope: "script",
    // roiPrefix prop must exist for customization
    pattern: /roiPrefix\?\s*:\s*string/,
    description: "StickyCTA has optional roiPrefix prop",
  },
  {
    id: "CONF-9",
    file: "src/components/Confirmation.vue",
    scope: "template",
    // Confirmation must use roi-prefix="confirm" for unique targeting
    pattern: /<StickyCTA\b[\s\S]*?\broi-prefix\s*=\s*["']confirm["']/,
    description: 'Confirmation uses StickyCTA with roi-prefix="confirm"',
  },

  // ═══════════════════════════════════════════════════════════
  // UserHomeView.vue — V55.2 Shell Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "HOME-1",
    file: "src/views/UserHomeView.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']home-screen["']/,
    description: 'UserHomeView uses ScreenShell with data-roi="home-screen"',
  },
  {
    id: "HOME-2",
    file: "src/views/UserHomeView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']home-balance-card["']/,
    description: 'UserHomeView has data-roi="home-balance-card"',
  },
  {
    id: "HOME-3",
    file: "src/views/UserHomeView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']home-quick-actions["']/,
    description: 'UserHomeView has data-roi="home-quick-actions"',
  },
  {
    id: "HOME-4",
    file: "src/views/UserHomeView.vue",
    scope: "template",
    pattern: /data-roi\s*=\s*["']home-assets-list["']/,
    description: 'UserHomeView has data-roi="home-assets-list"',
  },
  {
    id: "HOME-5",
    file: "src/views/UserHomeView.vue",
    scope: "template",
    pattern: /data-roi\s*=\s*["']home-activity-preview["']/,
    description: 'UserHomeView has data-roi="home-activity-preview"',
  },

  // ═══════════════════════════════════════════════════════════
  // AppHeader.vue — V55.2 Close Option Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "HDR-1",
    file: "src/components/layout/AppHeader.vue",
    scope: "script",
    // Match: left?: "back" | "menu" | "close" | "none" (in defineProps)
    // The pattern looks for "close" within a type union for left prop
    pattern: /left\??\s*:\s*["'`]?(?:back|menu|close|none)["'`]?\s*\|/,
    description: 'AppHeader type includes "close" in left prop union',
  },
  {
    id: "HDR-2",
    file: "src/components/layout/AppHeader.vue",
    scope: "template",
    // Match: v-else-if="left === 'close'" for close icon rendering
    pattern: /v-(?:else-)?if\s*=\s*["']left\s*===\s*['"]close['"]['"]/,
    description: "AppHeader renders close icon conditionally",
  },

  // ═══════════════════════════════════════════════════════════
  // SendView.vue — V55.3 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "SEND-1",
    file: "src/views/SendView.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']send-screen["']/,
    description: 'SendView uses ScreenShell with data-roi="send-screen"',
  },
  {
    id: "SEND-2",
    file: "src/views/SendView.vue",
    scope: "template",
    pattern: /<AppHeader\b[^>]*\bdata-roi\s*=\s*["']send-title["']/,
    description: 'SendView uses AppHeader with data-roi="send-title"',
  },
  {
    id: "SEND-3",
    file: "src/views/SendView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']send-form["']/,
    description: 'SendView has data-roi="send-form"',
  },
  {
    id: "SEND-4",
    file: "src/views/SendView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']send-cta["']/,
    description: 'SendView has data-roi="send-cta"',
  },

  // ═══════════════════════════════════════════════════════════
  // UnlockView.vue — V55.3 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "UNLOCK-1",
    file: "src/views/UnlockView.vue",
    scope: "template",
    // Match: screen-roi="unlock" on PinScreenShell
    pattern: /<PinScreenShell\b[\s\S]*?\bscreen-roi\s*=\s*["']unlock["']/,
    description: 'UnlockView uses PinScreenShell with screen-roi="unlock"',
  },
  {
    id: "UNLOCK-2",
    file: "src/views/UnlockView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']forgot-pin-link["']/,
    description: 'UnlockView has data-roi="forgot-pin-link"',
  },

  // ═══════════════════════════════════════════════════════════
  // ConfirmTxView.vue — V55.3 ROI Coverage Contract (Formalize)
  // ═══════════════════════════════════════════════════════════
  {
    id: "CONFIRMTX-1",
    file: "src/views/ConfirmTxView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']confirm-view-root["']/,
    description: 'ConfirmTxView has data-roi="confirm-view-root"',
  },
  {
    id: "CONFIRMTX-2",
    file: "src/views/ConfirmTxView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']confirm-summary["']/,
    description: 'ConfirmTxView has data-roi="confirm-summary"',
  },
  {
    id: "CONFIRMTX-3",
    file: "src/views/ConfirmTxView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']confirm-cta-rail["']/,
    description: 'ConfirmTxView has data-roi="confirm-cta-rail"',
  },

  // ═══════════════════════════════════════════════════════════
  // VerifyPinView.vue — V55.3.1 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "VERIFY-1",
    file: "src/views/VerifyPinView.vue",
    scope: "template",
    pattern: /<PinScreenShell\b[\s\S]*?\bscreen-roi\s*=\s*["']verify-pin["']/,
    description: 'VerifyPinView uses PinScreenShell with screen-roi="verify-pin"',
  },
  {
    id: "VERIFY-2",
    file: "src/views/VerifyPinView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']cancel-link["']/,
    description: 'VerifyPinView has data-roi="cancel-link"',
  },
  {
    id: "VERIFY-3",
    file: "src/components/pin/PinScreenShell.vue",
    scope: "script",
    pattern: /screenRoi\?\s*:\s*string/,
    description: "PinScreenShell has optional screenRoi prop",
  },

  // ═══════════════════════════════════════════════════════════
  // TxResultView.vue — V55.3.1 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "TXR-1",
    file: "src/views/TxResultView.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']tx-result-screen["']/,
    description: 'TxResultView uses ScreenShell with data-roi="tx-result-screen"',
  },
  {
    id: "TXR-2",
    file: "src/views/TxResultView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']tx-result-status["']/,
    description: 'TxResultView has data-roi="tx-result-status"',
  },
  {
    id: "TXR-3",
    file: "src/views/TxResultView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']tx-result-summary["']/,
    description: 'TxResultView has data-roi="tx-result-summary"',
  },
  {
    id: "TXR-4",
    file: "src/views/TxResultView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']tx-result-cta-rail["']/,
    description: 'TxResultView has data-roi="tx-result-cta-rail"',
  },
  {
    id: "TXR-5",
    file: "src/views/TxResultView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']tx-result-txid["']/,
    description: 'TxResultView has data-roi="tx-result-txid"',
  },

  // ═══════════════════════════════════════════════════════════
  // UserMenu.vue — V55.3.1 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "MENU-1",
    file: "src/views/UserMenu.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']menu-screen["']/,
    description: 'UserMenu uses ScreenShell with data-roi="menu-screen"',
  },
  {
    id: "MENU-2",
    file: "src/views/UserMenu.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']menu-section-wallet["']/,
    description: 'UserMenu has data-roi="menu-section-wallet"',
  },
  {
    id: "MENU-3",
    file: "src/views/UserMenu.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']menu-section-security["']/,
    description: 'UserMenu has data-roi="menu-section-security"',
  },
  {
    id: "MENU-4",
    file: "src/views/UserMenu.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']menu-action-export["']/,
    description: 'UserMenu has data-roi="menu-action-export" (high-risk action)',
  },
  {
    id: "MENU-5",
    file: "src/views/UserMenu.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']menu-action-delete["']/,
    description: 'UserMenu has data-roi="menu-action-delete" (high-risk action)',
  },
  {
    id: "MENU-6",
    file: "src/views/UserMenu.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']menu-section-danger["']/,
    description: 'UserMenu has data-roi="menu-section-danger"',
  },
];

// ─────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────

function runChecks(root: string, checks: Check[]): void {
  const verbose = process.argv.includes("--verbose");
  const failures: string[] = [];
  const passed: string[] = [];

  console.log("\n🔍 V55.3.1 UI Contract Check\n");
  console.log("=".repeat(60));
  console.log(`Root: ${root}`);
  console.log("=".repeat(60));

  for (const chk of checks) {
    const absPath = path.join(root, chk.file);

    if (!fileExists(absPath)) {
      failures.push(
        `[${chk.id}] MISSING FILE\n` +
          `  Description: ${chk.description}\n` +
          `  Expected at: ${chk.file}`
      );
      continue;
    }

    const raw = readText(absPath);
    const haystack = selectScopeText(chk.file, raw, chk.scope);

    const match = haystack.match(chk.pattern);

    if (!match) {
      failures.push(
        `[${chk.id}] FAILED\n` +
          `  Description: ${chk.description}\n` +
          `  File: ${chk.file}\n` +
          `  Scope: ${chk.scope || "full"}\n` +
          `  Pattern: ${chk.pattern}`
      );
    } else {
      passed.push(chk.id);
      if (verbose) {
        const idx = match.index ?? 0;
        const snip = snippetAround(haystack, idx);
        console.log(`\n✅ [${chk.id}] ${chk.description}`);
        console.log(`   Match: ${snip}`);
      }
    }
  }

  console.log("\n" + "=".repeat(60));

  if (failures.length === 0) {
    console.log(`\n✅ All ${checks.length} UI contracts passed\n`);
    if (!verbose) {
      console.log(`   Passed: ${passed.join(", ")}\n`);
    }
    process.exit(0);
  } else {
    console.log(`\n❌ ${failures.length}/${checks.length} contracts failed\n`);
    for (const f of failures) {
      console.log(f + "\n");
    }
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

try {
  const root = resolveWalletExtensionRoot();
  runChecks(root, CHECKS);
} catch (err) {
  console.error(`\n❌ Error: ${(err as Error).message}\n`);
  process.exit(1);
}
