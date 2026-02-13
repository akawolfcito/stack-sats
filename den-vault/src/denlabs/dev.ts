import { downloadDenSignalsJson } from './storage'
import type { DenVaultEvent } from './denvault-events'
import { mapDenVaultEventToDenSignal } from './mapping'
import { emitDenSignal } from './storage'

export const emitDenVaultEvent = async (event: DenVaultEvent) => {
  const signal = mapDenVaultEventToDenSignal(event)
  await emitDenSignal(signal)
}

if (typeof window !== 'undefined') {
  const denlabs = window as unknown as {
    __denlabsExportSignals?: () => Promise<void>
    __denlabsEmitEvent?: (event: DenVaultEvent) => Promise<void>
  }

  denlabs.__denlabsExportSignals = downloadDenSignalsJson
  denlabs.__denlabsEmitEvent = emitDenVaultEvent
}
