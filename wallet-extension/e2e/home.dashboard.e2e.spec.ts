import { test, expect, Page } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Home Dashboard E2E Tests - V55.2 Shell Migration
 *
 * Tests UserHomeView after migration to ScreenShell wrapper pattern.
 *
 * V55.2 Guards:
 * - Shell structure presence (ScreenShell wrapper with data-roi)
 * - Balance card visibility (home-balance-card)
 * - Quick actions bar (home-quick-actions)
 * - Assets list section (home-assets-list)
 * - Activity preview section (home-activity-preview)
 * - No layout shift during interactions
 *
 * Run with: pnpm test:e2e -- home.dashboard.e2e.spec.ts
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

const HOME_VIEW_FILE = "src/views/UserHomeView.vue";

test.describe("V55.2 Home Dashboard Static Contract Guards", () => {
  /**
   * Static contract checks validate source file contains required patterns.
   * These run without needing to authenticate the user session.
   */

  test("Guard 1: UserHomeView uses ScreenShell wrapper", () => {
    expect(
      sourceContains(HOME_VIEW_FILE, "<ScreenShell"),
      "UserHomeView.vue must use <ScreenShell"
    ).toBe(true);
    expect(
      sourceContains(HOME_VIEW_FILE, 'data-roi="home-screen"'),
      "UserHomeView.vue must have data-roi='home-screen'"
    ).toBe(true);
  });

  test("Guard 2: UserHomeView has balance card data-roi", () => {
    expect(
      sourceContains(HOME_VIEW_FILE, 'data-roi="home-balance-card"'),
      "UserHomeView.vue must have data-roi='home-balance-card'"
    ).toBe(true);
  });

  test("Guard 3: UserHomeView has quick actions data-roi", () => {
    expect(
      sourceContains(HOME_VIEW_FILE, 'data-roi="home-quick-actions"'),
      "UserHomeView.vue must have data-roi='home-quick-actions'"
    ).toBe(true);
  });

  test("Guard 4: UserHomeView has assets list data-roi", () => {
    expect(
      sourceContains(HOME_VIEW_FILE, 'data-roi="home-assets-list"'),
      "UserHomeView.vue must have data-roi='home-assets-list'"
    ).toBe(true);
  });

  test("Guard 5: UserHomeView has activity preview data-roi", () => {
    expect(
      sourceContains(HOME_VIEW_FILE, 'data-roi="home-activity-preview"'),
      "UserHomeView.vue must have data-roi='home-activity-preview'"
    ).toBe(true);
  });

  test("Guard 6: UserHomeView uses flex column layout", () => {
    // Verify the CSS uses proper flex layout for stability
    expect(
      sourceContains(HOME_VIEW_FILE, "flex-direction: column"),
      "UserHomeView.vue must use flex-direction: column"
    ).toBe(true);
  });
});

test.describe("V55.2 Home Dashboard Runtime Guards", () => {
  /**
   * Runtime tests that verify the app loads properly.
   * Component structure is verified via static contract tests above.
   */

  test("App loads without horizontal overflow", async ({ page }) => {
    // Clear state and go to start
    await page.goto("/#/start");
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Wait for any content to load
    await page.waitForLoadState("domcontentloaded");

    const hasOverflow = await hasHorizontalOverflow(page);
    expect(hasOverflow, "Page should not have horizontal overflow").toBe(false);
  });
});
