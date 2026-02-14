import { test, expect, Page } from '@playwright/test';

/**
 * Density Mode E2E Tests
 *
 * These tests verify that the density mode system works globally
 * across the extension, affecting all routes and components.
 *
 * Run with: pnpm test:e2e
 */

// Expected density token values
const DENSITY_TOKENS = {
  compact: {
    '--header-h': '44px',
    '--row-h': '44px',
    '--control-h': '44px',
    '--icon-btn-size': '32px',
    '--section-gap': '16px',
  },
  comfortable: {
    '--header-h': '56px',
    '--row-h': '52px',
    '--control-h': '52px',
    '--icon-btn-size': '40px',
    '--section-gap': '24px',
  },
} as const;

// Routes to test
const TEST_ROUTES = [
  { path: '/', name: 'Start' },
  { path: '/user', name: 'Home' },
  { path: '/send', name: 'Send' },
  { path: '/settings', name: 'Settings' },
  { path: '/manage-tokens', name: 'Manage Tokens' },
  { path: '/add-token', name: 'Add Token' },
];

// Helper to set density mode
async function setDensityMode(page: Page, mode: 'auto' | 'compact' | 'comfortable') {
  await page.evaluate((m) => {
    localStorage.setItem('density_mode', m);
    if (m === 'auto') {
      delete document.documentElement.dataset.density;
    } else {
      document.documentElement.dataset.density = m;
    }
  }, mode);
}

// Helper to get CSS variable value
async function getCssVar(page: Page, varName: string): Promise<string> {
  return page.evaluate((name) => {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }, varName);
}

// Helper to get element height
async function getElementHeight(page: Page, selector: string): Promise<number | null> {
  const element = await page.$(selector);
  if (!element) return null;
  const box = await element.boundingBox();
  return box ? Math.round(box.height) : null;
}

test.describe('Density Mode System', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to base URL
    await page.goto('/');
  });

  test('should apply correct CSS tokens for compact mode', async ({ page }) => {
    await setDensityMode(page, 'compact');

    // Verify each token
    for (const [varName, expectedValue] of Object.entries(DENSITY_TOKENS.compact)) {
      const actualValue = await getCssVar(page, varName);
      expect(actualValue, `${varName} should be ${expectedValue}`).toBe(expectedValue);
    }
  });

  test('should apply correct CSS tokens for comfortable mode', async ({ page }) => {
    await setDensityMode(page, 'comfortable');

    // Verify each token
    for (const [varName, expectedValue] of Object.entries(DENSITY_TOKENS.comfortable)) {
      const actualValue = await getCssVar(page, varName);
      expect(actualValue, `${varName} should be ${expectedValue}`).toBe(expectedValue);
    }
  });

  test('CSS token values should differ between compact and comfortable', async ({ page }) => {
    // Test compact
    await setDensityMode(page, 'compact');
    const compactHeaderH = await getCssVar(page, '--header-h');
    const compactRowH = await getCssVar(page, '--row-h');
    const compactControlH = await getCssVar(page, '--control-h');

    // Test comfortable
    await setDensityMode(page, 'comfortable');
    const comfyHeaderH = await getCssVar(page, '--header-h');
    const comfyRowH = await getCssVar(page, '--row-h');
    const comfyControlH = await getCssVar(page, '--control-h');

    // Verify they differ
    expect(compactHeaderH).not.toBe(comfyHeaderH);
    expect(compactRowH).not.toBe(comfyRowH);
    expect(compactControlH).not.toBe(comfyControlH);

    // Log for debugging
    console.log('Token Comparison:');
    console.log(`  --header-h: ${compactHeaderH} (compact) vs ${comfyHeaderH} (comfortable)`);
    console.log(`  --row-h: ${compactRowH} (compact) vs ${comfyRowH} (comfortable)`);
    console.log(`  --control-h: ${compactControlH} (compact) vs ${comfyControlH} (comfortable)`);
  });

  test('auto mode should use media query based sizing', async ({ page }) => {
    await setDensityMode(page, 'auto');

    // In auto mode, the data-density attribute should not be set
    const dataAttr = await page.evaluate(() => document.documentElement.dataset.density);
    expect(dataAttr).toBeUndefined();

    // Token values depend on viewport - for popup (600px height) should be compact
    const viewport = page.viewportSize();
    if (viewport && viewport.height <= 640) {
      const headerH = await getCssVar(page, '--header-h');
      expect(headerH).toBe('44px'); // Compact due to media query
    }
  });

  test('density mode should persist in localStorage', async ({ page }) => {
    await setDensityMode(page, 'compact');

    const stored = await page.evaluate(() => localStorage.getItem('density_mode'));
    expect(stored).toBe('compact');

    // Reload and verify persistence
    await page.reload();
    const afterReload = await page.evaluate(() => localStorage.getItem('density_mode'));
    expect(afterReload).toBe('compact');
  });
});

test.describe('Element Height Verification', () => {
  // This test group verifies that actual elements respond to density changes.
  // Elements with hardcoded heights will fail these tests.

  const elementsToTest = [
    { selector: '.app-header', expectedToken: '--header-h', name: 'AppHeader' },
    { selector: '.header-btn', expectedToken: '--icon-btn-size', name: 'Header Button' },
    { selector: '.list-row', expectedToken: '--row-h', name: 'ListRow' },
  ];

  for (const element of elementsToTest) {
    test(`${element.name} height should differ between compact and comfortable`, async ({ page }) => {
      // This test requires navigation to a route where the element exists
      await page.goto('/settings'); // UserMenu has these elements

      // Measure in compact mode
      await setDensityMode(page, 'compact');
      await page.waitForTimeout(100); // Wait for CSS to apply
      const compactHeight = await getElementHeight(page, element.selector);

      // Measure in comfortable mode
      await setDensityMode(page, 'comfortable');
      await page.waitForTimeout(100);
      const comfyHeight = await getElementHeight(page, element.selector);

      // Skip if element not found
      if (compactHeight === null || comfyHeight === null) {
        test.skip(true, `Element ${element.selector} not found on page`);
        return;
      }

      // Log measurements
      console.log(`${element.name}: ${compactHeight}px (compact) vs ${comfyHeight}px (comfortable)`);

      // Verify heights differ
      expect(
        compactHeight,
        `${element.name} should have different height in compact mode`
      ).not.toBe(comfyHeight);
    });
  }
});

test.describe('Route Coverage', () => {
  // Test that density mode works on all routes

  for (const route of TEST_ROUTES) {
    test(`density tokens should apply on ${route.name} (${route.path})`, async ({ page }) => {
      await page.goto(route.path);

      // Test compact
      await setDensityMode(page, 'compact');
      const compactHeaderH = await getCssVar(page, '--header-h');
      expect(compactHeaderH).toBe('44px');

      // Test comfortable
      await setDensityMode(page, 'comfortable');
      const comfyHeaderH = await getCssVar(page, '--header-h');
      expect(comfyHeaderH).toBe('56px');
    });
  }
});

test.describe('Visual Regression', () => {
  // Take screenshots for visual comparison

  test('should capture compact mode screenshot', async ({ page }) => {
    await page.goto('/user');
    await setDensityMode(page, 'compact');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('density-compact.png', {
      fullPage: true,
    });
  });

  test('should capture comfortable mode screenshot', async ({ page }) => {
    await page.goto('/user');
    await setDensityMode(page, 'comfortable');
    await page.waitForTimeout(500);
    await expect(page).toHaveScreenshot('density-comfortable.png', {
      fullPage: true,
    });
  });
});
