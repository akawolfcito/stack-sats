/**
 * CWS Store Screenshots - Chrome Web Store Marketing Assets
 *
 * Generates 5 branded 1280x800 store card images for CWS submission.
 * Each card composites a popup screenshot onto a dark branded background
 * with headline text and branding.
 *
 * Two-phase approach per card:
 *   Phase 1: Capture raw popup at 400x600 as base64 PNG
 *   Phase 2: Render inline HTML template at 1280x800 with the popup embedded
 *
 * Run with: pnpm ui:store
 *
 * Output: assets/store/cws-{id}.png
 */
import { test, Page, Browser } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { TEST_MNEMONIC } from './fixtures/mock-wallet.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_DIR = path.join(__dirname, '../assets/store');
const POPUP_WIDTH = 400;
const POPUP_HEIGHT = 600;
const CARD_WIDTH = 1280;
const CARD_HEIGHT = 800;

// Brand tokens from base.css
const BRAND = {
  bg: '#01070E',
  accent: '#D7F82E',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255, 255, 255, 0.72)',
  cardBg: '#1D1D1C',
  font: 'Quicksand',
};

interface StoreCard {
  id: string;
  route: string;
  headline: string;
  caption: string;
  setup: (page: Page) => Promise<void>;
  afterNav?: (page: Page) => Promise<void>;
}

// --- Setup helpers (reused from golden-matrix.spec.ts) ---

async function clearWallet(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function setupUnlockedWallet(page: Page) {
  await page.evaluate((mnemonic) => {
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('__UI_SNAPSHOT_MODE__', 'true');
    localStorage.setItem('__UI_SNAPSHOT_MNEMONIC__', mnemonic);
    localStorage.setItem('selected_network', 'devnet');
    localStorage.setItem('density_mode', 'comfy');
  }, TEST_MNEMONIC);
}

async function openReceiveModal(page: Page) {
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const hook = (window as any).__UI_SNAPSHOT__;
    if (hook?.openReceiveModal) {
      hook.openReceiveModal();
    }
  });
  await page.waitForTimeout(300);
}

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

// --- Store card definitions ---

const STORE_CARDS: StoreCard[] = [
  {
    id: '01-start',
    route: '/',
    headline: 'Your Gateway to Stacks',
    caption: 'Get started in seconds with a secure, self-custodial wallet',
    setup: clearWallet,
  },
  {
    id: '02-home',
    route: '/user',
    headline: 'Manage Your Assets',
    caption: 'Track balances, tokens, and transaction history at a glance',
    setup: setupUnlockedWallet,
  },
  {
    id: '03-send',
    route: '/send',
    headline: 'Send STX Instantly',
    caption: 'Fast, simple transfers with real-time fee estimates',
    setup: setupUnlockedWallet,
  },
  {
    id: '04-receive',
    route: '/user',
    headline: 'Receive with QR Code',
    caption: 'Share your address instantly with a scannable QR code',
    setup: setupUnlockedWallet,
    afterNav: openReceiveModal,
  },
  {
    id: '05-settings',
    route: '/usermenu',
    headline: 'Full Control',
    caption: 'Network switching, security settings, and account management',
    setup: setupUnlockedWallet,
  },
];

// --- HTML template for the composite store card ---

function buildCardHTML(popupBase64: string, headline: string, caption: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: ${CARD_WIDTH}px;
      height: ${CARD_HEIGHT}px;
      overflow: hidden;
      background: ${BRAND.bg};
      font-family: '${BRAND.font}', -apple-system, BlinkMacSystemFont, sans-serif;
      -webkit-font-smoothing: antialiased;
    }
    .card {
      width: ${CARD_WIDTH}px;
      height: ${CARD_HEIGHT}px;
      display: flex;
      align-items: center;
      position: relative;
      overflow: hidden;
    }
    /* Subtle radial glow behind popup */
    .card::before {
      content: '';
      position: absolute;
      right: 180px;
      top: 50%;
      transform: translateY(-50%);
      width: 500px;
      height: 500px;
      background: radial-gradient(circle, rgba(215, 248, 46, 0.06) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
    }
    .text-area {
      flex: 0 0 55%;
      padding: 0 60px 0 80px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 20px;
      z-index: 1;
    }
    .logo-text {
      font-size: 18px;
      font-weight: 700;
      color: ${BRAND.accent};
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .headline {
      font-size: 48px;
      font-weight: 700;
      color: ${BRAND.textPrimary};
      line-height: 1.15;
    }
    .caption {
      font-size: 18px;
      font-weight: 400;
      color: ${BRAND.textSecondary};
      line-height: 1.5;
      max-width: 420px;
    }
    .popup-area {
      flex: 0 0 45%;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1;
    }
    .popup-frame {
      width: ${POPUP_WIDTH}px;
      height: ${POPUP_HEIGHT}px;
      border-radius: 16px;
      overflow: hidden;
      box-shadow:
        0 24px 64px rgba(0, 0, 0, 0.55),
        0 0 0 1px rgba(255, 255, 255, 0.08);
    }
    .popup-frame img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: cover;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="text-area">
      <div class="logo-text">DenVault</div>
      <h1 class="headline">${headline}</h1>
      <p class="caption">${caption}</p>
    </div>
    <div class="popup-area">
      <div class="popup-frame">
        <img src="data:image/png;base64,${popupBase64}" alt="popup screenshot" />
      </div>
    </div>
  </div>
</body>
</html>`;
}

// --- Test suite ---

test.describe('CWS Store Screenshots', () => {
  test.use({ reducedMotion: 'reduce' });

  test.beforeAll(async () => {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  });

  for (const card of STORE_CARDS) {
    test(`Store card: ${card.id} - ${card.headline}`, async ({ page, browser }) => {
      // --- Phase 1: Capture raw popup screenshot ---
      await page.setViewportSize({ width: POPUP_WIDTH, height: POPUP_HEIGHT });

      // Navigate to app root to get localStorage access
      await page.goto('/');

      // Run wallet setup
      await card.setup(page);

      // Set comfy density for best visual appearance
      await page.evaluate(() => {
        localStorage.setItem('density_mode', 'comfy');
      });

      // Reload to pick up localStorage state
      await page.reload();

      // Navigate to target route
      if (card.route !== '/') {
        await page.goto(card.route);
      }

      // Apply density class
      await page.evaluate(() => {
        document.documentElement.dataset.density = 'comfy';
      });

      // Run afterNav hook if defined (e.g., open modal)
      if (card.afterNav) {
        await card.afterNav(page);
      }

      // Wait for stable state
      await page.waitForTimeout(500);
      await waitForStableState(page);

      // Capture popup as base64
      const popupBuffer = await page.screenshot({ fullPage: false });
      const popupBase64 = popupBuffer.toString('base64');

      // --- Phase 2: Composite store card ---
      const cardContext = await browser.newContext({
        viewport: { width: CARD_WIDTH, height: CARD_HEIGHT },
        reducedMotion: 'reduce',
      });
      const cardPage = await cardContext.newPage();

      // Load the composite HTML template
      const html = buildCardHTML(popupBase64, card.headline, card.caption);
      await cardPage.setContent(html, { waitUntil: 'networkidle' });

      // Wait for Google Fonts to load
      await cardPage.waitForFunction(() => {
        return document.fonts.check('700 48px Quicksand');
      }, { timeout: 10000 }).catch(() => {
        console.warn(`Font load timeout for ${card.id}, proceeding with fallback`);
      });

      await cardPage.waitForTimeout(500);

      // Capture final store card
      const outputPath = path.join(OUTPUT_DIR, `cws-${card.id}.png`);
      await cardPage.screenshot({ path: outputPath, fullPage: false });

      console.log(`  Generated: cws-${card.id}.png`);

      await cardContext.close();
    });
  }

  test.afterAll(async () => {
    console.log('\n========================================');
    console.log('CWS Store Screenshots');
    console.log('========================================');
    console.log(`Output: ${OUTPUT_DIR}`);

    const files = fs.existsSync(OUTPUT_DIR)
      ? fs.readdirSync(OUTPUT_DIR).filter(f => f.startsWith('cws-') && f.endsWith('.png'))
      : [];

    console.log(`\nGenerated: ${files.length}/5 store cards`);
    files.sort().forEach(f => console.log(`  - ${f}`));

    if (files.length === 5) {
      console.log('\nStatus: COMPLETE - Ready for CWS upload');
    } else {
      console.log(`\nStatus: INCOMPLETE (missing ${5 - files.length})`);
    }
    console.log('========================================\n');
  });
});
