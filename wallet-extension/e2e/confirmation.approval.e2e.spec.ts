import { test, expect, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Confirmation Approval E2E Tests - V55.2 Shell Migration
 *
 * Confirmation.vue is rendered conditionally based on RPC messages from dApps,
 * not via route navigation. Therefore, we use a static contract check approach
 * to validate the component structure.
 *
 * Guards validate:
 * - ScreenShell wrapper with data-roi="confirm-screen"
 * - AppHeader with left="close" and data-roi="confirm-title"
 * - StickyCTA with Approve/Deny buttons
 * - Origin badge with data-roi="confirm-origin"
 * - Error slot with min-height: 24px (anti-layout-shift)
 *
 * Run with: pnpm test:e2e -- confirmation.approval.e2e.spec.ts
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

const CONFIRMATION_FILE = "src/components/Confirmation.vue";

test.describe("V55.2 Confirmation Static Contract Guards", () => {
  /**
   * Static contract checks validate source file contains required patterns.
   * This is the honest approach when a component cannot be rendered via route.
   */

  test("Guard 1: Confirmation uses ScreenShell wrapper", () => {
    expect(
      sourceContains(CONFIRMATION_FILE, "<ScreenShell"),
      "Confirmation.vue must use <ScreenShell"
    ).toBe(true);
    expect(
      sourceContains(CONFIRMATION_FILE, 'data-roi="confirm-screen"'),
      "Confirmation.vue must have data-roi='confirm-screen'"
    ).toBe(true);
  });

  test("Guard 2: Confirmation uses AppHeader with close button", () => {
    expect(
      sourceContains(CONFIRMATION_FILE, "<AppHeader"),
      "Confirmation.vue must use <AppHeader"
    ).toBe(true);
    expect(
      sourceContains(CONFIRMATION_FILE, 'left="close"'),
      "AppHeader must have left='close'"
    ).toBe(true);
    expect(
      sourceContains(CONFIRMATION_FILE, 'data-roi="confirm-title"'),
      "AppHeader must have data-roi='confirm-title'"
    ).toBe(true);
  });

  test("Guard 3: Confirmation uses StickyCTA for footer", () => {
    expect(
      sourceContains(CONFIRMATION_FILE, "<StickyCTA"),
      "Confirmation.vue must use <StickyCTA"
    ).toBe(true);
    expect(
      sourceContains(CONFIRMATION_FILE, 'primary-text="Approve"'),
      "StickyCTA must have primary-text='Approve'"
    ).toBe(true);
    expect(
      sourceContains(CONFIRMATION_FILE, 'secondary-text="Deny"'),
      "StickyCTA must have secondary-text='Deny'"
    ).toBe(true);
  });

  test("Guard 4: Confirmation has origin badge", () => {
    expect(
      sourceContains(CONFIRMATION_FILE, 'data-roi="confirm-origin"'),
      "Confirmation.vue must have data-roi='confirm-origin'"
    ).toBe(true);
  });

  test("Guard 5: Confirmation has error slot with reserved height", () => {
    expect(
      sourceContains(CONFIRMATION_FILE, 'data-roi="confirm-error-slot"'),
      "Confirmation.vue must have data-roi='confirm-error-slot'"
    ).toBe(true);
    expect(
      sourceContains(CONFIRMATION_FILE, "min-height: 24px"),
      "Error slot must have min-height: 24px for anti-layout-shift"
    ).toBe(true);
  });

  test("Guard 6: AppHeader supports close option", () => {
    const headerFile = "src/components/layout/AppHeader.vue";
    expect(
      sourceContains(headerFile, '"close"'),
      "AppHeader.vue must include 'close' in left prop type"
    ).toBe(true);
    expect(
      sourceContains(headerFile, 'v-else-if="left === \'close\'"'),
      "AppHeader.vue must handle close icon rendering"
    ).toBe(true);
  });
});

test.describe("V55.2 Confirmation Integration Smoke", () => {
  /**
   * These tests verify that the app loads without errors
   * and that our shell components don't break the base application.
   */

  test("App loads without horizontal overflow", async ({ page }) => {
    // Clear state and go to start
    await page.goto("/#/start");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for any content to load (start page or redirect)
    await page.waitForLoadState("domcontentloaded");

    const hasOverflow = await hasHorizontalOverflow(page);
    expect(hasOverflow, "Page should not have horizontal overflow").toBe(false);
  });
});
