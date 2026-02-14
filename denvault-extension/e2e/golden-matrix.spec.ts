/**
 * Golden Matrix Screenshots - Visual Regression Test Suite V38
 *
 * Captures screenshots of all critical screens across:
 * - 2 viewports: popup (400x600), sidepanel (360x800)
 * - 2 densities: compact, comfy
 * - 6 routes: start, unlock, user, send, usermenu, receive-modal
 *
 * Total: 2 × 2 × 6 = 24 screenshots
 *
 * V38: Screenshots now write to artifacts/ui/current/ (never auto-overwrite golden)
 * Use pnpm ui:accept to promote current → golden after review.
 *
 * Run with: pnpm ui:shots
 *
 * Output: artifacts/ui/current/{viewport}-{density}-{route}.png
 */
import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TEST_MNEMONIC } from './fixtures/mock-wallet.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// V38: Configuration - current screenshots go to artifacts/, golden stays versioned
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/ui');
const CURRENT_DIR = path.join(ARTIFACTS_DIR, 'current');
const EXPECTED_COUNT = 32; // 2 viewports × 2 densities × 8 routes (V57: +2 dropdown routes)

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
  // V57: Dropdown snapshots - opens dropdowns via snapshot hooks
  { path: '/user', name: 'acct-switcher-open', setup: setupUnlockedWallet, afterNav: openAccountSwitcher },
  { path: '/user', name: 'network-chip-open', setup: setupUnlockedWallet, afterNav: openNetworkChip },
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

// V57: Helper to open AccountSwitcher dropdown via snapshot hook
async function openAccountSwitcher(page: Page) {
  await page.waitForTimeout(500); // Wait for Vue component to mount and expose hook
  await page.evaluate(() => {
    const hook = (window as any).__UI_SNAPSHOT__;
    if (hook?.openAccountSwitcher) {
      hook.openAccountSwitcher();
    } else {
      console.warn('Snapshot hook not available for AccountSwitcher');
    }
  });
  await page.waitForTimeout(300); // Wait for dropdown animation
}

// V57: Helper to open NetworkChip dropdown via snapshot hook
async function openNetworkChip(page: Page) {
  await page.waitForTimeout(500); // Wait for Vue component to mount and expose hook
  await page.evaluate(() => {
    const hook = (window as any).__UI_SNAPSHOT__;
    if (hook?.openNetworkChip) {
      hook.openNetworkChip();
    } else {
      console.warn('Snapshot hook not available for NetworkChip');
    }
  });
  await page.waitForTimeout(300); // Wait for dropdown animation
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
  const screenshotPath = path.join(CURRENT_DIR, `${filename}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`  Captured: ${filename}.png`);
}

// Ensure output directory exists
test.beforeAll(async () => {
  if (fs.existsSync(CURRENT_DIR)) {
    // Clear previous screenshots
    const files = fs.readdirSync(CURRENT_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => fs.unlinkSync(path.join(CURRENT_DIR, f)));
  } else {
    fs.mkdirSync(CURRENT_DIR, { recursive: true });
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

// V38: Summary with count validation
test.afterAll(async () => {
  console.log('\n========================================');
  console.log('Golden Matrix Screenshots - V38');
  console.log('========================================');
  console.log(`Output: ${CURRENT_DIR}`);

  const files = fs.existsSync(CURRENT_DIR)
    ? fs.readdirSync(CURRENT_DIR).filter(f => f.endsWith('.png'))
    : [];
  const actual = files.length;
  const expected = EXPECTED_COUNT;

  console.log(`\nCount: ${actual}/${expected}`);

  if (actual === expected) {
    console.log('Status: ✓ COMPLETE');
  } else {
    console.log(`Status: ✗ INCOMPLETE (missing ${expected - actual})`);
  }

  console.log('\nFiles:');
  files.sort().forEach(f => console.log(`  - ${f}`));
  console.log('========================================\n');

  // V38: Write count file for ui:guard validation
  const countFile = path.join(ARTIFACTS_DIR, 'current-count.json');
  fs.writeFileSync(countFile, JSON.stringify({ actual, expected, complete: actual === expected }, null, 2));

  // V57: Verify dropdown-open screenshots exist (regression guard)
  const V57_DROPDOWN_FILES = [
    'popup-comfy-acct-switcher-open.png',
    'popup-comfy-network-chip-open.png',
    'popup-compact-acct-switcher-open.png',
    'popup-compact-network-chip-open.png',
    'sidepanel-comfy-acct-switcher-open.png',
    'sidepanel-comfy-network-chip-open.png',
    'sidepanel-compact-acct-switcher-open.png',
    'sidepanel-compact-network-chip-open.png',
  ];

  const missingDropdowns = V57_DROPDOWN_FILES.filter(f => !files.includes(f));
  if (missingDropdowns.length > 0) {
    console.log('\n⚠️  V57 WARNING: Missing dropdown screenshots:');
    missingDropdowns.forEach(f => console.log(`  - ${f}`));
    console.log('Run may have failed to open dropdowns via snapshot hooks.\n');
  } else {
    console.log('\n✅ V57: All 8 dropdown-open screenshots present\n');
  }
});
