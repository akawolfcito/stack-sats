import { DenSignalSchema } from './densignal-schema'
import type { DenSignal } from './densignal-schema'
import type { DenVaultEvent } from './denvault-events'
import { isTxEvent } from './denvault-events'

const subjectFromEvent = (event: DenVaultEvent) => {
  if (event.type.startsWith('DV_SESSION')) {
    return { type: 'session' as const, id: event.session_id }
  }

  if (event.type.startsWith('DV_WALLET')) {
    return { type: 'user' as const, id: event.wallet_id }
  }

  return { type: 'tx' as const, id: event.id }
}

const stageFromEvent = (event: DenVaultEvent) => {
  if (event.type === 'DV_TX_SIGN_REQUESTED') return 'attempt' as const
  if (event.type === 'DV_TX_SIGN_RESULT') {
    if (event.result === 'approved') return 'success' as const
    return 'failure' as const
  }
  return undefined
}

export const mapDenVaultEventToDenSignal = (
  event: DenVaultEvent,
): DenSignal => {
  const signal: DenSignal = {
    version: '0.1',
    id: `sig_${event.id}`,
    ts: event.ts,
    source: {
      kind: 'offchain',
      system: 'denvault',
      adapter: 'denvault-app-v0',
    },
    subject: subjectFromEvent(event),
    action: {
      name: event.type.toLowerCase(),
      stage: stageFromEvent(event),
    },
    context: {
      correlationId: event.session_id,
      chain: isTxEvent(event)
        ? {
            family: event.tx_family,
            network: event.chain_id,
          }
        : undefined,
    },
    measures: {
      latencyMs: isTxEvent(event) ? event.latency_ms : undefined,
    },
    tags: [
      `client:${event.client}`,
      `app:${event.app_version}`,
      `os:${event.os}`,
      `env:${event.env}`,
    ],
  }

  return DenSignalSchema.parse(signal)
}

export const mapDenVaultEventsToDenSignals = (
  events: DenVaultEvent[],
): DenSignal[] => events.map(mapDenVaultEventToDenSignal)
