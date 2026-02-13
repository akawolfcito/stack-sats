/**
 * Unit tests for DenLabs emit module
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  emitSessionStarted,
  emitSessionEnded,
  emitWalletCreated,
  emitWalletImported,
  emitWalletLocked,
  emitWalletUnlocked,
  emitTxSignRequested,
  emitTxSignResult,
  getSessionId,
  resetSessionId,
} from './emit'

// Mock chrome.storage.local
let storedSignals: unknown[] = []

beforeEach(() => {
  // Reset stored signals
  storedSignals = []

  // Mock chrome.storage.local.get to return stored signals
  vi.mocked(chrome.storage.local.get).mockImplementation(
    (_keys, callback?: (result: Record<string, unknown>) => void) => {
      const result = { denlabs_densignals_v01: [...storedSignals] }
      if (callback) {
        callback(result)
      }
      return Promise.resolve(result)
    }
  )

  // Mock chrome.storage.local.set to capture stored signals
  vi.mocked(chrome.storage.local.set).mockImplementation(
    (items, callback?: () => void) => {
      const signals = items.denlabs_densignals_v01 as unknown[]
      if (signals) {
        storedSignals = [...signals]
      }
      if (callback) {
        callback()
      }
      return Promise.resolve()
    }
  )

  // Clear localStorage
  localStorage.clear()

  // Reset session ID between tests
  resetSessionId()
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('flag control', () => {
  it('should NOT emit when denlabs_manual_only is set', async () => {
    localStorage.setItem('denlabs_manual_only', '1')

    await emitSessionStarted()

    expect(chrome.storage.local.set).not.toHaveBeenCalled()
  })

  it('should emit when denlabs_manual_only is NOT set', async () => {
    await emitSessionStarted()

    expect(chrome.storage.local.set).toHaveBeenCalled()
    expect(storedSignals).toHaveLength(1)
  })

  it('should emit when denlabs_manual_only is removed', async () => {
    localStorage.setItem('denlabs_manual_only', '1')
    await emitSessionStarted()
    expect(storedSignals).toHaveLength(0)

    localStorage.removeItem('denlabs_manual_only')
    await emitSessionStarted()
    expect(storedSignals).toHaveLength(1)
  })
})

describe('session management', () => {
  it('should generate consistent session ID within same session', () => {
    const id1 = getSessionId()
    const id2 = getSessionId()

    expect(id1).toBe(id2)
    expect(id1).toMatch(/^ses_\d+_[a-z0-9]+$/)
  })

  it('should generate new session ID after reset', () => {
    const id1 = getSessionId()
    resetSessionId()
    const id2 = getSessionId()

    expect(id1).not.toBe(id2)
  })
})

describe('emitSessionStarted', () => {
  it('should emit DV_SESSION_STARTED signal', async () => {
    await emitSessionStarted()

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { action: { name: string } }
    expect(signal.action.name).toBe('dv_session_started')
  })
})

describe('emitSessionEnded', () => {
  it('should emit DV_SESSION_ENDED signal with normal reason', async () => {
    await emitSessionEnded('normal')

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { action: { name: string } }
    expect(signal.action.name).toBe('dv_session_ended')
  })

  it('should emit DV_SESSION_ENDED signal with crash reason', async () => {
    await emitSessionEnded('crash')

    expect(storedSignals).toHaveLength(1)
  })
})

describe('emitWalletCreated', () => {
  it('should emit DV_WALLET_CREATED signal', async () => {
    await emitWalletCreated('wallet_123')

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as {
      action: { name: string }
      subject: { type: string; id: string }
    }
    expect(signal.action.name).toBe('dv_wallet_created')
    expect(signal.subject.type).toBe('user')
    expect(signal.subject.id).toBe('wallet_123')
  })
})

describe('emitWalletImported', () => {
  it('should emit DV_WALLET_IMPORTED signal', async () => {
    await emitWalletImported('wallet_456')

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { action: { name: string } }
    expect(signal.action.name).toBe('dv_wallet_imported')
  })
})

describe('emitWalletLocked', () => {
  it('should emit DV_WALLET_LOCKED signal', async () => {
    await emitWalletLocked('wallet_789')

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { action: { name: string } }
    expect(signal.action.name).toBe('dv_wallet_locked')
  })

  it('should emit with unknown wallet if not provided', async () => {
    await emitWalletLocked()

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { subject: { id: string } }
    expect(signal.subject.id).toBe('unknown')
  })
})

describe('emitWalletUnlocked', () => {
  it('should emit DV_WALLET_UNLOCKED signal', async () => {
    await emitWalletUnlocked('wallet_abc')

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { action: { name: string } }
    expect(signal.action.name).toBe('dv_wallet_unlocked')
  })
})

describe('emitTxSignRequested', () => {
  it('should emit DV_TX_SIGN_REQUESTED signal', async () => {
    const result = await emitTxSignRequested(
      'wallet_tx',
      'stacks-mainnet',
      'stacks',
      'https://app.example.com'
    )

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as {
      action: { name: string; stage: string }
      context: { chain: { family: string } }
    }
    expect(signal.action.name).toBe('dv_tx_sign_requested')
    expect(signal.action.stage).toBe('attempt')
    expect(signal.context.chain.family).toBe('stacks')

    expect(result.eventId).toMatch(/^evt_\d+_[a-z0-9]+$/)
    expect(result.startTime).toBeGreaterThan(0)
  })
})

describe('emitTxSignResult', () => {
  it('should emit DV_TX_SIGN_RESULT approved signal', async () => {
    const startTime = Date.now() - 100

    await emitTxSignResult(
      'wallet_tx',
      'stacks-mainnet',
      'stacks',
      'https://app.example.com',
      'approved',
      startTime
    )

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as {
      action: { name: string; stage: string }
      measures: { latencyMs: number }
    }
    expect(signal.action.name).toBe('dv_tx_sign_result')
    expect(signal.action.stage).toBe('success')
    expect(signal.measures.latencyMs).toBeGreaterThanOrEqual(100)
  })

  it('should emit DV_TX_SIGN_RESULT rejected signal', async () => {
    const startTime = Date.now()

    await emitTxSignResult(
      'wallet_tx',
      'stacks-mainnet',
      'stacks',
      'https://app.example.com',
      'rejected',
      startTime,
      'User cancelled'
    )

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { action: { stage: string } }
    expect(signal.action.stage).toBe('failure')
  })

  it('should emit DV_TX_SIGN_RESULT failed signal with failure code', async () => {
    const startTime = Date.now()

    await emitTxSignResult(
      'wallet_tx',
      'stacks-mainnet',
      'stacks',
      'https://app.example.com',
      'failed',
      startTime,
      'NETWORK_ERROR'
    )

    expect(storedSignals).toHaveLength(1)
    const signal = storedSignals[0] as { action: { stage: string } }
    expect(signal.action.stage).toBe('failure')
  })
})

describe('signal accumulation', () => {
  it('should accumulate signals in storage', async () => {
    await emitSessionStarted()
    await emitWalletCreated('wallet_test_001')
    await emitWalletUnlocked('wallet_test_001')

    expect(storedSignals).toHaveLength(3)
  })
})

describe('error handling', () => {
  it('should not throw when mapping fails', async () => {
    // Emit with invalid data that will fail Zod validation
    // The emit function catches errors silently
    await emitWalletCreated('x') // Too short, will fail validation

    // Test passes if no exception thrown
    // (error is caught and logged internally)
    expect(true).toBe(true)
  })
})
