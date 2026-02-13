import type { DenSignal } from './densignal-schema'
import { DenSignalSchema } from './densignal-schema'

export const DEN_SIGNAL_STORAGE_KEY = 'denlabs_densignals_v01'

type StorageArea = {
  get: (keys: string | string[]) => Promise<Record<string, unknown>>
  set: (items: Record<string, unknown>) => Promise<void>
}

const getStorage = (): StorageArea => {
  // Use chrome.storage.local in extension context
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    const storage = chrome.storage.local
    return {
      get: (keys) =>
        new Promise((resolve, reject) => {
          try {
            storage.get(keys, (result) => resolve(result))
          } catch (error) {
            reject(error)
          }
        }),
      set: (items) =>
        new Promise((resolve, reject) => {
          try {
            storage.set(items, () => resolve())
          } catch (error) {
            reject(error)
          }
        }),
    }
  }

  // Fallback to localStorage for dev server / test environments
  if (typeof localStorage !== 'undefined') {
    return {
      get: async (keys) => {
        const keyList = Array.isArray(keys) ? keys : [keys]
        const result: Record<string, unknown> = {}
        for (const key of keyList) {
          const stored = localStorage.getItem(key)
          if (stored) {
            try {
              result[key] = JSON.parse(stored)
            } catch {
              result[key] = stored
            }
          }
        }
        return result
      },
      set: async (items) => {
        for (const [key, value] of Object.entries(items)) {
          localStorage.setItem(key, JSON.stringify(value))
        }
      },
    }
  }

  throw new Error('No storage backend available')
}

export const readDenSignals = async (): Promise<DenSignal[]> => {
  const storage = getStorage()
  const result = await storage.get(DEN_SIGNAL_STORAGE_KEY)
  const stored = result[DEN_SIGNAL_STORAGE_KEY]
  if (!stored) return []

  if (!Array.isArray(stored)) {
    throw new Error('Invalid denlabs_densignals_v01 payload')
  }

  return stored.map((item) => DenSignalSchema.parse(item))
}

export const writeDenSignals = async (signals: DenSignal[]): Promise<void> => {
  const storage = getStorage()
  await storage.set({ [DEN_SIGNAL_STORAGE_KEY]: signals })
}

export const emitDenSignal = async (input: unknown): Promise<void> => {
  const signal = DenSignalSchema.parse(input)
  const existing = await readDenSignals()
  await writeDenSignals([...existing, signal])
}

export const downloadDenSignalsJson = async (): Promise<void> => {
  const signals = await readDenSignals()
  const payload = JSON.stringify(signals, null, 2)
  const blob = new Blob([payload], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'densignals_v01.json'
  anchor.click()

  URL.revokeObjectURL(url)
}
