/**
 * Golden Screenshots - Visual Regression Test Suite
 *
 * Captures screenshots of all critical screens for A/B comparison.
 * Run with: pnpm ui:snapshots
 *
 * Environment: VITE_UI_SNAPSHOT=1 enables deterministic mode
 */
import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Output directories
const GOLDEN_DIR = path.join(__dirname, '../docs/ui/golden');
const CURRENT_DIR = path.join(GOLDEN_DIR, 'CURRENT');

// Ensure output directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(CURRENT_DIR)) {
    fs.mkdirSync(CURRENT_DIR, { recursive: true });
  }
});

// Configure viewport and disable animations
test.use({
  viewport: { width: 400, height: 600 },
  // Reduce motion to eliminate animation flakiness
  reducedMotion: 'reduce',
});

/**
 * Helper to wait for stable state (no spinners, loaded content)
 */
async function waitForStableState(page: Page) {
  // Wait for no spinners
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('.spinner, .animate-spin, [class*="loading"]');
    return spinners.length === 0 || Array.from(spinners).every(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden';
    });
  }, { timeout: 5000 }).catch(() => {});

  // Wait for network idle
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});

  // Small delay for any CSS transitions
  await page.waitForTimeout(300);
}

/**
 * Capture and save screenshot
 */
async function captureScreen(page: Page, name: string) {
  await waitForStableState(page);
  const screenshotPath = path.join(CURRENT_DIR, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`  Captured: ${name}.png`);
}

// ====================
// TIER 1: Core User Flows
// ====================

test.describe('Tier 1: Core User Flows', () => {
  test('01-start - Welcome screen (no wallet)', async ({ page }) => {
    // Clear any existing wallet state for clean start screen
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    await page.reload();
    await page.waitForSelector('.start-page, [class*="start"], [class*="welcome"]', { timeout: 5000 }).catch(() => {});
    await captureScreen(page, '01-start');
  });

  test('02-unlock - PIN unlock screen', async ({ page }) => {
    // This requires a wallet to exist - we'll capture whatever state we can
    await page.goto('/unlock');
    await page.waitForTimeout(500);
    await captureScreen(page, '02-unlock');
  });

  test('03-home - Home (Assets tab)', async ({ page }) => {
    await page.goto('/user');
    await page.waitForTimeout(500);
    // Click Assets tab if tabs exist
    const assetsTab = page.locator('button:has-text("Assets"), [role="tab"]:has-text("Assets")');
    if (await assetsTab.isVisible().catch(() => false)) {
      await assetsTab.click();
      await page.waitForTimeout(300);
    }
    await captureScreen(page, '03-home');
  });

  test('04-home-activity - Home (Activity tab)', async ({ page }) => {
    await page.goto('/user');
    await page.waitForTimeout(500);
    // Click Activity tab if tabs exist
    const activityTab = page.locator('button:has-text("Activity"), [role="tab"]:has-text("Activity")');
    if (await activityTab.isVisible().catch(() => false)) {
      await activityTab.click();
      await page.waitForTimeout(300);
    }
    await captureScreen(page, '04-home-activity');
  });

  test('05-settings - Settings/UserMenu', async ({ page }) => {
    await page.goto('/usermenu');
    await page.waitForTimeout(500);
    await captureScreen(page, '05-settings');
  });
});

// ====================
// TIER 2: Transaction Flows
// ====================

test.describe('Tier 2: Transaction Flows', () => {
  test('06-send - Send STX (empty form)', async ({ page }) => {
    await page.goto('/send');
    await page.waitForTimeout(500);
    await captureScreen(page, '06-send');
  });

  test('07-send-filled - Send STX (filled form)', async ({ page }) => {
    await page.goto('/send');
    await page.waitForTimeout(500);

    // Fill form with test data if inputs exist
    const recipientInput = page.locator('input[placeholder*="address"], input[name="recipient"], input#recipient');
    const amountInput = page.locator('input[type="number"], input[placeholder*="0.00"], input[name="amount"]');

    if (await recipientInput.isVisible().catch(() => false)) {
      await recipientInput.fill('ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG');
    }
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.fill('10.5');
    }
    await page.waitForTimeout(300);
    await captureScreen(page, '07-send-filled');
  });

  test('08-receive - Receive Modal', async ({ page }) => {
    await page.goto('/user');
    await page.waitForTimeout(500);

    // Try to open receive modal
    const receiveBtn = page.locator('button:has-text("Receive"), [aria-label*="receive"]');
    if (await receiveBtn.isVisible().catch(() => false)) {
      await receiveBtn.click();
      await page.waitForTimeout(500);
    }
    await captureScreen(page, '08-receive');
  });
});

// ====================
// TIER 3: Management Screens
// ====================

test.describe('Tier 3: Management', () => {
  test('10-account-details - Account Details', async ({ page }) => {
    await page.goto('/account/0');
    await page.waitForTimeout(500);
    await captureScreen(page, '10-account-details');
  });

  test('11-manage-tokens - Manage Tokens', async ({ page }) => {
    await page.goto('/manage-tokens');
    await page.waitForTimeout(500);
    await captureScreen(page, '11-manage-tokens');
  });

  test('12-add-token - Add Token', async ({ page }) => {
    await page.goto('/add-token');
    await page.waitForTimeout(500);
    await captureScreen(page, '12-add-token');
  });
});

// ====================
// Summary
// ====================

test.afterAll(async () => {
  console.log('\n========================================');
  console.log('Golden Screenshots captured to:');
  console.log(`  ${CURRENT_DIR}`);
  console.log('========================================\n');

  // List captured files
  const files = fs.readdirSync(CURRENT_DIR).filter(f => f.endsWith('.png'));
  console.log(`Captured ${files.length} screenshots:`);
  files.forEach(f => console.log(`  - ${f}`));
});
