#!/usr/bin/env npx tsx
/**
 * UI Contract Check - V55.3.2 ROI Coverage Remaining Backlog
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

  // ═══════════════════════════════════════════════════════════
  // StartView.vue — V55.3.2 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "START-1",
    file: "src/views/StartView.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']start-screen["']/,
    description: 'StartView uses ScreenShell with data-roi="start-screen"',
  },

  // ═══════════════════════════════════════════════════════════
  // AddWalletView.vue — V55.3.2 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "ADDWALLET-1",
    file: "src/views/AddWalletView.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']addwallet-screen["']/,
    description: 'AddWalletView uses ScreenShell with data-roi="addwallet-screen"',
  },

  // ═══════════════════════════════════════════════════════════
  // AccountDetailsView.vue — V55.3.2 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "ACCT-1",
    file: "src/views/AccountDetailsView.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']account-screen["']/,
    description: 'AccountDetailsView uses ScreenShell with data-roi="account-screen"',
  },
  {
    id: "ACCT-2",
    file: "src/views/AccountDetailsView.vue",
    scope: "template",
    pattern: /<AppHeader\b[^>]*\bdata-roi\s*=\s*["']account-title["']/,
    description: 'AccountDetailsView uses AppHeader with data-roi="account-title"',
  },
  {
    id: "ACCT-3",
    file: "src/views/AccountDetailsView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']account-section-profile["']/,
    description: 'AccountDetailsView has data-roi="account-section-profile"',
  },
  {
    id: "ACCT-4",
    file: "src/views/AccountDetailsView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']account-section-addresses["']/,
    description: 'AccountDetailsView has data-roi="account-section-addresses"',
  },
  {
    id: "ACCT-5",
    file: "src/views/AccountDetailsView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']account-section-security["']/,
    description: 'AccountDetailsView has data-roi="account-section-security"',
  },
  {
    id: "ACCT-6",
    file: "src/views/AccountDetailsView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']account-section-prefs["']/,
    description: 'AccountDetailsView has data-roi="account-section-prefs"',
  },

  // ═══════════════════════════════════════════════════════════
  // AddTokenView.vue — V55.3.2 ROI Coverage Contract
  // ═══════════════════════════════════════════════════════════
  {
    id: "TOKEN-1",
    file: "src/views/AddTokenView.vue",
    scope: "template",
    pattern: /<ScreenShell\b[^>]*\bdata-roi\s*=\s*["']token-screen["']/,
    description: 'AddTokenView uses ScreenShell with data-roi="token-screen"',
  },
  {
    id: "TOKEN-2",
    file: "src/views/AddTokenView.vue",
    scope: "template",
    pattern: /<AppHeader\b[^>]*\bdata-roi\s*=\s*["']token-title["']/,
    description: 'AddTokenView uses AppHeader with data-roi="token-title"',
  },
  {
    id: "TOKEN-3",
    file: "src/views/AddTokenView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']token-form["']/,
    description: 'AddTokenView has data-roi="token-form"',
  },
  {
    id: "TOKEN-4",
    file: "src/views/AddTokenView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']token-preview["']/,
    description: 'AddTokenView has data-roi="token-preview"',
  },
  {
    id: "TOKEN-5",
    file: "src/views/AddTokenView.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']token-cta["']/,
    description: 'AddTokenView has data-roi="token-cta"',
  },

  // ═══════════════════════════════════════════════════════════
  // V55.4 Overlay System — ROI Coverage Contracts
  // ═══════════════════════════════════════════════════════════

  // AddressQrModal.vue
  {
    id: "QR-1",
    file: "src/components/account/AddressQrModal.vue",
    scope: "template",
    pattern: /<Sheet\b[\s\S]*?\bdata-roi\s*=\s*["']qr-sheet["']/,
    description: 'AddressQrModal uses Sheet with data-roi="qr-sheet"',
  },
  {
    id: "QR-2",
    file: "src/components/account/AddressQrModal.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']qr-address["']/,
    description: 'AddressQrModal has data-roi="qr-address"',
  },

  // ═══════════════════════════════════════════════════════════
  // V56 DoD: ReceiveModal.vue — 6-Point Definition of Done
  // ═══════════════════════════════════════════════════════════
  {
    id: "RECV-DOD-1",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /<Sheet\b[\s\S]*?\bvariant\s*=\s*["']modal["']/,
    description: 'DoD#1: ReceiveModal uses Sheet primitive (variant="modal" - V63)',
  },
  {
    id: "RECV-DOD-2",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /:show-close\s*=\s*["']?true["']?/,
    description: 'DoD#2: ReceiveModal single close affordance (Sheet showClose)',
  },
  {
    id: "RECV-DOD-3",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /\btitle\s*=\s*["']Receive["']/,
    description: 'DoD#3: ReceiveModal uses Sheet built-in header',
  },
  {
    id: "RECV-DOD-4",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /<StickyCTA\b[\s\S]*?\broi-prefix\s*=\s*["']receive["']/,
    description: 'DoD#4: ReceiveModal uses StickyCTA roiPrefix="receive"',
  },
  {
    id: "RECV-DOD-5",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /<SegmentedTabs\b/,
    description: 'DoD#5: ReceiveModal uses SegmentedTabs primitive',
  },
  {
    id: "RECV-DOD-6",
    file: "src/components/ReceiveModal.vue",
    scope: "style",
    pattern: /\.error-slot[\s\S]*?min-height/,
    description: 'DoD#6: ReceiveModal has error-slot with min-height (anti-layout-shift)',
  },
  // ROI anchors
  {
    id: "RECV-ROI-1",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']receive-sheet["']/,
    description: 'ReceiveModal has data-roi="receive-sheet"',
  },
  {
    id: "RECV-ROI-2",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']receive-tabs["']/,
    description: 'ReceiveModal has data-roi="receive-tabs"',
  },
  {
    id: "RECV-ROI-3",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']receive-qr["']/,
    description: 'ReceiveModal has data-roi="receive-qr"',
  },
  {
    id: "RECV-ROI-4",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']receive-error["']/,
    description: 'ReceiveModal has data-roi="receive-error" (error slot)',
  },

  // ═══════════════════════════════════════════════════════════
  // V56: AccountSwitcher.vue — Updated ROI Contracts
  // ═══════════════════════════════════════════════════════════
  {
    id: "ACCTSW-1",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']acctsw-sheet["']/,
    description: 'AccountSwitcher has data-roi="acctsw-sheet" (V56)',
  },
  {
    id: "ACCTSW-2",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']acctsw-list["']/,
    description: 'AccountSwitcher has data-roi="acctsw-list" (V56)',
  },
  {
    id: "ACCTSW-3",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']acctsw-trigger["']/,
    description: 'AccountSwitcher has data-roi="acctsw-trigger" (V56)',
  },
  {
    id: "ACCTSW-4",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']acctsw-add["']/,
    description: 'AccountSwitcher has data-roi="acctsw-add" (V56)',
  },
  {
    id: "ACCTSW-5",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /<Sheet\b[\s\S]*?\bvariant\s*=\s*["']dropdown["']/,
    description: 'AccountSwitcher uses Sheet variant="dropdown" (V56 Decision: picker)',
  },
  {
    id: "ACCTSW-6",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /<ListGroup\b/,
    description: 'AccountSwitcher uses ListGroup (V56 primitive)',
  },

  // ═══════════════════════════════════════════════════════════
  // V56 DoD: ImportMnemonicModal.vue — 6-Point Definition of Done
  // ═══════════════════════════════════════════════════════════
  {
    id: "IMPORT-DOD-1",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /<Sheet\b[\s\S]*?\bvariant\s*=\s*["']modal["']/,
    description: 'DoD#1: ImportMnemonicModal uses Sheet primitive (variant="modal" - V63)',
  },
  {
    id: "IMPORT-DOD-2",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /@close\s*=\s*["']handleClose["']/,
    description: 'DoD#2: ImportMnemonicModal single close affordance (Sheet @close)',
  },
  {
    id: "IMPORT-DOD-3",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /\btitle\s*=\s*["']Import Recovery Phrase["']/,
    description: 'DoD#3: ImportMnemonicModal uses Sheet built-in header',
  },
  {
    id: "IMPORT-DOD-4",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /<StickyCTA\b[\s\S]*?\broi-prefix\s*=\s*["']import["']/,
    description: 'DoD#4: ImportMnemonicModal uses StickyCTA roiPrefix="import"',
  },
  {
    id: "IMPORT-DOD-5",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /<textarea\b/,
    description: 'DoD#5: ImportMnemonicModal uses textarea for mnemonic input',
  },
  {
    id: "IMPORT-DOD-6",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "style",
    pattern: /\.error-slot[\s\S]*?min-height/,
    description: 'DoD#6: ImportMnemonicModal has error-slot with min-height (anti-layout-shift)',
  },
  // ROI anchors
  {
    id: "IMPORT-ROI-1",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']import-sheet["']/,
    description: 'ImportMnemonicModal has data-roi="import-sheet"',
  },
  {
    id: "IMPORT-ROI-2",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']import-content["']/,
    description: 'ImportMnemonicModal has data-roi="import-content"',
  },

  // ═══════════════════════════════════════════════════════════
  // V56.2: Primitive-Level Dropdown Close (Sheet.vue fix)
  // ═══════════════════════════════════════════════════════════
  {
    id: "SHEET-DROPDOWN-1",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-overlay--dropdown[\s\S]*?pointer-events:\s*auto/,
    description: 'Sheet dropdown overlay has pointer-events: auto (V56.2 primitive fix)',
  },
  {
    id: "SHEET-DROPDOWN-2",
    file: "src/components/ui/Sheet.vue",
    scope: "script",
    pattern: /handleOverlayClick[\s\S]*?closeOnOverlay[\s\S]*?emit\(['"]close['"]\)/,
    description: 'Sheet.vue has overlay click handler that emits close',
  },
  {
    id: "SHEET-DROPDOWN-3",
    file: "src/components/ui/Sheet.vue",
    scope: "script",
    pattern: /handleEscapeKey[\s\S]*?closeOnEscape[\s\S]*?emit\(['"]close['"]\)/,
    description: 'Sheet.vue has ESC key handler that emits close',
  },

  // ═══════════════════════════════════════════════════════════
  // V56.2: AccountSwitcher Checkmark Pattern
  // ═══════════════════════════════════════════════════════════
  {
    id: "ACCTSW-7",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /#right[\s\S]*?account-check/,
    description: 'AccountSwitcher uses trailing checkmark for active (V56.2 NetworkChip pattern)',
  },
  {
    id: "ACCTSW-8",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /switcher-footer[\s\S]*?Add\s*account/i,
    description: 'V68: AccountSwitcher "Add Account" is in sticky footer',
  },

  // ═══════════════════════════════════════════════════════════
  // V56.2: Other Modal Close Contracts (unchanged)
  // ═══════════════════════════════════════════════════════════
  {
    id: "CLOSE-4",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /:show-close\s*=\s*["']?true["']?/,
    description: 'ReceiveModal has Sheet showClose=true (single close affordance)',
  },
  {
    id: "CLOSE-5",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "template",
    pattern: /<Sheet\b[\s\S]*?@close\s*=\s*["']handleClose["']/,
    description: 'ImportMnemonicModal has @close handler (Sheet default showClose)',
  },

  // ═══════════════════════════════════════════════════════════
  // V55.5 Primitives Unification — ListRow Migration
  // ═══════════════════════════════════════════════════════════
  {
    id: "V55-1",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "script",
    pattern: /import\s+ListRow\s+from/,
    description: 'AccountSwitcher imports ListRow primitive',
  },
  {
    id: "V55-2",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /<ListRow\b/,
    description: 'AccountSwitcher uses <ListRow> component',
  },

  // ═══════════════════════════════════════════════════════════
  // V56.3: NetworkChip Sheet Primitive Migration
  // ═══════════════════════════════════════════════════════════
  {
    id: "NET-1",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /<Sheet\b[\s\S]*?\bvariant\s*=\s*["']dropdown["']/,
    description: 'NetworkChip uses Sheet variant="dropdown" (V56.3 primitive migration)',
  },
  {
    id: "NET-2",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']network-trigger["']/,
    description: 'NetworkChip has data-roi="network-trigger" (V56.3)',
  },
  {
    id: "NET-3",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']network-sheet["']/,
    description: 'NetworkChip has data-roi="network-sheet" (V56.3)',
  },
  {
    id: "NET-4",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /\bdata-roi\s*=\s*["']network-list["']/,
    description: 'NetworkChip has data-roi="network-list" (V56.3)',
  },
  {
    id: "NET-5",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /<ListRow\b/,
    description: 'NetworkChip uses ListRow primitive (V56.3)',
  },
  {
    id: "NET-6",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /#right[\s\S]*?network-check/,
    description: 'NetworkChip uses trailing checkmark for active (V56.3)',
  },

  // ═══════════════════════════════════════════════════════════
  // V57/V64: Dropdown Trigger Geometry Standard (Regression Guard)
  // Reference: AccountSwitcher (8px dot, 12x12 chevron)
  // V64: Now uses var(--dot-size) token instead of literal 8px
  // ═══════════════════════════════════════════════════════════
  {
    id: "GEOM-1",
    file: "src/components/network/NetworkChip.vue",
    scope: "style",
    pattern: /\.network-chip__dot[\s\S]*?width:\s*(?:8px|var\(--dot-size\))[\s\S]*?height:\s*(?:8px|var\(--dot-size\))/,
    description: 'V57/V64 Geometry: NetworkChip trigger dot is 8px or var(--dot-size)',
  },
  {
    id: "GEOM-2",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /network-chip__arrow[\s\S]*?width\s*=\s*["']12["'][\s\S]*?height\s*=\s*["']12["']/,
    description: 'V57 Geometry: NetworkChip chevron is 12x12 (matches AccountSwitcher)',
  },

  // ═══════════════════════════════════════════════════════════
  // V58: Home-Parity Contracts (Dropdown Triggers)
  // ═══════════════════════════════════════════════════════════
  {
    id: "V58-1",
    file: "src/components/network/NetworkChip.vue",
    scope: "style",
    pattern: /\.network-chip\s*\{[\s\S]*?gap:\s*var\(--space-sm\)/,
    description: 'V58 Home-Parity: NetworkChip trigger gap matches AccountSwitcher (space-sm)',
  },
  {
    id: "V58-2",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "style",
    pattern: /\.account-pill\s*\{[\s\S]*?gap:\s*var\(--space-sm\)/,
    description: 'V58 Home-Parity: AccountSwitcher trigger gap uses token (space-sm)',
  },
  {
    id: "V58-3",
    file: "src/components/network/NetworkChip.vue",
    scope: "style",
    pattern: /\.network-check[\s\S]*?font-size:\s*var\(--font-size-xs\)/,
    description: 'V58 Home-Parity: NetworkChip checkmark uses token (font-size-xs)',
  },
  {
    id: "V58-4",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "style",
    pattern: /\.account-check[\s\S]*?font-size:\s*var\(--font-size-xs\)/,
    description: 'V58 Home-Parity: AccountSwitcher checkmark uses token (font-size-xs)',
  },

  // ═══════════════════════════════════════════════════════════
  // V62: Premium Glass Surface Recipe (Home-Parity Panels)
  // ═══════════════════════════════════════════════════════════
  {
    id: "V62-1",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--panel-bg-glass:\s*rgba\(10,\s*12,\s*16/,
    description: 'V70 Glass: Premium dark glass token exists (V62 upgraded)',
  },
  {
    id: "V62-2",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--panel-blur:\s*16px/,
    description: 'V62 Glass: Blur token exists',
  },
  {
    id: "V62-3",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--panel-saturate:\s*1\.2/,
    description: 'V62 Glass: Saturate token exists',
  },
  {
    id: "V62-4",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-container[\s\S]*?backdrop-filter:\s*blur/,
    description: 'V62 Glass: Sheet container uses backdrop-filter blur (V63: unified)',
  },
  {
    id: "V62-5",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-container[\s\S]*?background:\s*var\(--panel-bg-glass\)/,
    description: 'V62 Glass: Sheet container uses glass background (V63: unified)',
  },
  {
    id: "V62-6",
    file: "src/components/list/ListGroup.vue",
    scope: "style",
    pattern: /\.list-group-items[\s\S]*?background:\s*rgba\(255,\s*255,\s*255,\s*0\.02\)/,
    description: 'V62 Glass: ListGroup uses transparent overlay (lets glass through)',
  },

  // ═══════════════════════════════════════════════════════════
  // V63: Unified Overlay System (dropdown + modal grammar)
  // ═══════════════════════════════════════════════════════════
  {
    id: "V63-1",
    file: "src/components/ui/Sheet.vue",
    scope: "script",
    pattern: /SheetVariant\s*=\s*['"]dropdown['"]\s*\|\s*['"]modal['"]/,
    description: 'V63 Overlay: Sheet variants are dropdown | modal only',
  },
  {
    id: "V63-2",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-container[\s\S]*?overflow:\s*hidden/,
    description: 'V63 Scroll: Container never scrolls (overflow:hidden)',
  },
  {
    id: "V63-3",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-body[\s\S]*?overflow-y:\s*auto/,
    description: 'V63 Scroll: Only .sheet-body scrolls (overflow-y:auto)',
  },
  {
    id: "V63-4",
    file: "src/components/ReceiveModal.vue",
    scope: "template",
    pattern: /variant="modal"/,
    description: 'V63 Overlay: ReceiveModal uses centered modal variant',
  },
  {
    id: "V63-5",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-dropdown-anchor[\s\S]*?position:\s*absolute/,
    description: 'V63 Anchor: Dropdown anchor is position:absolute',
  },
  {
    id: "V63-6",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-container--modal[\s\S]*?width:\s*clamp\(320px/,
    description: 'V63 Modal: Modal uses pro sizing with clamp()',
  },

  // ═══════════════════════════════════════════════════════════
  // V67: Scrim Layer (Home-parity overlay separation)
  // ═══════════════════════════════════════════════════════════
  {
    id: "V67-1",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--scrim-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.6/,
    description: 'V70 Scrim: --scrim-bg token exists (>=0.60 opacity, V67 upgraded)',
  },
  {
    id: "V67-2",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-overlay[\s\S]*?background:\s*var\(--scrim-bg\)/,
    description: 'V67 Scrim: Sheet overlay uses --scrim-bg token',
  },
  {
    id: "V67-3",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--scrim-transition:\s*\d+ms/,
    description: 'V67 Scrim: --scrim-transition token exists',
  },
  {
    id: "V67-4",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-overlay[\s\S]*?transition:[\s\S]*?var\(--scrim-transition\)/,
    description: 'V67 Scrim: Sheet overlay uses --scrim-transition',
  },

  // ═══════════════════════════════════════════════════════════
  // V68: Accounts Management System
  // ═══════════════════════════════════════════════════════════
  {
    id: "V68-1",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /Manage\s*accounts/i,
    description: 'V68: AccountSwitcher has "Manage accounts" action',
  },
  {
    id: "V68-2",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "style",
    pattern: /max-height:[\s\S]*?calc\(70vh/,
    description: 'V68: AccountSwitcher dropdown has max-height constraint',
  },
  {
    id: "V68-3",
    file: "src/views/AccountsView.vue",
    scope: "template",
    pattern: /<ListGroup/,
    description: 'V68: Accounts management screen uses ListGroup',
  },
  {
    id: "V68-4",
    file: "src/router/index.ts",
    scope: "script",
    pattern: /path:\s*["']\/accounts["']/,
    description: 'V68: /accounts route is defined',
  },

  // ═══════════════════════════════════════════════════════════
  // V70: Visual System Lock (Premium Parity)
  // ═══════════════════════════════════════════════════════════
  {
    id: "V70-1",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--screen-bg-base:\s*var\(--color-bg-primary\)/,
    description: 'V70: --screen-bg-base token exists and references --color-bg-primary',
  },
  {
    id: "V70-2",
    file: "src/components/layout/ScreenShell.vue",
    scope: "style",
    pattern: /background:\s*var\(--screen-bg-base\)/,
    description: 'V70: ScreenShell uses --screen-bg-base',
  },
  {
    id: "V70-3",
    file: "src/components/account/AccountSwitcher.vue",
    scope: "template",
    pattern: /title=["']Accounts["']/,
    description: 'V70: AccountSwitcher dropdown has "Accounts" header title',
  },
  {
    id: "V70-4",
    file: "src/components/network/NetworkChip.vue",
    scope: "template",
    pattern: /title=["']Network["']/,
    description: 'V70: NetworkChip dropdown has "Network" header title',
  },
  {
    id: "V70-5",
    file: "src/components/ImportMnemonicModal.vue",
    scope: "style",
    pattern: /\.paste-btn[\s\S]*?z-index:\s*\d+/,
    description: 'V70: PASTE button has z-index to prevent overlap',
  },

  // V70 Premium Glass Parity Contracts
  {
    id: "V70-6",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--panel-bg-glass:\s*rgba\(10,\s*12,\s*16,\s*0\.6[0-9]\)/,
    description: 'V70: --panel-bg-glass uses dark glass (10,12,16 @ 0.6x alpha)',
  },
  {
    id: "V70-7",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /backdrop-filter:\s*blur\(var\(--panel-blur\)\)/,
    description: 'V70: Sheet uses backdrop-filter with glass blur',
  },
  {
    id: "V70-8",
    file: "src/assets/base.css",
    scope: "style",
    pattern: /--scrim-bg:\s*rgba\(0,\s*0,\s*0,\s*0\.6[0-9]\)/,
    description: 'V70: Scrim bg is >= 0.60 opacity',
  },
  {
    id: "V70-9",
    file: "src/components/ui/Sheet.vue",
    scope: "style",
    pattern: /\.sheet-container::before[\s\S]*?var\(--panel-highlight\)/,
    description: 'V70: Sheet has top highlight pseudo-element',
  },
];

// ─────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────

function runChecks(root: string, checks: Check[]): void {
  const verbose = process.argv.includes("--verbose");
  const failures: string[] = [];
  const passed: string[] = [];

  console.log("\n🔍 V55.5 UI Contract Check\n");
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
