/**
 * E2E tests for DenLabs Signal integration
 *
 * Tests the complete flow of DenSignal emission from wallet actions.
 * Uses snapshot mode to bypass PIN authentication.
 */
import { test, expect, type Page } from '@playwright/test'

const STORAGE_KEY = 'denlabs_densignals_v01'
const SNAPSHOT_MODE_KEY = '__UI_SNAPSHOT_MODE__'
const SNAPSHOT_MNEMONIC_KEY = '__UI_SNAPSHOT_MNEMONIC__'
const TEST_MNEMONIC =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

/**
 * Helper to get stored DenSignals from the page
 */
async function getStoredSignals(page: Page): Promise<unknown[]> {
  return page.evaluate(async (key) => {
    return new Promise((resolve) => {
      // Try chrome.storage.local first (extension context)
      if (typeof chrome !== 'undefined' && chrome.storage?.local) {
        chrome.storage.local.get(key, (result) => {
          resolve(result[key] || [])
        })
      } else {
        // Fallback to localStorage for dev server testing
        const stored = localStorage.getItem(key)
        resolve(stored ? JSON.parse(stored) : [])
      }
    })
  }, STORAGE_KEY)
}

/**
 * Helper to clear stored signals
 */
async function clearStoredSignals(page: Page): Promise<void> {
  await page.evaluate(async (key) => {
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.remove(key)
    } else {
      localStorage.removeItem(key)
    }
  }, STORAGE_KEY)
}

/**
 * Setup snapshot mode for testing (bypasses PIN auth)
 */
async function setupSnapshotMode(page: Page): Promise<void> {
  await page.evaluate(
    ({ modeKey, mnemonicKey, mnemonic }) => {
      localStorage.setItem(modeKey, 'true')
      localStorage.setItem(mnemonicKey, mnemonic)
    },
    {
      modeKey: SNAPSHOT_MODE_KEY,
      mnemonicKey: SNAPSHOT_MNEMONIC_KEY,
      mnemonic: TEST_MNEMONIC,
    }
  )
}

/**
 * Enable DenLabs devtools
 */
async function enableDenlabsDevtools(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.removeItem('denlabs_manual_only')
  })
}

test.describe('DenLabs Signal Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app with denlabs flag
    await page.goto('/?denlabs=1')

    // Setup snapshot mode and enable devtools
    await setupSnapshotMode(page)
    await enableDenlabsDevtools(page)

    // Clear any existing signals
    await clearStoredSignals(page)

    // Reload to apply snapshot mode
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
  })

  test('should emit SESSION_STARTED on app load', async ({ page }) => {
    // Wait for app to initialize
    await page.waitForTimeout(500)

    const signals = await getStoredSignals(page)

    // Should have at least SESSION_STARTED
    expect(signals.length).toBeGreaterThanOrEqual(1)

    const sessionStarted = signals.find(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        'action' in s &&
        (s as { action: { name: string } }).action.name === 'dv_session_started'
    )
    expect(sessionStarted).toBeDefined()
  })

  test('should have correct signal structure', async ({ page }) => {
    await page.waitForTimeout(500)

    const signals = await getStoredSignals(page)
    expect(signals.length).toBeGreaterThan(0)

    const signal = signals[0] as {
      version: string
      id: string
      ts: string
      source: { kind: string; system: string }
      subject: { type: string; id: string }
      action: { name: string }
      tags: string[]
    }

    // Verify DenSignal v0.1 structure
    expect(signal.version).toBe('0.1')
    expect(signal.id).toMatch(/^sig_evt_/)
    expect(signal.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(signal.source.kind).toBe('offchain')
    expect(signal.source.system).toBe('denvault')
    expect(signal.subject.type).toBeDefined()
    expect(signal.subject.id).toBeDefined()
    expect(signal.action.name).toBeDefined()
    expect(Array.isArray(signal.tags)).toBe(true)
  })

  test('should include required tags', async ({ page }) => {
    await page.waitForTimeout(500)

    const signals = await getStoredSignals(page)
    const signal = signals[0] as { tags: string[] }

    expect(signal.tags).toContainEqual(expect.stringMatching(/^client:/))
    expect(signal.tags).toContainEqual(expect.stringMatching(/^app:/))
    expect(signal.tags).toContainEqual(expect.stringMatching(/^os:/))
    expect(signal.tags).toContainEqual(expect.stringMatching(/^env:/))
  })

  test('should NOT emit when manual_only flag is set', async ({ page }) => {
    // Set manual only flag
    await page.evaluate(() => {
      localStorage.setItem('denlabs_manual_only', '1')
    })

    // Clear signals
    await clearStoredSignals(page)

    // Reload
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
    await page.waitForTimeout(500)

    const signals = await getStoredSignals(page)

    // Should have no signals
    expect(signals.length).toBe(0)
  })

  test('devtools API should be available', async ({ page }) => {
    const hasEmitEvent = await page.evaluate(() => {
      return typeof window.__denlabsEmitEvent === 'function'
    })

    const hasExportSignals = await page.evaluate(() => {
      return typeof window.__denlabsExportSignals === 'function'
    })

    expect(hasEmitEvent).toBe(true)
    expect(hasExportSignals).toBe(true)
  })

  test('should emit via devtools API', async ({ page }) => {
    // Clear existing signals
    await clearStoredSignals(page)

    // Emit via devtools API
    await page.evaluate(async () => {
      await window.__denlabsEmitEvent?.({
        type: 'DV_SESSION_STARTED',
        id: 'test_evt_001',
        session_id: 'test_ses_001',
        wallet_id: 'test_wallet',
        client: 'extension',
        app_version: '1.0.2',
        os: 'test',
        env: 'test',
        ts: new Date().toISOString(),
      })
    })

    // Wait for async storage
    await page.waitForTimeout(200)

    const signals = await getStoredSignals(page)

    expect(signals.length).toBeGreaterThan(0)
    const testSignal = signals.find(
      (s: unknown) =>
        typeof s === 'object' &&
        s !== null &&
        'id' in s &&
        (s as { id: string }).id === 'sig_test_evt_001'
    )
    expect(testSignal).toBeDefined()
  })

  test('signals should accumulate across actions', async ({ page }) => {
    // Clear existing signals
    await clearStoredSignals(page)

    // Emit multiple events
    await page.evaluate(async () => {
      const baseEvent = {
        session_id: 'test_ses',
        wallet_id: 'test_wallet',
        client: 'extension',
        app_version: '1.0.2',
        os: 'test',
        env: 'test',
        ts: new Date().toISOString(),
      }

      await window.__denlabsEmitEvent?.({
        ...baseEvent,
        id: 'evt_1',
        type: 'DV_SESSION_STARTED',
      })
      await window.__denlabsEmitEvent?.({
        ...baseEvent,
        id: 'evt_2',
        type: 'DV_WALLET_CREATED',
      })
      await window.__denlabsEmitEvent?.({
        ...baseEvent,
        id: 'evt_3',
        type: 'DV_WALLET_UNLOCKED',
      })
    })

    // Wait for async storage
    await page.waitForTimeout(500)

    const signals = await getStoredSignals(page)

    expect(signals.length).toBe(3)
  })

  test('should validate signals against DenSignal schema', async ({ page }) => {
    await page.waitForTimeout(500)

    const signals = await getStoredSignals(page)
    expect(signals.length).toBeGreaterThan(0)

    for (const signal of signals) {
      const s = signal as {
        version: string
        id: string
        ts: string
        source: { kind: string; system: string }
        subject: { type: string; id: string }
        action: { name: string }
      }

      // Required fields
      expect(s.version).toBe('0.1')
      expect(typeof s.id).toBe('string')
      expect(s.id.length).toBeGreaterThanOrEqual(8)
      expect(typeof s.ts).toBe('string')

      // Source
      expect(['onchain', 'offchain']).toContain(s.source.kind)
      expect(typeof s.source.system).toBe('string')
      expect(s.source.system.length).toBeGreaterThanOrEqual(2)

      // Subject
      expect([
        'tx',
        'address',
        'contract',
        'batch',
        'session',
        'user',
      ]).toContain(s.subject.type)
      expect(typeof s.subject.id).toBe('string')
      expect(s.subject.id.length).toBeGreaterThanOrEqual(4)

      // Action
      expect(typeof s.action.name).toBe('string')
      expect(s.action.name.length).toBeGreaterThanOrEqual(2)
    }
  })
})

test.describe('DenLabs Signal Export', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/?denlabs=1')
    await setupSnapshotMode(page)
    await enableDenlabsDevtools(page)
    await page.reload()
    await page.waitForLoadState('domcontentloaded')
  })

  test('export function should be available', async ({ page }) => {
    const hasExport = await page.evaluate(() => {
      return typeof window.__denlabsExportSignals === 'function'
    })

    expect(hasExport).toBe(true)
  })

  // Note: Testing actual file download requires more complex setup
  // This test verifies the function exists and can be called
  test('export should not throw', async ({ page }) => {
    const didThrow = await page.evaluate(async () => {
      try {
        // Mock the download by temporarily overriding createElement
        const originalCreateElement = document.createElement.bind(document)
        document.createElement = ((tagName: string) => {
          if (tagName === 'a') {
            return {
              click: () => {},
              href: '',
              download: '',
            } as unknown as HTMLAnchorElement
          }
          return originalCreateElement(tagName)
        }) as typeof document.createElement

        await window.__denlabsExportSignals?.()

        document.createElement = originalCreateElement
        return false
      } catch {
        return true
      }
    })

    expect(didThrow).toBe(false)
  })
})
