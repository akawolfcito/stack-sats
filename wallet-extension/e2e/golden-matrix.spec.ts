/**
 * Golden Matrix Screenshots - Visual Regression Test Suite V30
 *
 * Captures screenshots of all critical screens across:
 * - 2 viewports: popup (400x600), sidepanel (360x800)
 * - 2 densities: compact, comfy
 *
 * V30 FIX: Injects mock wallet state for protected routes (/user, /send, /usermenu)
 * so screenshots capture real Home content, not redirect/loading screens.
 *
 * Run with: pnpm ui:shots
 *
 * Output: docs/ui/golden/latest/{viewport}-{density}-{route}.png
 */
import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TEST_MNEMONIC } from './fixtures/mock-wallet.js';

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

// Routes that require wallet auth
const PROTECTED_ROUTES = ['/user', '/send', '/usermenu'];

// V35: Routes now include receive-modal which opens modal programmatically
interface RouteConfig {
  path: string;
  name: string;
  setup: (page: Page) => Promise<void>;
  afterNav?: (page: Page) => Promise<void>;
}

const ROUTES: RouteConfig[] = [
  { path: '/', name: 'start', setup: clearWallet },
  { path: '/unlock', name: 'unlock', setup: setupLockedWallet },
  { path: '/user', name: 'user', setup: setupUnlockedWallet },
  { path: '/send', name: 'send', setup: setupUnlockedWallet },
  { path: '/usermenu', name: 'usermenu', setup: setupUnlockedWallet },
  // V35: ReceiveModal - opens modal via snapshot hook after navigating to /user
  { path: '/user', name: 'receive-modal', setup: setupUnlockedWallet, afterNav: openReceiveModal },
];

// Helper: Clear wallet state for clean start screen
async function clearWallet(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  // No reload - navigation happens after setup
}

// Helper: Setup wallet in locked state (for unlock screen)
async function setupLockedWallet(page: Page) {
  await page.evaluate(() => {
    // Clear first
    localStorage.clear();
    sessionStorage.clear();

    // Set up mock vault state (wallet exists but locked)
    const mockVault = {
      entries: [{
        id: 'vault_snapshot_locked',
        name: 'Test Wallet',
        encryptedData: { ciphertext: 'mock', iv: 'mock', salt: 'mock' },
        createdAt: Date.now(),
        version: 1,
      }],
      activeId: 'vault_snapshot_locked',
      version: 1,
    };
    localStorage.setItem('wallet_vault', JSON.stringify(mockVault));

    // Do NOT set snapshot mode - we want the locked screen
  });
  // No reload - navigation happens after setup
}

// Helper: Setup wallet in unlocked state (for protected routes)
async function setupUnlockedWallet(page: Page) {
  await page.evaluate((mnemonic) => {
    // Clear first
    localStorage.clear();
    sessionStorage.clear();

    // Enable snapshot mode with test mnemonic
    localStorage.setItem('__UI_SNAPSHOT_MODE__', 'true');
    localStorage.setItem('__UI_SNAPSHOT_MNEMONIC__', mnemonic);

    // Also set density and network for consistent screenshots
    localStorage.setItem('selected_network', 'devnet');
  }, TEST_MNEMONIC);
  // No reload - navigation happens after setup
}

// V35: Helper to open ReceiveModal via snapshot hook
async function openReceiveModal(page: Page) {
  await page.waitForTimeout(500); // Wait for Vue component to mount and expose hook
  await page.evaluate(() => {
    const hook = (window as any).__UI_SNAPSHOT__;
    if (hook?.openReceiveModal) {
      hook.openReceiveModal();
    } else {
      console.warn('Snapshot hook not available for ReceiveModal');
    }
  });
  await page.waitForTimeout(300); // Wait for modal animation
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
            // V30: Setup state BEFORE app initialization
            // The key is to set localStorage and reload so sessionManager picks it up

            // Step 1: Go to blank page to initialize browser context
            await page.goto('about:blank');

            // Step 2: Navigate to app base to get localStorage access
            await page.goto('/');

            // Step 3: Run setup to inject localStorage state
            if (route.setup) {
              await route.setup(page);
            }

            // Step 4: Set density mode in localStorage
            await page.evaluate((m) => {
              localStorage.setItem('density_mode', m);
            }, density);

            // Step 5: Reload page to pick up new localStorage state
            await page.reload();

            // Step 6: Navigate to target route (if not root)
            if (route.path !== '/') {
              await page.goto(route.path);
            }

            // Step 7: Apply density class to document
            await page.evaluate((m) => {
              document.documentElement.dataset.density = m;
            }, density);

            // Step 8: Run afterNav hook if defined (V35: for modals)
            if (route.afterNav) {
              await route.afterNav(page);
            }

            // Step 9: Wait and capture screenshot
            await page.waitForTimeout(500); // Allow Vue to fully initialize
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
