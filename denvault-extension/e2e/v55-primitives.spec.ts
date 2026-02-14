import { test, expect, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * V55/V56 Primitives E2E Tests
 *
 * Tests the V55 primitives migration and V56 overlay cohesion:
 * 1. Send flow uses data-roi selectors for E2E targeting
 * 2. AccountSwitcher dropdown uses Sheet primitive + ListRow
 * 3. NetworkChip dropdown uses Sheet primitive + ListRow
 * 4. ReceiveModal uses Sheet + StickyCTA
 * 5. V56 Dropdown close behavior (primitive-level)
 *
 * Run with: pnpm test:e2e -- v55-primitives.spec.ts
 */

// Helper to read source file and check for token
function sourceContains(filePath: string, token: string): boolean {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  return content.includes(token);
}

// Helper to check for regex pattern in source file
function sourceMatches(filePath: string, pattern: RegExp): boolean {
  const fullPath = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) {
    return false;
  }
  const content = fs.readFileSync(fullPath, "utf-8");
  return pattern.test(content);
}

// Helper to check for horizontal overflow
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    return (
      html.scrollWidth > html.clientWidth || body.scrollWidth > body.clientWidth
    );
  });
}

const SEND_VIEW_FILE = "src/views/SendView.vue";
const ACCOUNT_SWITCHER_FILE = "src/components/account/AccountSwitcher.vue";
const NETWORK_CHIP_FILE = "src/components/network/NetworkChip.vue";
const RECEIVE_MODAL_FILE = "src/components/ReceiveModal.vue";
const IMPORT_RECOVERY_VIEW_FILE = "src/views/ImportRecoveryPhraseView.vue";
const SHEET_FILE = "src/components/ui/Sheet.vue";

test.describe("V55.5 Send Flow ROI Guards", () => {
  /**
   * Static contract checks for SendView data-roi attributes.
   */

  test("Guard 1: SendView has screen-level data-roi", () => {
    expect(
      sourceContains(SEND_VIEW_FILE, 'data-roi="send-screen"'),
      "SendView.vue must have data-roi='send-screen'"
    ).toBe(true);
  });

  test("Guard 2: SendView has title data-roi", () => {
    expect(
      sourceContains(SEND_VIEW_FILE, 'data-roi="send-title"'),
      "SendView.vue must have data-roi='send-title'"
    ).toBe(true);
  });

  test("Guard 3: SendView has form data-roi", () => {
    expect(
      sourceContains(SEND_VIEW_FILE, 'data-roi="send-form"'),
      "SendView.vue must have data-roi='send-form'"
    ).toBe(true);
  });

  test("Guard 4: SendView has CTA data-roi", () => {
    expect(
      sourceContains(SEND_VIEW_FILE, 'data-roi="send-cta"'),
      "SendView.vue must have data-roi='send-cta'"
    ).toBe(true);
  });
});

test.describe("V56 AccountSwitcher Dropdown Guards", () => {
  /**
   * Static contract checks for AccountSwitcher V56 migration.
   */

  test("Guard 1: AccountSwitcher imports ListRow primitive", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, "import ListRow from"),
      "AccountSwitcher must import ListRow primitive"
    ).toBe(true);
  });

  test("Guard 2: AccountSwitcher uses Sheet dropdown", () => {
    expect(
      sourceMatches(ACCOUNT_SWITCHER_FILE, /variant\s*=\s*["']dropdown["']/),
      "AccountSwitcher must use Sheet variant='dropdown'"
    ).toBe(true);
  });

  test("Guard 3: AccountSwitcher has sheet data-roi", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, 'data-roi="acctsw-sheet"'),
      "AccountSwitcher must have data-roi='acctsw-sheet'"
    ).toBe(true);
  });

  test("Guard 4: AccountSwitcher has list data-roi", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, 'data-roi="acctsw-list"'),
      "AccountSwitcher must have data-roi='acctsw-list'"
    ).toBe(true);
  });
});

test.describe("V56 NetworkChip Dropdown Guards", () => {
  /**
   * Static contract checks for NetworkChip V56 migration.
   */

  test("Guard 1: NetworkChip imports ListRow primitive", () => {
    expect(
      sourceContains(NETWORK_CHIP_FILE, "import ListRow from"),
      "NetworkChip must import ListRow primitive"
    ).toBe(true);
  });

  test("Guard 2: NetworkChip uses Sheet dropdown", () => {
    expect(
      sourceMatches(NETWORK_CHIP_FILE, /variant\s*=\s*["']dropdown["']/),
      "NetworkChip must use Sheet variant='dropdown'"
    ).toBe(true);
  });

  test("Guard 3: NetworkChip has sheet data-roi", () => {
    expect(
      sourceContains(NETWORK_CHIP_FILE, 'data-roi="network-sheet"'),
      "NetworkChip must have data-roi='network-sheet'"
    ).toBe(true);
  });

  test("Guard 4: NetworkChip has list data-roi", () => {
    expect(
      sourceContains(NETWORK_CHIP_FILE, 'data-roi="network-list"'),
      "NetworkChip must have data-roi='network-list'"
    ).toBe(true);
  });
});

test.describe("V56 ReceiveModal Overlay Guards", () => {
  /**
   * Static contract checks for ReceiveModal V56 DoD.
   */

  test("Guard 1: ReceiveModal has sheet data-roi", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, 'data-roi="receive-sheet"'),
      "ReceiveModal must have data-roi='receive-sheet'"
    ).toBe(true);
  });

  test("Guard 2: ReceiveModal uses StickyCTA", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, "<StickyCTA"),
      "ReceiveModal must use StickyCTA component"
    ).toBe(true);
  });

  test("Guard 3: ReceiveModal has QR data-roi", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, 'data-roi="receive-qr"'),
      "ReceiveModal must have data-roi='receive-qr'"
    ).toBe(true);
  });

  test("Guard 4: ReceiveModal has error-slot", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, 'data-roi="receive-error"'),
      "ReceiveModal must have data-roi='receive-error' (error slot)"
    ).toBe(true);
  });
});

test.describe("V56 Dropdown Close Behavior (Primitive-Level)", () => {
  /**
   * V56 Exit Criteria: Sheet dropdown must handle close at primitive level.
   * These guards verify the fix is in Sheet.vue, not per-component hacks.
   */

  test("Guard 1: Sheet.vue dropdown overlay has pointer-events: auto", () => {
    expect(
      sourceMatches(SHEET_FILE, /\.sheet-overlay--dropdown[\s\S]*?pointer-events:\s*auto/),
      "Sheet.vue dropdown overlay must have pointer-events: auto for outside-click"
    ).toBe(true);
  });

  test("Guard 2: Sheet.vue has overlay click handler", () => {
    expect(
      sourceContains(SHEET_FILE, "handleOverlayClick"),
      "Sheet.vue must have handleOverlayClick function"
    ).toBe(true);
  });

  test("Guard 3: Sheet.vue has ESC key handler", () => {
    expect(
      sourceContains(SHEET_FILE, "handleEscapeKey"),
      "Sheet.vue must have handleEscapeKey function"
    ).toBe(true);
  });

  test("Guard 4: AccountSwitcher has NO manual click-outside listener", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, "document.addEventListener"),
      "AccountSwitcher must NOT have manual document.addEventListener (primitive handles it)"
    ).toBe(false);
  });

  test("Guard 5: NetworkChip has NO manual click-outside listener", () => {
    expect(
      sourceContains(NETWORK_CHIP_FILE, "document.addEventListener"),
      "NetworkChip must NOT have manual document.addEventListener (primitive handles it)"
    ).toBe(false);
  });

  test("Guard 6: ImportRecoveryPhraseView has error-slot (V76)", () => {
    expect(
      sourceMatches(IMPORT_RECOVERY_VIEW_FILE, /\.error-slot[\s\S]*?min-height/),
      "ImportRecoveryPhraseView must have error-slot with min-height (anti-layout-shift)"
    ).toBe(true);
  });
});
