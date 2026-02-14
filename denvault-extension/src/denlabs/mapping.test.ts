/**
 * Unit tests for DenVault → DenSignal mapping
 */
import { describe, it, expect } from 'vitest'
import { mapDenVaultEventToDenSignal, mapDenVaultEventsToDenSignals } from './mapping'
import type { DenVaultEvent } from './denvault-events'

describe('mapDenVaultEventToDenSignal', () => {
  const baseEvent = {
    id: 'evt_12345678',
    session_id: 'ses_abc123',
    wallet_id: 'wallet_xyz',
    client: 'extension',
    app_version: '1.0.2',
    os: 'mac',
    env: 'dev',
    ts: '2026-02-05T12:00:00.000Z',
  }

  describe('session events', () => {
    it('should map DV_SESSION_STARTED correctly', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_SESSION_STARTED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.version).toBe('0.1')
      expect(signal.id).toBe('sig_evt_12345678')
      expect(signal.ts).toBe('2026-02-05T12:00:00.000Z')
      expect(signal.source.kind).toBe('offchain')
      expect(signal.source.system).toBe('denvault')
      expect(signal.source.adapter).toBe('denvault-app-v0')
      expect(signal.subject.type).toBe('session')
      expect(signal.subject.id).toBe('ses_abc123')
      expect(signal.action.name).toBe('dv_session_started')
      expect(signal.action.stage).toBeUndefined()
      expect(signal.tags).toContain('client:extension')
      expect(signal.tags).toContain('app:1.0.2')
    })

    it('should map DV_SESSION_ENDED correctly', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_SESSION_ENDED',
        end_reason: 'normal',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.subject.type).toBe('session')
      expect(signal.action.name).toBe('dv_session_ended')
    })
  })

  describe('wallet events', () => {
    it('should map DV_WALLET_CREATED correctly', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_WALLET_CREATED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.subject.type).toBe('user')
      expect(signal.subject.id).toBe('wallet_xyz')
      expect(signal.action.name).toBe('dv_wallet_created')
    })

    it('should map DV_WALLET_IMPORTED correctly', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_WALLET_IMPORTED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.subject.type).toBe('user')
      expect(signal.action.name).toBe('dv_wallet_imported')
    })

    it('should map DV_WALLET_LOCKED correctly', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_WALLET_LOCKED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.subject.type).toBe('user')
      expect(signal.action.name).toBe('dv_wallet_locked')
    })

    it('should map DV_WALLET_UNLOCKED correctly', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_WALLET_UNLOCKED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.subject.type).toBe('user')
      expect(signal.action.name).toBe('dv_wallet_unlocked')
    })
  })

  describe('transaction events', () => {
    const txBaseEvent = {
      ...baseEvent,
      chain_id: 'stacks-mainnet',
      tx_family: 'stacks' as const,
      request_origin: 'https://app.example.com',
      latency_ms: 150,
    }

    it('should map DV_TX_SIGN_REQUESTED correctly', () => {
      const event: DenVaultEvent = {
        ...txBaseEvent,
        type: 'DV_TX_SIGN_REQUESTED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.subject.type).toBe('tx')
      expect(signal.action.name).toBe('dv_tx_sign_requested')
      expect(signal.action.stage).toBe('attempt')
      expect(signal.context?.chain?.family).toBe('stacks')
      expect(signal.context?.chain?.network).toBe('stacks-mainnet')
      expect(signal.measures?.latencyMs).toBe(150)
    })

    it('should map DV_TX_SIGN_RESULT approved correctly', () => {
      const event: DenVaultEvent = {
        ...txBaseEvent,
        type: 'DV_TX_SIGN_RESULT',
        result: 'approved',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.action.name).toBe('dv_tx_sign_result')
      expect(signal.action.stage).toBe('success')
    })

    it('should map DV_TX_SIGN_RESULT rejected correctly', () => {
      const event: DenVaultEvent = {
        ...txBaseEvent,
        type: 'DV_TX_SIGN_RESULT',
        result: 'rejected',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.action.stage).toBe('failure')
    })

    it('should map DV_TX_SIGN_RESULT failed correctly', () => {
      const event: DenVaultEvent = {
        ...txBaseEvent,
        type: 'DV_TX_SIGN_RESULT',
        result: 'failed',
        failure_code: 'NETWORK_ERROR',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.action.stage).toBe('failure')
    })
  })

  describe('tags', () => {
    it('should include all required tags', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_SESSION_STARTED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.tags).toHaveLength(4)
      expect(signal.tags).toContain('client:extension')
      expect(signal.tags).toContain('app:1.0.2')
      expect(signal.tags).toContain('os:mac')
      expect(signal.tags).toContain('env:dev')
    })
  })

  describe('correlation', () => {
    it('should set correlationId from session_id', () => {
      const event: DenVaultEvent = {
        ...baseEvent,
        type: 'DV_WALLET_CREATED',
      }

      const signal = mapDenVaultEventToDenSignal(event)

      expect(signal.context?.correlationId).toBe('ses_abc123')
    })
  })
})

describe('mapDenVaultEventsToDenSignals', () => {
  it('should map array of events', () => {
    const events: DenVaultEvent[] = [
      {
        id: 'evt_00001',
        session_id: 'ses_00001',
        wallet_id: 'wallet_001',
        client: 'extension',
        app_version: '1.0.2',
        os: 'macos',
        env: 'dev',
        ts: '2026-02-05T12:00:00.000Z',
        type: 'DV_SESSION_STARTED',
      },
      {
        id: 'evt_00002',
        session_id: 'ses_00001',
        wallet_id: 'wallet_001',
        client: 'extension',
        app_version: '1.0.2',
        os: 'macos',
        env: 'dev',
        ts: '2026-02-05T12:01:00.000Z',
        type: 'DV_WALLET_CREATED',
      },
    ]

    const signals = mapDenVaultEventsToDenSignals(events)

    expect(signals).toHaveLength(2)
    expect(signals[0].action.name).toBe('dv_session_started')
    expect(signals[1].action.name).toBe('dv_wallet_created')
  })

  it('should return empty array for empty input', () => {
    const signals = mapDenVaultEventsToDenSignals([])
    expect(signals).toHaveLength(0)
  })
})
