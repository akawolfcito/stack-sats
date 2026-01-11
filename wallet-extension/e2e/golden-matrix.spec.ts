/**
 * Golden Matrix Screenshots - Visual Regression Test Suite V26
 *
 * Captures screenshots of all critical screens across:
 * - 2 viewports: popup (400x600), sidepanel (360x800)
 * - 2 densities: compact, comfy
 *
 * Run with: pnpm ui:shots
 *
 * Output: docs/ui/golden/latest/{viewport}-{density}-{route}.png
 */
import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const GOLDEN_DIR = path.join(__dirname, '../docs/ui/golden');
const LATEST_DIR = path.join(GOLDEN_DIR, 'latest');

const VIEWPORTS = [
  { name: 'popup', width: 400, height: 600 },
  { name: 'sidepanel', width: 360, height: 800 },
] as const;

const DENSITIES = ['compact', 'comfy'] as const;

const ROUTES = [
  { path: '/', name: 'start', setup: clearWallet },
  { path: '/unlock', name: 'unlock' },
  { path: '/user', name: 'user' },
  { path: '/send', name: 'send' },
  { path: '/usermenu', name: 'usermenu' },
] as const;

// Helper: Clear wallet state for clean start screen
async function clearWallet(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
}

// Helper: Set density mode
async function setDensityMode(page: Page, mode: 'compact' | 'comfy') {
  await page.evaluate((m) => {
    localStorage.setItem('density_mode', m);
    document.documentElement.dataset.density = m;
  }, mode);
  await page.waitForTimeout(100);
}

// Helper: Wait for stable state
async function waitForStableState(page: Page) {
  await page.waitForFunction(() => {
    const spinners = document.querySelectorAll('.spinner, .animate-spin, [class*="loading"]');
    return spinners.length === 0 || Array.from(spinners).every(el => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' || style.visibility === 'hidden';
    });
  }, { timeout: 5000 }).catch(() => {});

  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
}

// Helper: Capture screenshot
async function captureScreen(page: Page, filename: string) {
  await waitForStableState(page);
  const screenshotPath = path.join(LATEST_DIR, `${filename}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`  Captured: ${filename}.png`);
}

// Ensure output directory exists
test.beforeAll(async () => {
  if (fs.existsSync(LATEST_DIR)) {
    // Clear previous screenshots
    const files = fs.readdirSync(LATEST_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => fs.unlinkSync(path.join(LATEST_DIR, f)));
  } else {
    fs.mkdirSync(LATEST_DIR, { recursive: true });
  }
});

// Disable animations
test.use({
  reducedMotion: 'reduce',
});

// Generate matrix of tests: viewport x density x route
for (const viewport of VIEWPORTS) {
  test.describe(`Viewport: ${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({
      viewport: { width: viewport.width, height: viewport.height },
    });

    for (const density of DENSITIES) {
      test.describe(`Density: ${density}`, () => {
        for (const route of ROUTES) {
          test(`${route.name}`, async ({ page }) => {
            // Navigate first
            await page.goto(route.path);

            // Run setup if defined
            if (route.setup) {
              await route.setup(page);
            }

            // Set density
            await setDensityMode(page, density);

            // Capture screenshot with naming: viewport-density-route.png
            const filename = `${viewport.name}-${density}-${route.name}`;
            await captureScreen(page, filename);
          });
        }
      });
    }
  });
}

// Summary
test.afterAll(async () => {
  console.log('\n========================================');
  console.log('Golden Matrix Screenshots captured to:');
  console.log(`  ${LATEST_DIR}`);
  console.log('========================================\n');

  const files = fs.readdirSync(LATEST_DIR).filter(f => f.endsWith('.png'));
  console.log(`Total screenshots: ${files.length}`);
  console.log(`Expected: ${VIEWPORTS.length * DENSITIES.length * ROUTES.length}`);
  console.log('\nFiles:');
  files.sort().forEach(f => console.log(`  - ${f}`));
});
