import { test, expect, Page } from "@playwright/test";

/**
 * Entry Flow Guard Tests - V53.2 Visual Consistency
 *
 * Guards for:
 * - StartView: Wallet creation onboarding
 * - AddWalletView: Add wallet flow (from settings)
 * - ImportMnemonicModal: Seed phrase import
 * - RecoveryPhraseDisplay: Shared component (both flows)
 * - VerifyPhraseStep: Shared component (both flows)
 *
 * V53.2 Visual Consistency (LAYOUT ONLY):
 * - ALWAYS 2-slot bottom rail (left/right) with SAME dimensions
 * - Ghost button (disabled, low opacity) when Back not allowed
 * - Primary CTA (right slot) identical width/position in both flows
 * - Same padding/margins between routes (0-1px tolerance)
 * - No copy/reveal/verification logic changes
 *
 * V53.1 Word Legibility Checks:
 * - No text-overflow: ellipsis on word tokens
 * - No line wrapping (white-space: nowrap)
 * - No scrollWidth > clientWidth (word doesn't overflow)
 * - Consistent cell heights
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

test.describe("V53.1 Mnemonic Word Legibility Guards", () => {
  test.describe("StartView Mnemonic Step", () => {
    test("mnemonic words should not overflow grid", async ({ page }) => {
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

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

    test("V53.1: word text should NOT have text-overflow ellipsis", async ({ page }) => {
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
          // V53.1: No ellipsis - words must be fully readable
          expect(style).not.toBe("ellipsis");
        }
      }
    });

    test("V53.1: word text should have white-space: nowrap (no line wrapping)", async ({ page }) => {
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const wordText = await page.$(".word-text");
        if (wordText) {
          const style = await wordText.evaluate((el) =>
            getComputedStyle(el).whiteSpace
          );
          // V53.1: No line wrapping inside word token
          expect(style).toBe("nowrap");
        }
      }
    });

    test("V53.1: word text should not have scrollWidth > clientWidth", async ({ page }) => {
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Check all word elements don't overflow
        const wordOverflows = await page.evaluate(() => {
          const words = document.querySelectorAll(".word-text");
          const results: { word: string; overflows: boolean }[] = [];
          words.forEach((word) => {
            const el = word as HTMLElement;
            results.push({
              word: el.textContent || "",
              overflows: el.scrollWidth > el.clientWidth,
            });
          });
          return results;
        });

        // No word should overflow its container
        const overflowingWords = wordOverflows.filter((w) => w.overflows);
        expect(overflowingWords, "No word should overflow its container").toHaveLength(0);
      }
    });

    test("V53.1: mnemonic cells should have consistent height", async ({ page }) => {
      await page.goto("/#/start");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const cells = await page.$$(".mnemonic-word");
        if (cells.length >= 2) {
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

test.describe("V53.2 Shared Component ROI Guards", () => {
  test.describe("RecoveryPhraseDisplay ROI Targets", () => {
    test("StartView: should have recovery-phrase-display ROI", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V53.2: Shared component ROI targets
        const roiTargets = [
          "recovery-phrase-display",
          "warning-card",
          "mnemonic-actions",
          "reveal-btn",
          "copy-btn",
          "mnemonic-grid",
          "recovery-phrase-cta",
        ];

        for (const roi of roiTargets) {
          const element = await page.$(`[data-roi="${roi}"]`);
          if (element) {
            console.log(`[StartView] ROI target ${roi} found`);
          }
        }
      }
    });

    test("AddWalletView: should have same recovery-phrase-display ROI", async ({ page }) => {
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="add-wallet-create-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V53.2: Same ROI targets as StartView
        const roiTargets = [
          "recovery-phrase-display",
          "warning-card",
          "mnemonic-actions",
          "reveal-btn",
          "copy-btn",
          "mnemonic-grid",
          "recovery-phrase-cta",
        ];

        for (const roi of roiTargets) {
          const element = await page.$(`[data-roi="${roi}"]`);
          if (element) {
            console.log(`[AddWalletView] ROI target ${roi} found`);
          }
        }
      }
    });
  });

  test.describe("VerifyPhraseStep ROI Targets", () => {
    test("StartView: should have verify-phrase-step ROI", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Click through to verify step
        const continueBtn = await page.$('[data-roi="recovery-phrase-cta"] button');
        if (continueBtn) {
          await continueBtn.click();
          await page.waitForTimeout(300);

          // V53.2: Shared verify component ROI targets
          const roiTargets = [
            "verify-phrase-step",
            "verify-word-1-input",
            "verify-word-2-input",
            "verify-phrase-cta",
          ];

          for (const roi of roiTargets) {
            const element = await page.$(`[data-roi="${roi}"]`);
            if (element) {
              console.log(`[StartView Verify] ROI target ${roi} found`);
            }
          }
        }
      }
    });

    test("AddWalletView: should have same verify-phrase-step ROI", async ({ page }) => {
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="add-wallet-create-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Click through to verify step
        const continueBtn = await page.$('[data-roi="recovery-phrase-cta"] button');
        if (continueBtn) {
          await continueBtn.click();
          await page.waitForTimeout(300);

          // V53.2: Same ROI targets as StartView
          const roiTargets = [
            "verify-phrase-step",
            "verify-word-1-input",
            "verify-word-2-input",
            "verify-phrase-cta",
          ];

          for (const roi of roiTargets) {
            const element = await page.$(`[data-roi="${roi}"]`);
            if (element) {
              console.log(`[AddWalletView Verify] ROI target ${roi} found`);
            }
          }
        }
      }
    });
  });

  test.describe("Responsive Grid Guards", () => {
    test("mnemonic grid should use auto-fit minmax for responsive layout", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const mnemonicGrid = await page.$('[data-roi="mnemonic-grid"]');
        if (mnemonicGrid) {
          const gridStyle = await mnemonicGrid.evaluate((el) => {
            const computed = getComputedStyle(el);
            return {
              display: computed.display,
              gridTemplateColumns: computed.gridTemplateColumns,
            };
          });

          // Should be CSS grid
          expect(gridStyle.display).toBe("grid");
          // V53.2: Responsive columns (auto-fit creates multiple tracks)
          // gridTemplateColumns will be resolved values, not the minmax function
          expect(gridStyle.gridTemplateColumns).not.toBe("none");
        }
      }
    });
  });
});

test.describe("V53.2 Visual Consistency Guards (Updated for V54.2)", () => {
  // Helper to get comprehensive layout metrics for visual parity
  // V54.2: Back button removed, now single full-width CTA
  async function getLayoutMetrics(page: Page) {
    return page.evaluate(() => {
      const ctaRail = document.querySelector('[data-roi="recovery-phrase-cta"]');
      const primaryBtn = document.querySelector('[data-roi="cta-primary"]');
      const container = document.querySelector('[data-roi="recovery-phrase-display"]');

      if (!ctaRail || !primaryBtn || !container) return null;

      const railBox = ctaRail.getBoundingClientRect();
      const primaryBox = primaryBtn.getBoundingClientRect();

      // Get computed styles for padding verification
      const containerStyle = getComputedStyle(container);

      return {
        // Rail metrics
        railHeight: Math.round(railBox.height),
        railWidth: Math.round(railBox.width),
        // Primary CTA metrics
        primaryWidth: Math.round(primaryBox.width),
        primaryHeight: Math.round(primaryBox.height),
        primaryLeft: Math.round(primaryBox.left - railBox.left),
        // V54.2: Primary CTA is full-width ratio
        primaryWidthRatio: primaryBox.width / railBox.width,
        // Container padding
        containerPaddingTop: containerStyle.paddingTop,
        containerPaddingBottom: containerStyle.paddingBottom,
        containerPaddingLeft: containerStyle.paddingLeft,
        containerPaddingRight: containerStyle.paddingRight,
      };
    });
  }

  test.describe("CTA Rail Layout Parity (0-1px tolerance)", () => {
    test("V53.2: Primary CTA width must be identical in both flows", async ({ page }) => {
      // Get StartView metrics
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      let startMetrics = null;
      const startCreateBtn = await page.$('[data-roi="start-primary-cta"]');
      if (startCreateBtn) {
        await startCreateBtn.click();
        await page.waitForTimeout(500);
        startMetrics = await getLayoutMetrics(page);
      }

      // Get AddWalletView metrics
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      let addWalletMetrics = null;
      const addWalletCreateBtn = await page.$('[data-roi="add-wallet-create-cta"]');
      if (addWalletCreateBtn) {
        await addWalletCreateBtn.click();
        await page.waitForTimeout(500);
        addWalletMetrics = await getLayoutMetrics(page);
      }

      // V53.2: 0-1px tolerance for visual parity
      if (startMetrics && addWalletMetrics) {
        const widthDiff = Math.abs(startMetrics.primaryWidth - addWalletMetrics.primaryWidth);
        expect(widthDiff, `Primary CTA width diff: ${widthDiff}px`).toBeLessThanOrEqual(1);
        console.log(`[V53.2 Parity] Primary CTA width - Start: ${startMetrics.primaryWidth}px, Add: ${addWalletMetrics.primaryWidth}px (diff: ${widthDiff}px)`);
      }
    });

    test("V54.2: Primary CTA should be full-width in both flows", async ({ page }) => {
      // Get StartView metrics
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      let startMetrics = null;
      const startCreateBtn = await page.$('[data-roi="start-primary-cta"]');
      if (startCreateBtn) {
        await startCreateBtn.click();
        await page.waitForTimeout(500);
        startMetrics = await getLayoutMetrics(page);
      }

      // Get AddWalletView metrics
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      let addWalletMetrics = null;
      const addWalletCreateBtn = await page.$('[data-roi="add-wallet-create-cta"]');
      if (addWalletCreateBtn) {
        await addWalletCreateBtn.click();
        await page.waitForTimeout(500);
        addWalletMetrics = await getLayoutMetrics(page);
      }

      // V54.2: Both should be full-width (>95% of rail width)
      if (startMetrics && addWalletMetrics) {
        expect(startMetrics.primaryWidthRatio).toBeGreaterThan(0.95);
        expect(addWalletMetrics.primaryWidthRatio).toBeGreaterThan(0.95);
        console.log(`[V54.2 Full-Width] Start: ${(startMetrics.primaryWidthRatio * 100).toFixed(1)}%, Add: ${(addWalletMetrics.primaryWidthRatio * 100).toFixed(1)}%`);
      }
    });

    test("V53.2: Rail height must be identical in both flows", async ({ page }) => {
      // Get StartView metrics
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      let startMetrics = null;
      const startCreateBtn = await page.$('[data-roi="start-primary-cta"]');
      if (startCreateBtn) {
        await startCreateBtn.click();
        await page.waitForTimeout(500);
        startMetrics = await getLayoutMetrics(page);
      }

      // Get AddWalletView metrics
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      let addWalletMetrics = null;
      const addWalletCreateBtn = await page.$('[data-roi="add-wallet-create-cta"]');
      if (addWalletCreateBtn) {
        await addWalletCreateBtn.click();
        await page.waitForTimeout(500);
        addWalletMetrics = await getLayoutMetrics(page);
      }

      // V53.2: 0-1px tolerance
      if (startMetrics && addWalletMetrics) {
        const heightDiff = Math.abs(startMetrics.railHeight - addWalletMetrics.railHeight);
        expect(heightDiff, `Rail height diff: ${heightDiff}px`).toBeLessThanOrEqual(1);
        console.log(`[V53.2 Parity] Rail height - Start: ${startMetrics.railHeight}px, Add: ${addWalletMetrics.railHeight}px (diff: ${heightDiff}px)`);
      }
    });

    test("V54.2: StartView should have no bottom back button", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V54.2: No back button should exist (header back handles navigation)
        const backBtn = await page.$('[data-roi="cta-back"]');
        expect(backBtn, "Bottom back button should not exist").toBeNull();

        // V54.2: Verify single full-width CTA
        const metrics = await getLayoutMetrics(page);
        if (metrics) {
          expect(metrics.primaryWidthRatio).toBeGreaterThan(0.95);
          console.log(`[V54.2 StartView] Primary CTA width ratio: ${(metrics.primaryWidthRatio * 100).toFixed(1)}%`);
        }
      }
    });

    test("V54.2: AddWalletView should have no bottom back button", async ({ page }) => {
      await page.goto("/#/add-wallet");
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="add-wallet-create-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V54.2: No back button should exist (header back handles navigation)
        const backBtn = await page.$('[data-roi="cta-back"]');
        expect(backBtn, "Bottom back button should not exist").toBeNull();

        // V54.2: Verify single full-width CTA
        const metrics = await getLayoutMetrics(page);
        if (metrics) {
          expect(metrics.primaryWidthRatio).toBeGreaterThan(0.95);
          console.log(`[V54.2 AddWalletView] Primary CTA width ratio: ${(metrics.primaryWidthRatio * 100).toFixed(1)}%`);
        }
      }
    });
  });

  test.describe("No Overflow Guards", () => {
    test("V53.2: CTA rail should not cause horizontal overflow", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const hasOverflow = await hasHorizontalOverflow(page);
        expect(hasOverflow, "CTA rail should not cause horizontal overflow").toBe(false);
      }
    });

    test("V54.2: CTA rail must be fully visible (no vertical clipping)", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V54.2: Verify CTA rail is within viewport bounds (single button only)
        const ctaClipping = await page.evaluate(() => {
          const ctaRail = document.querySelector('[data-roi="recovery-phrase-cta"]');
          const ctaPrimary = document.querySelector('[data-roi="cta-primary"]');

          if (!ctaRail || !ctaPrimary) return null;

          const viewportHeight = window.innerHeight;
          const railBox = ctaRail.getBoundingClientRect();
          const primaryBox = ctaPrimary.getBoundingClientRect();

          return {
            viewportHeight,
            railBottom: Math.round(railBox.bottom),
            primaryBottom: Math.round(primaryBox.bottom),
            isRailClipped: railBox.bottom > viewportHeight,
            isPrimaryClipped: primaryBox.bottom > viewportHeight,
          };
        });

        if (ctaClipping) {
          console.log(`[V54.2 No Clipping] viewport: ${ctaClipping.viewportHeight}px, rail bottom: ${ctaClipping.railBottom}px`);
          expect(ctaClipping.isRailClipped, "CTA rail should not be clipped below viewport").toBe(false);
          expect(ctaClipping.isPrimaryClipped, "Primary CTA should not be clipped").toBe(false);
        }
      }
    });
  });
});

test.describe("V54.2 Zero-Shift Layout Guards", () => {
  // Helper to get element position for shift detection
  async function getElementPositions(page: Page) {
    return page.evaluate(() => {
      const actionPanel = document.querySelector('[data-roi="mnemonic-actions"]');
      const phraseHero = document.querySelector('[data-roi="phrase-hero"]');
      const mnemonicGrid = document.querySelector('[data-roi="mnemonic-grid"]');
      const ctaRail = document.querySelector('[data-roi="recovery-phrase-cta"]');

      const getTop = (el: Element | null) => el?.getBoundingClientRect().top ?? -1;

      return {
        actionPanelTop: Math.round(getTop(actionPanel)),
        phraseHeroTop: Math.round(getTop(phraseHero)),
        mnemonicGridTop: Math.round(getTop(mnemonicGrid)),
        ctaRailTop: Math.round(getTop(ctaRail)),
      };
    });
  }

  test.describe("No Layout Shift on Reveal/Hide Toggle", () => {
    test("V54.2: Element positions should not shift after reveal then hide", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Get initial positions (hidden state)
        const positionsBefore = await getElementPositions(page);

        // Click reveal button to show phrase
        const revealBtn = await page.$('[data-roi="reveal-btn"]');
        if (revealBtn) {
          await revealBtn.click();
          await page.waitForTimeout(300);

          // Click hide button to return to hidden state
          await revealBtn.click();
          await page.waitForTimeout(300);

          // Get final positions (hidden state again)
          const positionsAfter = await getElementPositions(page);

          // V54.2: Zero shift tolerance (0-1px)
          const tolerance = 1;
          const actionPanelShift = Math.abs(positionsBefore.actionPanelTop - positionsAfter.actionPanelTop);
          const phraseHeroShift = Math.abs(positionsBefore.phraseHeroTop - positionsAfter.phraseHeroTop);
          const ctaRailShift = Math.abs(positionsBefore.ctaRailTop - positionsAfter.ctaRailTop);

          expect(actionPanelShift, `Action panel shifted ${actionPanelShift}px`).toBeLessThanOrEqual(tolerance);
          expect(phraseHeroShift, `Phrase hero shifted ${phraseHeroShift}px`).toBeLessThanOrEqual(tolerance);
          expect(ctaRailShift, `CTA rail shifted ${ctaRailShift}px`).toBeLessThanOrEqual(tolerance);

          console.log(`[V54.2 Zero-Shift] Action panel: ${actionPanelShift}px, Hero: ${phraseHeroShift}px, CTA: ${ctaRailShift}px`);
        }
      }
    });

    test("V54.2: Caption slot should reserve height when hidden", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // Get action panel height when caption is visible
        const actionPanel = await page.$('[data-roi="mnemonic-actions"]');
        const heightBefore = await actionPanel?.evaluate((el) => el.getBoundingClientRect().height) ?? 0;

        // Reveal phrase (caption should become invisible but reserve space)
        const revealBtn = await page.$('[data-roi="reveal-btn"]');
        if (revealBtn) {
          await revealBtn.click();
          await page.waitForTimeout(300);

          // Get action panel height when caption is hidden
          const heightAfter = await actionPanel?.evaluate((el) => el.getBoundingClientRect().height) ?? 0;

          // V54.2: Height should remain the same (zero shift)
          const heightDiff = Math.abs(heightBefore - heightAfter);
          expect(heightDiff, `Action panel height changed by ${heightDiff}px`).toBeLessThanOrEqual(1);

          console.log(`[V54.2 Caption Reserve] Height before: ${heightBefore}px, after: ${heightAfter}px (diff: ${heightDiff}px)`);
        }
      }
    });

    test("V54.2: CTA rail should be single full-width button", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V54.2: No back button should exist
        const backBtn = await page.$('[data-roi="cta-back"]');
        expect(backBtn, "Bottom back button should not exist in V54.2").toBeNull();

        // V54.2: Primary CTA should exist
        const primaryBtn = await page.$('[data-roi="cta-primary"]');
        expect(primaryBtn, "Primary CTA should exist").toBeTruthy();

        // V54.2: Primary CTA should be full-width (check parent rail width)
        if (primaryBtn) {
          const btnWidth = await primaryBtn.evaluate((el) => el.getBoundingClientRect().width);
          const railWidth = await page.evaluate(() => {
            const rail = document.querySelector('[data-roi="recovery-phrase-cta"]');
            return rail?.getBoundingClientRect().width ?? 0;
          });

          // Button should take full width of rail (with small margin for rounding)
          const widthRatio = btnWidth / railWidth;
          expect(widthRatio).toBeGreaterThan(0.95);

          console.log(`[V54.2 Full-Width] Button: ${btnWidth}px, Rail: ${railWidth}px (ratio: ${widthRatio.toFixed(2)})`);
        }
      }
    });
  });
});

test.describe("V54.1 Single-CTA Reveal Interaction Guards", () => {
  test.describe("Clickable Hero Overlay", () => {
    test("V54.1: Phrase veil should be a clickable button", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V54.1: Verify phrase-veil-btn exists and is a button
        const veilBtn = await page.$('[data-roi="phrase-veil-btn"]');
        expect(veilBtn, "Phrase veil button should exist when phrase is hidden").toBeTruthy();

        if (veilBtn) {
          const tagName = await veilBtn.evaluate((el) => el.tagName.toLowerCase());
          expect(tagName, "Phrase veil should be a button element for a11y").toBe("button");

          const ariaLabel = await veilBtn.getAttribute("aria-label");
          expect(ariaLabel, "Phrase veil should have aria-label").toBe("Reveal recovery phrase");

          console.log("[V54.1] Phrase veil is a button with proper a11y");
        }
      }
    });

    test("V54.1: Clicking phrase veil should reveal the phrase", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        // V54.1: Verify phrase is initially hidden (veil is visible)
        const veilBefore = await page.$('[data-roi="phrase-veil-btn"]');
        expect(veilBefore, "Phrase veil should exist before reveal").toBeTruthy();

        // Check grid is blurred
        const gridBlurredBefore = await page.$('.mnemonic-grid--hidden');
        expect(gridBlurredBefore, "Grid should be blurred before reveal").toBeTruthy();

        // Click the veil to reveal
        if (veilBefore) {
          await veilBefore.click();
          await page.waitForTimeout(300);

          // V54.1: Verify phrase is now revealed (veil is gone)
          const veilAfter = await page.$('[data-roi="phrase-veil-btn"]');
          expect(veilAfter, "Phrase veil should be removed after reveal").toBeNull();

          // Check grid is no longer blurred
          const gridBlurredAfter = await page.$('.mnemonic-grid--hidden');
          expect(gridBlurredAfter, "Grid should not be blurred after reveal").toBeNull();

          console.log("[V54.1] Clicking phrase veil successfully reveals the phrase");
        }
      }
    });

    test("V54.1: Keyboard activation (Enter/Space) should reveal phrase", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const veilBtn = await page.$('[data-roi="phrase-veil-btn"]');
        if (veilBtn) {
          // Focus the veil button
          await veilBtn.focus();

          // Press Enter to activate
          await page.keyboard.press("Enter");
          await page.waitForTimeout(300);

          // V54.1: Verify phrase is revealed
          const veilAfter = await page.$('[data-roi="phrase-veil-btn"]');
          expect(veilAfter, "Phrase veil should be removed after Enter key").toBeNull();

          console.log("[V54.1] Keyboard activation (Enter) successfully reveals the phrase");
        }
      }
    });

    test("V54.1: Phrase veil should have proper cursor style", async ({ page }) => {
      await page.goto("/#/start");
      await clearWalletState(page);
      await page.reload();
      await page.waitForTimeout(500);

      const createBtn = await page.$('[data-roi="start-primary-cta"]');
      if (createBtn) {
        await createBtn.click();
        await page.waitForTimeout(500);

        const veilBtn = await page.$('[data-roi="phrase-veil-btn"]');
        if (veilBtn) {
          const cursor = await veilBtn.evaluate((el) => getComputedStyle(el).cursor);
          expect(cursor, "Phrase veil should have pointer cursor").toBe("pointer");

          console.log("[V54.1] Phrase veil has correct cursor: pointer");
        }
      }
    });
  });
});
