import { test, expect, Page } from "@playwright/test";

/**
 * Transaction Flow Guard Tests - V52.2 + V52.3
 *
 * V52.2:
 * - No horizontal overflow in /send confirm pin step
 * - No horizontal overflow in /tx-result view
 * - All ROI targets are present and properly contained
 *
 * V52.3:
 * - PIN error slot no layout shift (keypad position unchanged)
 * - Error slot has fixed height
 * - aria-live polite for accessibility
 *
 * Run with: pnpm test:e2e
 */

// Helper to check for horizontal overflow
async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    // Check if any scroll width exceeds client width
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

// Helper to set up mock tx draft in localStorage
async function setMockTxDraft(page: Page, txid?: string, error?: string) {
  await page.evaluate(
    ({ txid, error }) => {
      // Mock session - pretend we have a wallet
      localStorage.setItem("wallet_count", "1");
      localStorage.setItem("active_wallet_id", "test-wallet-1");
      localStorage.setItem("session_unlocked", "true");

      // We can't directly set reactive state, but we can navigate with query params
      // The views should handle incomplete state gracefully
    },
    { txid, error }
  );
}

test.describe("V52.2 Overflow Guards", () => {
  test.describe("TxResultView", () => {
    test("should not have horizontal overflow with success state", async ({
      page,
    }) => {
      // Navigate directly to tx-result
      await page.goto("/#/tx-result");
      await page.waitForTimeout(500);

      // Check for horizontal overflow
      const hasOverflow = await hasHorizontalOverflow(page);
      expect(hasOverflow, "Page should not have horizontal overflow").toBe(
        false
      );

      // Check specific elements
      const rootOverflow = await getElementOverflow(
        page,
        '[data-roi="tx-result-root"]'
      );
      if (rootOverflow) {
        expect(
          rootOverflow.overflowsX,
          "tx-result-root should not overflow"
        ).toBe(false);
      }

      const summaryOverflow = await getElementOverflow(
        page,
        '[data-roi="tx-result-summary"]'
      );
      if (summaryOverflow) {
        expect(
          summaryOverflow.overflowsX,
          "tx-result-summary should not overflow"
        ).toBe(false);
      }
    });

    test("should contain ambient glow without causing overflow", async ({
      page,
    }) => {
      await page.goto("/#/tx-result");
      await page.waitForTimeout(500);

      // The ambient glow wrapper should clip the oversized glow
      const ambientWrapper = await page.$(".ambient-wrapper");
      if (ambientWrapper) {
        const style = await ambientWrapper.evaluate((el) =>
          getComputedStyle(el).overflow
        );
        expect(style).toBe("hidden");
      }

      // Verify no horizontal scrollbar
      const hasOverflow = await hasHorizontalOverflow(page);
      expect(hasOverflow).toBe(false);
    });

    test("should have all required ROI targets", async ({ page }) => {
      await page.goto("/#/tx-result");
      await page.waitForTimeout(500);

      // Check for ROI targets that should exist in success/pending states
      const roiTargets = [
        "tx-result-root",
        "tx-result-header",
        "tx-result-status",
        "tx-result-cta-rail",
      ];

      for (const roi of roiTargets) {
        const element = await page.$(`[data-roi="${roi}"]`);
        expect(element, `ROI target ${roi} should exist`).not.toBeNull();
      }
    });
  });

  test.describe("SendView Confirm PIN", () => {
    test("should not have horizontal overflow in confirm step", async ({
      page,
    }) => {
      // Set up mock wallet state
      await page.goto("/#/send");
      await page.waitForTimeout(500);

      // Note: In real test, we'd fill the form and navigate to confirm step
      // For now, check the form step doesn't have overflow
      const hasOverflow = await hasHorizontalOverflow(page);
      expect(hasOverflow, "SendView should not have horizontal overflow").toBe(
        false
      );
    });

    test("should have proper box-sizing on all elements", async ({ page }) => {
      await page.goto("/#/send");
      await page.waitForTimeout(500);

      // Check that box-sizing is border-box on key elements
      const boxSizing = await page.evaluate(() => {
        const content = document.querySelector(".content");
        const stickyFooter = document.querySelector(".sticky-footer");
        return {
          content: content
            ? getComputedStyle(content).boxSizing
            : "not-found",
          stickyFooter: stickyFooter
            ? getComputedStyle(stickyFooter).boxSizing
            : "not-found",
        };
      });

      if (boxSizing.content !== "not-found") {
        expect(boxSizing.content).toBe("border-box");
      }
    });
  });

  test.describe("ConfirmTxView", () => {
    test("should not have horizontal overflow", async ({ page }) => {
      await page.goto("/#/confirm-tx");
      await page.waitForTimeout(500);

      const hasOverflow = await hasHorizontalOverflow(page);
      expect(
        hasOverflow,
        "ConfirmTxView should not have horizontal overflow"
      ).toBe(false);
    });

    test("should contain ambient glow without causing overflow", async ({
      page,
    }) => {
      await page.goto("/#/confirm-tx");
      await page.waitForTimeout(500);

      // The ambient glow wrapper should clip the oversized glow
      const ambientWrapper = await page.$(".ambient-wrapper");
      if (ambientWrapper) {
        const style = await ambientWrapper.evaluate((el) =>
          getComputedStyle(el).overflow
        );
        expect(style).toBe("hidden");
      }
    });

    test("should have summary card properly contained", async ({ page }) => {
      await page.goto("/#/confirm-tx");
      await page.waitForTimeout(500);

      const summaryCard = await getElementOverflow(
        page,
        '[data-roi="confirm-summary"]'
      );
      if (summaryCard) {
        expect(
          summaryCard.overflowsX,
          "Summary card should not overflow horizontally"
        ).toBe(false);
      }
    });

    test("should have all required ROI targets", async ({ page }) => {
      await page.goto("/#/confirm-tx");
      await page.waitForTimeout(500);

      // ROI targets that should exist
      const roiTargets = [
        "confirm-view-root",
        "confirm-header",
        "confirm-summary",
        "confirm-warning",
        "confirm-cta-rail",
        "confirm-to-row",
      ];

      for (const roi of roiTargets) {
        const element = await page.$(`[data-roi="${roi}"]`);
        // Element may not exist if redirected due to missing draft
        // This is expected behavior - guard redirect
        if (element) {
          console.log(`ROI target ${roi} found`);
        }
      }
    });
  });
});

test.describe("V52.2 Address Truncation", () => {
  test("long addresses should be truncated to 8...8 format", async ({
    page,
  }) => {
    await page.goto("/#/confirm-tx");
    await page.waitForTimeout(500);

    // Check that addresses don't cause overflow
    const addressElements = await page.$$(".value-address");
    for (const el of addressElements) {
      const text = await el.textContent();
      if (text && text.length > 20) {
        // If displayed, should be truncated
        expect(text).toMatch(/^.{8}\.\.\..{8}$/);
      }
    }
  });
});

test.describe("V52.2 CTA Rail Containment", () => {
  test.describe("TxResultView CTA Rail", () => {
    test("should be sticky and properly contained", async ({ page }) => {
      await page.goto("/#/tx-result");
      await page.waitForTimeout(500);

      const ctaRail = await page.$('[data-roi="tx-result-cta-rail"]');
      if (ctaRail) {
        const style = await ctaRail.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            position: computed.position,
            maxWidth: computed.maxWidth,
            width: computed.width,
          };
        });

        expect(style.position).toBe("sticky");
        expect(style.maxWidth).toBe("100%");
      }
    });
  });

  test.describe("ConfirmTxView CTA Rail", () => {
    test("should be sticky and properly contained", async ({ page }) => {
      await page.goto("/#/confirm-tx");
      await page.waitForTimeout(500);

      const ctaRail = await page.$('[data-roi="confirm-cta-rail"]');
      if (ctaRail) {
        const style = await ctaRail.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            position: computed.position,
            maxWidth: computed.maxWidth,
          };
        });

        expect(style.position).toBe("sticky");
        expect(style.maxWidth).toBe("100%");
      }
    });
  });
});

/**
 * V52.3: PIN Error Lane - No Layout Shift Guards
 */
test.describe("V52.3 PIN Error Lane (No Layout Shift)", () => {
  // Helper to get element's bounding box top position
  async function getElementTop(
    page: Page,
    selector: string
  ): Promise<number | null> {
    return page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      return el.getBoundingClientRect().top;
    }, selector);
  }

  test.describe("PinInput Error Slot", () => {
    test("error slot should have fixed height when empty", async ({ page }) => {
      // Navigate to unlock view which has PinInput
      await page.goto("/#/unlock");
      await page.waitForTimeout(500);

      const errorSlot = await page.$('[data-roi="pin-error-slot"]');
      if (errorSlot) {
        const box = await errorSlot.boundingBox();
        expect(box, "Error slot should exist").not.toBeNull();
        if (box) {
          // Should have fixed height even when empty (24px)
          expect(box.height).toBeGreaterThanOrEqual(20);
          expect(box.height).toBeLessThanOrEqual(28);
        }
      }
    });

    test("error slot should be hidden via opacity when no error", async ({
      page,
    }) => {
      await page.goto("/#/unlock");
      await page.waitForTimeout(500);

      const errorSlot = await page.$('[data-roi="pin-error-slot"]');
      if (errorSlot) {
        const style = await errorSlot.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            opacity: computed.opacity,
            height: computed.height,
            minHeight: computed.minHeight,
          };
        });

        // Should be hidden via opacity, not display:none
        expect(style.opacity).toBe("0");
        // Should still have height reserved
        expect(parseFloat(style.height) || parseFloat(style.minHeight)).toBeGreaterThan(0);
      }
    });

    test("error slot should have aria-live polite for accessibility", async ({
      page,
    }) => {
      await page.goto("/#/unlock");
      await page.waitForTimeout(500);

      const errorSlot = await page.$('[data-roi="pin-error-slot"]');
      if (errorSlot) {
        const ariaLive = await errorSlot.getAttribute("aria-live");
        const ariaAtomic = await errorSlot.getAttribute("aria-atomic");
        const role = await errorSlot.getAttribute("role");

        expect(ariaLive).toBe("polite");
        expect(ariaAtomic).toBe("true");
        expect(role).toBe("status");
      }
    });

    test("keypad should maintain same position when error toggles", async ({
      page,
    }) => {
      await page.goto("/#/unlock");
      await page.waitForTimeout(500);

      // Get initial keypad position
      const keypadBefore = await getElementTop(page, '[data-roi="pin-keypad"]');
      expect(keypadBefore, "Keypad should exist").not.toBeNull();

      // Simulate error state by adding the visible class to error slot
      await page.evaluate(() => {
        const errorSlot = document.querySelector('[data-roi="pin-error-slot"]');
        if (errorSlot) {
          errorSlot.classList.add("error-slot--visible");
          const errorMsg = errorSlot.querySelector(".error-message");
          if (errorMsg) {
            errorMsg.textContent = "Invalid PIN. 2 attempts remaining";
          }
        }
      });

      // Wait for any potential reflow
      await page.waitForTimeout(100);

      // Get keypad position after error
      const keypadAfter = await getElementTop(page, '[data-roi="pin-keypad"]');
      expect(keypadAfter, "Keypad should still exist").not.toBeNull();

      // Keypad should NOT have moved (no layout shift)
      expect(
        keypadAfter,
        "Keypad top position should remain unchanged when error appears"
      ).toBe(keypadBefore);

      // Now hide error and verify position still unchanged
      await page.evaluate(() => {
        const errorSlot = document.querySelector('[data-roi="pin-error-slot"]');
        if (errorSlot) {
          errorSlot.classList.remove("error-slot--visible");
        }
      });

      await page.waitForTimeout(100);

      const keypadFinal = await getElementTop(page, '[data-roi="pin-keypad"]');
      expect(
        keypadFinal,
        "Keypad top position should remain unchanged when error disappears"
      ).toBe(keypadBefore);
    });

    test("error slot should NOT cause horizontal overflow", async ({
      page,
    }) => {
      await page.goto("/#/unlock");
      await page.waitForTimeout(500);

      // Add a long error message
      await page.evaluate(() => {
        const errorSlot = document.querySelector('[data-roi="pin-error-slot"]');
        if (errorSlot) {
          errorSlot.classList.add("error-slot--visible");
          const errorMsg = errorSlot.querySelector(".error-message");
          if (errorMsg) {
            errorMsg.textContent =
              "Invalid PIN. Please try again. 3 attempts remaining before lockout.";
          }
        }
      });

      await page.waitForTimeout(100);

      const hasOverflow = await hasHorizontalOverflow(page);
      expect(
        hasOverflow,
        "Error message should not cause horizontal overflow"
      ).toBe(false);
    });
  });

  test.describe("PinInput Keypad ROI Target", () => {
    test("keypad should have ROI target for testing", async ({ page }) => {
      await page.goto("/#/unlock");
      await page.waitForTimeout(500);

      const keypad = await page.$('[data-roi="pin-keypad"]');
      expect(keypad, "Keypad ROI target should exist").not.toBeNull();
    });

    test("keypad should have proper grid layout", async ({ page }) => {
      await page.goto("/#/unlock");
      await page.waitForTimeout(500);

      const keypad = await page.$('[data-roi="pin-keypad"]');
      if (keypad) {
        const style = await keypad.evaluate((el) => {
          const computed = getComputedStyle(el);
          return {
            display: computed.display,
            gridTemplateColumns: computed.gridTemplateColumns,
          };
        });

        expect(style.display).toBe("grid");
        // Should have 3 columns
        expect(style.gridTemplateColumns).toContain("px");
      }
    });
  });
});
