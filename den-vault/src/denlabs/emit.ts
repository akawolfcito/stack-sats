/**
 * DenLabs Signal Emission Module
 *
 * Central module for emitting DenVault events as DenSignals.
 * Used by wallet components to emit events automatically.
 *
 * Flag control: Set localStorage.denlabs_manual_only = '1' to disable
 * automatic emission (useful for SDK integration tests).
 */

import type { DenVaultEvent } from './denvault-events'
import { mapDenVaultEventToDenSignal } from './mapping'
import { emitDenSignal } from './storage'

const MANUAL_ONLY_KEY = 'denlabs_manual_only'

/**
 * Check if automatic emission is enabled
 */
const shouldEmit = (): boolean => {
  if (typeof localStorage === 'undefined') return false
  return localStorage.getItem(MANUAL_ONLY_KEY) !== '1'
}

/**
 * Generate a unique event ID
 */
const generateEventId = (): string => {
  return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * Get current session ID (or generate one)
 */
let currentSessionId: string | null = null

export const getSessionId = (): string => {
  if (!currentSessionId) {
    currentSessionId = `ses_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
  }
  return currentSessionId
}

export const resetSessionId = (): void => {
  currentSessionId = null
}

/**
 * Get common event fields
 */
const getBaseFields = (walletId?: string): Omit<DenVaultEvent, 'type'> => ({
  id: generateEventId(),
  session_id: getSessionId(),
  wallet_id: walletId ?? 'unknown',
  client: 'extension',
  app_version: '1.0.2',
  os: navigator.platform || 'unknown',
  env: import.meta.env.DEV ? 'dev' : 'prod',
  ts: new Date().toISOString(),
})

/**
 * Emit a DenVault event (if automatic emission is enabled)
 */
export const emitEvent = async (event: DenVaultEvent): Promise<void> => {
  if (!shouldEmit()) return

  try {
    const signal = mapDenVaultEventToDenSignal(event)
    await emitDenSignal(signal)
  } catch (error) {
    // Silent fail - don't break wallet functionality
    console.warn('[DenLabs] Failed to emit event:', error)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Emitters (typed helpers for each event type)
// ─────────────────────────────────────────────────────────────────────────────

export const emitSessionStarted = async (): Promise<void> => {
  await emitEvent({
    ...getBaseFields(),
    type: 'DV_SESSION_STARTED',
  })
}

export const emitSessionEnded = async (
  reason: 'normal' | 'crash' = 'normal',
): Promise<void> => {
  await emitEvent({
    ...getBaseFields(),
    type: 'DV_SESSION_ENDED',
    end_reason: reason,
  })
}

export const emitWalletCreated = async (walletId: string): Promise<void> => {
  await emitEvent({
    ...getBaseFields(walletId),
    type: 'DV_WALLET_CREATED',
  })
}

export const emitWalletImported = async (walletId: string): Promise<void> => {
  await emitEvent({
    ...getBaseFields(walletId),
    type: 'DV_WALLET_IMPORTED',
  })
}

export const emitWalletLocked = async (walletId?: string): Promise<void> => {
  await emitEvent({
    ...getBaseFields(walletId),
    type: 'DV_WALLET_LOCKED',
  })
}

export const emitWalletUnlocked = async (walletId: string): Promise<void> => {
  await emitEvent({
    ...getBaseFields(walletId),
    type: 'DV_WALLET_UNLOCKED',
  })
}

export const emitTxSignRequested = async (
  walletId: string,
  chainId: string,
  txFamily: 'evm' | 'stacks' | 'other',
  requestOrigin: string,
): Promise<{ eventId: string; startTime: number }> => {
  const eventId = generateEventId()
  const startTime = Date.now()

  await emitEvent({
    ...getBaseFields(walletId),
    id: eventId,
    type: 'DV_TX_SIGN_REQUESTED',
    chain_id: chainId,
    tx_family: txFamily,
    request_origin: requestOrigin,
    latency_ms: 0,
  })

  return { eventId, startTime }
}

export const emitTxSignResult = async (
  walletId: string,
  chainId: string,
  txFamily: 'evm' | 'stacks' | 'other',
  requestOrigin: string,
  result: 'approved' | 'rejected' | 'failed',
  startTime: number,
  failureCode?: string,
): Promise<void> => {
  const latencyMs = Date.now() - startTime

  await emitEvent({
    ...getBaseFields(walletId),
    type: 'DV_TX_SIGN_RESULT',
    chain_id: chainId,
    tx_family: txFamily,
    request_origin: requestOrigin,
    result,
    latency_ms: latencyMs,
    failure_code: failureCode,
  })
}
