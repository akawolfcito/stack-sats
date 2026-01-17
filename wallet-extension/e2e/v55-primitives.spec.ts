import { test, expect, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * V55.5 Primitives Unification E2E Tests
 *
 * Tests the V55 primitives migration:
 * 1. Send flow uses data-roi selectors for E2E targeting
 * 2. AccountSwitcher overlay uses ListRow and data-roi selectors
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
const RECEIVE_MODAL_FILE = "src/components/ReceiveModal.vue";

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

test.describe("V55.5 AccountSwitcher Overlay Guards", () => {
  /**
   * Static contract checks for AccountSwitcher V55 migration.
   */

  test("Guard 1: AccountSwitcher imports ListRow primitive", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, "import ListRow from"),
      "AccountSwitcher must import ListRow primitive"
    ).toBe(true);
  });

  test("Guard 2: AccountSwitcher uses ListRow component", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, "<ListRow"),
      "AccountSwitcher must use <ListRow> component"
    ).toBe(true);
  });

  test("Guard 3: AccountSwitcher has dropdown data-roi", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, 'data-roi="account-dropdown"'),
      "AccountSwitcher must have data-roi='account-dropdown'"
    ).toBe(true);
  });

  test("Guard 4: AccountSwitcher has list data-roi", () => {
    expect(
      sourceContains(ACCOUNT_SWITCHER_FILE, 'data-roi="account-list"'),
      "AccountSwitcher must have data-roi='account-list'"
    ).toBe(true);
  });
});

test.describe("V55.5 ReceiveModal Overlay Guards", () => {
  /**
   * Static contract checks for ReceiveModal data-roi attributes.
   */

  test("Guard 1: ReceiveModal has sheet data-roi", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, 'data-roi="receive-sheet"'),
      "ReceiveModal must have data-roi='receive-sheet'"
    ).toBe(true);
  });

  test("Guard 2: ReceiveModal has header data-roi", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, 'data-roi="receive-header"'),
      "ReceiveModal must have data-roi='receive-header'"
    ).toBe(true);
  });

  test("Guard 3: ReceiveModal has QR data-roi", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, 'data-roi="receive-qr"'),
      "ReceiveModal must have data-roi='receive-qr'"
    ).toBe(true);
  });

  test("Guard 4: ReceiveModal has CTA data-roi", () => {
    expect(
      sourceContains(RECEIVE_MODAL_FILE, 'data-roi="receive-cta"'),
      "ReceiveModal must have data-roi='receive-cta'"
    ).toBe(true);
  });
});
