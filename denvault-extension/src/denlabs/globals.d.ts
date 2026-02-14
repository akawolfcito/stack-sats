export {}

declare global {
  interface Window {
    __denlabsEmitEvent?: (event: unknown) => Promise<void> | void
    __denlabsExportSignals?: () => Promise<void> | void
  }
}
