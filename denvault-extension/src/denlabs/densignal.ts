import type { DenSignal } from './densignal-schema'
import { DenSignalSchema } from './densignal-schema'
import { emitDenSignal } from './storage'

export const emitValidatedDenSignal = async (input: unknown): Promise<void> => {
  const signal = DenSignalSchema.parse(input)
  await emitDenSignal(signal)
}

export type { DenSignal }
