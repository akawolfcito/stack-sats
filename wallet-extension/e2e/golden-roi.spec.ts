/**
 * Golden ROI Screenshots - Component-Level Visual Regression V41
 *
 * Captures Region of Interest (ROI) screenshots for premium components:
 * - ActionBar (Send/Receive buttons)
 * - Primary CTA (Create New Wallet, Send button)
 * - Tabs indicator (SegmentedTabs thumb)
 * - Balance header
 * - Fullpage icon button
 *
 * These ROI captures use a stricter diff threshold (0.5%) to detect
 * subtle changes like V41 color token updates that don't register
 * on full-frame diffs with 5% threshold.
 *
 * Run with: pnpm ui:roi
 *
 * Output: artifacts/ui/current/roi/{component}-{context}.png
 */
import { test, Page, Locator } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TEST_MNEMONIC } from './fixtures/mock-wallet.js';

// ESM-compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const ARTIFACTS_DIR = path.join(__dirname, '../artifacts/ui');
const ROI_CURRENT_DIR = path.join(ARTIFACTS_DIR, 'current/roi');
const STYLE_PROBE_PATH = path.join(ARTIFACTS_DIR, 'style-probe.json');

// ROI definitions
interface ROIConfig {
  name: string;
  route: string;
  selector: string;
  setup: (page: Page) => Promise<void>;
  afterNav?: (page: Page) => Promise<void>;
  captureStyles?: string[]; // CSS properties to probe
}

const ROI_TARGETS: ROIConfig[] = [
  // Primary CTA on Start screen
  {
    name: 'primary-cta-start',
    route: '/',
    selector: 'button.btn--primary, .btn-primary, button:has-text("Create New Wallet")',
    setup: clearWallet,
    captureStyles: ['background-color', 'box-shadow', 'border-color', 'color'],
  },
  // ActionBar on User home
  {
    name: 'actionbar-user',
    route: '/user',
    selector: '.action-bar',
    setup: setupUnlockedWallet,
    captureStyles: ['background-color'],
  },
  // Send button specifically
  {
    name: 'primary-cta-send',
    route: '/user',
    selector: '.action-bar button.btn--primary, .action-bar button:has-text("Send")',
    setup: setupUnlockedWallet,
    captureStyles: ['background-color', 'box-shadow', 'border-color'],
  },
  // Balance header
  {
    name: 'balance-header',
    route: '/user',
    selector: '.balance-header, [class*="balance"]',
    setup: setupUnlockedWallet,
  },
  // Fullpage icon button
  {
    name: 'fullpage-icon',
    route: '/user',
    selector: 'button[class*="icon"]:has(svg), .btn--icon',
    setup: setupUnlockedWallet,
  },
  // Segmented tabs (uses .minimal-tabs class)
  {
    name: 'segmented-tabs',
    route: '/user',
    selector: '.minimal-tabs, .tab-item',
    setup: setupUnlockedWallet,
  },
  // Secondary button on Start
  {
    name: 'secondary-cta-start',
    route: '/',
    selector: 'button.btn--secondary, button:has-text("Import")',
    setup: clearWallet,
    captureStyles: ['background-color', 'border-color', 'color'],
  },
  // V46: PIN keypad on Unlock screen
  {
    name: 'pin-keypad-unlock-compact',
    route: '/unlock',
    selector: '.keypad',
    setup: setupLockedWallet,
  },
  // V46: PIN icons row (biometric + backspace)
  {
    name: 'pin-icons-row-compact',
    route: '/unlock',
    selector: '.keypad-btn--action svg',
    setup: setupLockedWallet,
  },
  // V48: Verify PIN fullscreen - header area (logo + title)
  {
    name: 'verify-pin-header',
    route: '/verify-pin?action=backup&returnTo=/usermenu',
    selector: '.verify-header',
    setup: setupLockedWallet,
  },
  // V48: Verify PIN fullscreen - keypad
  {
    name: 'verify-pin-keypad',
    route: '/verify-pin?action=backup&returnTo=/usermenu',
    selector: '.keypad',
    setup: setupLockedWallet,
  },
];

// Expected ROI count - only counting targets that can be reliably captured
// inline-action-max removed as it requires specific send flow context
// V46: Added pin-keypad-unlock-compact, pin-icons-row-compact
// V48: Added verify-pin-header, verify-pin-keypad
const EXPECTED_ROI_COUNT = 11;

// Helper: Clear wallet state
async function clearWallet(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

// Helper: Setup unlocked wallet
async function setupUnlockedWallet(page: Page) {
  await page.evaluate((mnemonic) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('__UI_SNAPSHOT_MODE__', 'true');
    localStorage.setItem('__UI_SNAPSHOT_MNEMONIC__', mnemonic);
    localStorage.setItem('selected_network', 'devnet');
    localStorage.setItem('density_mode', 'compact');
  }, TEST_MNEMONIC);
}

// V46: Helper: Setup locked wallet (has wallet but not unlocked)
async function setupLockedWallet(page: Page) {
  await page.evaluate((mnemonic) => {
    localStorage.clear();
    sessionStorage.clear();
    // Set wallet_encrypted to simulate existing wallet
    localStorage.setItem('__UI_SNAPSHOT_MODE__', 'true');
    localStorage.setItem('__UI_SNAPSHOT_MNEMONIC__', mnemonic);
    localStorage.setItem('__UI_SNAPSHOT_LOCKED__', 'true');
    localStorage.setItem('selected_network', 'devnet');
    localStorage.setItem('density_mode', 'compact');
  }, TEST_MNEMONIC);
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

// Helper: Capture ROI screenshot
async function captureROI(page: Page, roi: ROIConfig): Promise<{ success: boolean; styles?: Record<string, string> }> {
  await waitForStableState(page);

  // Try multiple selectors if needed
  const selectors = roi.selector.split(',').map(s => s.trim());
  let element: Locator | null = null;

  for (const selector of selectors) {
    const loc = page.locator(selector).first();
    if (await loc.isVisible({ timeout: 2000 }).catch(() => false)) {
      element = loc;
      break;
    }
  }

  if (!element) {
    console.log(`  ⚠ ROI not found: ${roi.name} (tried: ${roi.selector})`);
    return { success: false };
  }

  // Capture screenshot
  const screenshotPath = path.join(ROI_CURRENT_DIR, `${roi.name}.png`);
  await element.screenshot({ path: screenshotPath });
  console.log(`  ✓ Captured: ${roi.name}.png`);

  // Capture computed styles if requested
  let styles: Record<string, string> | undefined;
  if (roi.captureStyles && roi.captureStyles.length > 0) {
    styles = await element.evaluate((el, props) => {
      const computed = window.getComputedStyle(el);
      const result: Record<string, string> = {};
      for (const prop of props) {
        result[prop] = computed.getPropertyValue(prop);
      }
      return result;
    }, roi.captureStyles);
  }

  return { success: true, styles };
}

// Style probe results
const styleProbeResults: Record<string, Record<string, string>> = {};

// Ensure output directory exists (with race condition handling for parallel workers)
test.beforeAll(async () => {
  // Create directory if it doesn't exist
  if (!fs.existsSync(ROI_CURRENT_DIR)) {
    fs.mkdirSync(ROI_CURRENT_DIR, { recursive: true });
  }
  // Clean existing files with error handling for race conditions
  try {
    const files = fs.readdirSync(ROI_CURRENT_DIR).filter(f => f.endsWith('.png'));
    files.forEach(f => {
      try {
        fs.unlinkSync(path.join(ROI_CURRENT_DIR, f));
      } catch {
        // File may have been deleted by another worker - ignore
      }
    });
  } catch {
    // Directory may not exist yet - ignore
  }
});

// Disable animations
test.use({
  reducedMotion: 'reduce',
  viewport: { width: 400, height: 600 }, // Popup viewport for consistency
});

// Generate tests for each ROI
for (const roi of ROI_TARGETS) {
  test(`ROI: ${roi.name}`, async ({ page }) => {
    // Step 1: Initialize
    await page.goto('about:blank');
    await page.goto('/');

    // Step 2: Setup state
    await roi.setup(page);

    // Step 3: Set density
    await page.evaluate(() => {
      localStorage.setItem('density_mode', 'compact');
    });

    // Step 4: Reload and navigate
    await page.reload();
    if (roi.route !== '/') {
      await page.goto(roi.route);
    }

    // Step 5: Apply density
    await page.evaluate(() => {
      document.documentElement.dataset.density = 'compact';
    });

    // Step 6: Run afterNav hook
    if (roi.afterNav) {
      await roi.afterNav(page);
    }

    // Step 7: Wait and capture
    await page.waitForTimeout(500);
    const result = await captureROI(page, roi);

    // Store styles for probe
    if (result.styles) {
      styleProbeResults[roi.name] = result.styles;
    }
  });
}

// Summary and style probe output
test.afterAll(async () => {
  console.log('\n========================================');
  console.log('Golden ROI Screenshots - V41');
  console.log('========================================');
  console.log(`Output: ${ROI_CURRENT_DIR}`);

  const files = fs.existsSync(ROI_CURRENT_DIR)
    ? fs.readdirSync(ROI_CURRENT_DIR).filter(f => f.endsWith('.png'))
    : [];
  const actual = files.length;
  const expected = EXPECTED_ROI_COUNT;

  console.log(`\nCount: ${actual}/${expected}`);

  if (actual === expected) {
    console.log('Status: ✓ COMPLETE');
  } else {
    console.log(`Status: ✗ INCOMPLETE (missing ${expected - actual})`);
  }

  console.log('\nFiles:');
  files.sort().forEach(f => console.log(`  - ${f}`));

  // Write style probe JSON
  if (Object.keys(styleProbeResults).length > 0) {
    console.log('\n========================================');
    console.log('Style Probe Results (V41 Verification)');
    console.log('========================================');

    // V41 expected values
    const v41Expected = {
      'primary-cta-start': {
        'background-color': 'rgb(201, 228, 38)', // #C9E426
      },
      'primary-cta-send': {
        'background-color': 'rgb(201, 228, 38)', // #C9E426
      },
      'inline-action-max': {
        'background-color': 'rgb(201, 228, 38)', // #C9E426
      },
    };

    const probeOutput: {
      version: string;
      timestamp: string;
      probes: Record<string, {
        actual: Record<string, string>;
        expected?: Record<string, string>;
        pass: boolean;
      }>;
      summary: { total: number; passed: number; failed: number };
    } = {
      version: 'V41',
      timestamp: new Date().toISOString(),
      probes: {},
      summary: { total: 0, passed: 0, failed: 0 },
    };

    for (const [name, styles] of Object.entries(styleProbeResults)) {
      const expected = v41Expected[name as keyof typeof v41Expected];
      let pass = true;

      if (expected) {
        for (const [prop, expectedValue] of Object.entries(expected)) {
          const actualValue = styles[prop];
          if (actualValue !== expectedValue) {
            // Allow for slight RGB variations
            const actualRgb = actualValue?.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            const expectedRgb = expectedValue.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

            if (actualRgb && expectedRgb) {
              const diff = Math.abs(parseInt(actualRgb[1]) - parseInt(expectedRgb[1])) +
                           Math.abs(parseInt(actualRgb[2]) - parseInt(expectedRgb[2])) +
                           Math.abs(parseInt(actualRgb[3]) - parseInt(expectedRgb[3]));
              if (diff > 15) { // Allow 5 per channel
                pass = false;
              }
            } else {
              pass = false;
            }
          }
        }
      }

      probeOutput.probes[name] = {
        actual: styles,
        expected,
        pass,
      };

      probeOutput.summary.total++;
      if (pass) {
        probeOutput.summary.passed++;
        console.log(`  ✓ ${name}: V41 tokens applied`);
      } else {
        probeOutput.summary.failed++;
        console.log(`  ✗ ${name}: V41 tokens NOT applied`);
        console.log(`    Expected: ${JSON.stringify(expected)}`);
        console.log(`    Actual: ${JSON.stringify(styles)}`);
      }
    }

    fs.writeFileSync(STYLE_PROBE_PATH, JSON.stringify(probeOutput, null, 2));
    console.log(`\nStyle probe saved: ${STYLE_PROBE_PATH}`);
  }

  // Write count file
  const countFile = path.join(ARTIFACTS_DIR, 'roi-count.json');
  fs.writeFileSync(countFile, JSON.stringify({ actual, expected, complete: actual === expected }, null, 2));

  console.log('========================================\n');
});
