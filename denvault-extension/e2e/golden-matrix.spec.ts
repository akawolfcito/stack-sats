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

/**
 * Open an overlay through the snapshot hook the app exposes.
 *
 * These used to sleep 500ms and hope the hook had appeared, then warn to a
 * console nobody reads when it had not, and carry on to photograph whatever
 * was on screen. Under parallel load that produced entirely black frames,
 * saved as golden, and counted as passes: the run reported "all 8 dropdown
 * screenshots present" because present only meant the file existed.
 *
 * Waiting for the hook itself removes the guess, and a missing hook now
 * fails the test instead of quietly capturing nothing.
 */
async function openViaSnapshotHook(page: Page, name: string) {
  // The hook only exists once the app has mounted, so waiting for it is
  // also the proof that there is something on screen to photograph.
  await page.waitForFunction(
    (hookName) => Boolean((window as any).__UI_SNAPSHOT__?.[hookName]),
    name,
    { timeout: 15_000 }
  );

  // The hook is installed at mount, but the accounts are derived after it,
  // and until they land the entire home body is a "Loading accounts..."
  // placeholder: the balance, the switcher and the chip live behind a
  // v-else that has not rendered yet. Opening a dropdown over that
  // photographed the placeholder, or an empty frame when even that had not
  // painted, and the v-else swapping in afterwards is what closed an
  // overlay that had already opened. Between runs three to eight of these
  // frames came back blank on that race.
  //
  // So wait for the thing that has to be behind the dropdown, rather than
  // for half a second and a hope.
  await page.waitForSelector('[data-roi="home-balance-card"]', {
    state: 'visible',
    timeout: 15_000,
  });

  await page.evaluate((hookName) => {
    (window as any).__UI_SNAPSHOT__[hookName]();
  }, name);

  await page.waitForTimeout(300); // Overlay animation
}

// V35: Helper to open ReceiveModal via snapshot hook
async function openReceiveModal(page: Page) {
  await openViaSnapshotHook(page, 'openReceiveModal');
}

// V57: Helper to open AccountSwitcher dropdown via snapshot hook
async function openAccountSwitcher(page: Page) {
  await openViaSnapshotHook(page, 'openAccountSwitcher');
}

// V57: Helper to open NetworkChip dropdown via snapshot hook
async function openNetworkChip(page: Page) {
  await openViaSnapshotHook(page, 'openNetworkChip');
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

/** Every filename this matrix is going to write, one per test. */
const EXPECTED_FILES = new Set(
  VIEWPORTS.flatMap(viewport =>
    DENSITIES.flatMap(density =>
      ROUTES.map(route => `${viewport.name}-${density}-${route.name}.png`)
    )
  )
);

/**
 * Ensure the output directory exists, without wiping it.
 *
 * beforeAll runs once per worker, not once per run, and this suite is
 * fullyParallel. So four workers each cleared this directory while the
 * others were writing into it: screenshots vanished after being taken,
 * which is the "between runs three to eight captures go missing" that had
 * gone unexplained, and two workers racing the same unlink killed one
 * outright with ENOENT, which is why a run would stop at 24 of 32 with
 * seven tests never started.
 *
 * Nothing has to be cleared for correctness: each test overwrites its own
 * file by name. Only names that no state claims any more are worth
 * removing, and that is done tolerantly, because another worker may have
 * removed the same one first.
 */
test.beforeAll(async () => {
  fs.mkdirSync(CURRENT_DIR, { recursive: true });

  for (const file of fs.readdirSync(CURRENT_DIR).filter(f => f.endsWith('.png'))) {
    if (EXPECTED_FILES.has(file)) continue;
    try {
      fs.unlinkSync(path.join(CURRENT_DIR, file));
    } catch {
      // Already gone: another worker got to it first.
    }
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
            //
            // Through the hash, because the router is createWebHashHistory
            // (src/router/index.ts). Navigating to "/send" left the hash
            // empty, so the app started at "/" and landed on /user, and the
            // suite has been photographing the home screen under three
            // different names: send and usermenu were both just /user.
            //
            // start and unlock only looked right by accident: their storage
            // state makes the app land there on its own. The overlays are
            // captured by afterNav hooks on /user, so they were fine.
            if (route.path !== '/') {
              await page.goto(`/#${route.path}`);
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
