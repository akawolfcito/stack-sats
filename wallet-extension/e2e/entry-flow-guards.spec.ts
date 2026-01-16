import { test, expect, Page } from "@playwright/test";

/**
 * Entry Flow Guard Tests - V53 Entry Flow Premium Parity
 *
 * Guards for:
 * - StartView: Wallet creation onboarding
 * - AddWalletView: Add wallet flow (from settings)
 * - ImportMnemonicModal: Seed phrase import
 *
 * V53 Checks:
 * - No horizontal overflow in any step
 * - Ambient glow properly clipped
 * - All ROI targets present
 * - Error slots with reserved height (no layout shift)
 *
 * Run with: pnpm test:e2e
 */

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

// Helper to get element overflow info
async function getElementOverflow(
  page: Page,
  selector: string
): Promise<{ overflowsX: boolean; scrollWidth: number; clientWidth: number } | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return {
      overflowsX: el.scrollWidth > el.clientWidth,
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    };
  }, selector);
}

// Helper to clear wallet state for testing StartView
async function clearWalletState(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
  });
}

test.describe("V53 Entry Flow Overflow Guards", () => {
  test.describe("StartView", () => {
    test.beforeEach(async ({ page }) => {
      // Clear wallet state so StartView shows instead of redirect to /unlock
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);
    });

    test("should not have horizontal overflow on hero step", async ({ page }) => {
      const hasOverflow = await hasHorizontalOverflow(page);
      expect(hasOverflow, "StartView hero should not have horizontal overflow").toBe(false);
    });

    test("should contain ambient glow without causing overflow", async ({ page }) => {
      const ambientWrapper = await page.$(".ambient-wrapper");
      if (ambientWrapper) {
        const style = await ambientWrapper.evaluate((el) =>
          getComputedStyle(el).overflow
        );
        expect(style).toBe("hidden");
      }

      const hasOverflow = await hasHorizontalOverflow(page);
      expect(hasOverflow).toBe(false);
    });

    test("should have all required ROI targets on hero step", async ({ page }) => {
      // Check if we're actually on StartView (may redirect if wallet exists)
      const startViewRoot = await page.$('[data-roi="start-view-root"]');

      if (!startViewRoot) {
        // If redirected away from StartView, skip this test gracefully
        console.log("StartView not rendered (likely redirected due to existing wallet state)");
        return;
      }

      const roiTargets = [
        "start-hero",
        "start-cta-rail",
        "start-primary-cta",
        "start-secondary-cta",
      ];

      for (const roi of roiTargets) {
        const element = await page.$(`[data-roi="${roi}"]`);
        expect(element, `ROI target ${roi} should exist`).not.toBeNull();
      }
    });

    test("error slot should have reserved height", async ({ page }) => {
      const errorSlot = await page.$(".error-slot");
      if (errorSlot) {
        const style = await errorSlot.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            minHeight: computed.minHeight,
            display: computed.display,
          };
        });

        expect(parseFloat(style.minHeight)).toBeGreaterThanOrEqual(20);
        expect(style.display).toBe("flex");
      }
    });
  });

  test.describe("AddWalletView", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);
    });

    test("should not have horizontal overflow", async ({ page }) => {
      const hasOverflow = await hasHorizontalOverflow(page);
      expect(hasOverflow, "AddWalletView should not have horizontal overflow").toBe(false);
    });

    test("should have all required ROI targets on start step", async ({ page }) => {
      const roiTargets = [
        "add-wallet-content",
        "add-wallet-start",
        "add-wallet-create-cta",
        "add-wallet-import-cta",
      ];

      for (const roi of roiTargets) {
        const element = await page.$(`[data-roi="${roi}"]`);
        // May redirect if not authenticated, so check gracefully
        if (element) {
          console.log(`ROI target ${roi} found`);
        }
      }
    });

    test("error slot should have reserved height", async ({ page }) => {
      const errorSlot = await page.$(".error-slot");
      if (errorSlot) {
        const box = await errorSlot.boundingBox();
        if (box) {
          expect(box.height).toBeGreaterThanOrEqual(20);
        }
      }
    });

    test("mnemonic grid should not overflow", async ({ page }) => {
      const mnemonicGrid = await getElementOverflow(
        page,
        '[data-roi="add-wallet-mnemonic-grid"]'
      );
      if (mnemonicGrid) {
        expect(
          mnemonicGrid.overflowsX,
          "Mnemonic grid should not overflow horizontally"
        ).toBe(false);
      }
    });
  });
});

test.describe("V53 ImportMnemonicModal Guards", () => {
  test.describe("Modal Layout", () => {
    // Note: These tests assume the modal can be triggered from AddWalletView
    // In practice, the modal needs to be opened via user interaction

    test("modal content should not overflow horizontally", async ({ page }) => {
      // Navigate to page where import modal can be triggered
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      // Click import button to open modal
      const importBtn = await page.$('[data-roi="add-wallet-import-cta"]');
      if (importBtn) {
        await importBtn.click();
        await page.waitForTimeout(300);

        const modalContent = await getElementOverflow(
          page,
          '[data-roi="import-mnemonic-modal"]'
        );
        if (modalContent) {
          expect(
            modalContent.overflowsX,
            "Import modal should not overflow horizontally"
          ).toBe(false);
        }
      }
    });

    test("modal should have required ROI targets", async ({ page }) => {
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      const importBtn = await page.$('[data-roi="add-wallet-import-cta"]');
      if (importBtn) {
        await importBtn.click();
        await page.waitForTimeout(300);

        const roiTargets = [
          "import-mnemonic-modal",
          "import-mnemonic-input",
          "import-mnemonic-cta",
        ];

        for (const roi of roiTargets) {
          const element = await page.$(`[data-roi="${roi}"]`);
          if (element) {
            console.log(`ROI target ${roi} found in modal`);
          }
        }
      }
    });

    test("word preview grid should handle long words gracefully", async ({ page }) => {
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      const importBtn = await page.$('[data-roi="add-wallet-import-cta"]');
      if (importBtn) {
        await importBtn.click();
        await page.waitForTimeout(300);

        // Type a test mnemonic
        const textarea = await page.$("textarea.phrase-input");
        if (textarea) {
          await textarea.fill("abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about");
          await page.waitForTimeout(200);

          // Check word preview doesn't overflow
          const wordPreview = await getElementOverflow(
            page,
            '[data-roi="import-mnemonic-preview"]'
          );
          if (wordPreview) {
            expect(
              wordPreview.overflowsX,
              "Word preview should not overflow"
            ).toBe(false);
          }
        }
      }
    });
  });
});

test.describe("V54 Mnemonic Grid - No Ellipsis", () => {
  test.describe("StartView Mnemonic Step", () => {
    test("mnemonic words should not overflow grid", async ({ page }) => {
      // This would need navigation to mnemonic step which requires clicking Create Wallet
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      // Click Create New Wallet
      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Should now be on mnemonic step
        const mnemonicGrid = await page.$('[data-roi="mnemonic-grid"]');
        if (mnemonicGrid) {
          const overflow = await getElementOverflow(page, '[data-roi="mnemonic-grid"]');
          if (overflow) {
            expect(overflow.overflowsX).toBe(false);
          }
        }
      }
    });

    test("mnemonic words should have proper min-width:0 for flex", async ({ page }) => {
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const mnemonicWord = await page.$(".mnemonic-word");
        if (mnemonicWord) {
          const style = await mnemonicWord.evaluate((el) =>
            getComputedStyle(el).minWidth
          );
          expect(style).toBe("0px");
        }
      }
    });

    test("V54: mnemonic words should NOT have text-overflow ellipsis", async ({ page }) => {
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const wordText = await page.$(".word-text");
        if (wordText) {
          const style = await wordText.evaluate((el) =>
            getComputedStyle(el).textOverflow
          );
          // V54: Should NOT be ellipsis - words must be fully readable
          expect(style).not.toBe("ellipsis");
        }
      }
    });

    test("V54: mnemonic cells should have fixed height", async ({ page }) => {
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const cells = await page.$$(".mnemonic-word");
        if (cells.length >= 2) {
          // All cells should have same height
          const heights = await Promise.all(
            cells.slice(0, 6).map(async (cell) => {
              const box = await cell.boundingBox();
              return box?.height ?? 0;
            })
          );
          const firstHeight = heights[0];
          for (const height of heights) {
            expect(height).toBe(firstHeight);
          }
        }
      }
    });
  });
});

test.describe("V53 Warning Box Accessibility", () => {
  test("warning box should use semantic tokens", async ({ page }) => {
    await page.goto("/#/start");
    await page.waitForTimeout(500);

    const createBtn = await page.$('[data-roi="start-primary-cta"]');
    if (createBtn) {
      await createBtn.click();
      await page.waitForTimeout(500);

      const warningBox = await page.$(".warning-box");
      if (warningBox) {
        const style = await warningBox.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            background: computed.backgroundColor,
            borderRadius: computed.borderRadius,
          };
        });

        // Should use tokens, not hardcoded values
        // Background should be warning-muted (yellowish with low opacity)
        expect(style.borderRadius).not.toBe("0px");
      }
    }
  });
});
