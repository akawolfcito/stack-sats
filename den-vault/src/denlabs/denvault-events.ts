export type DenVaultBaseEvent = {
  id: string
  session_id: string
  wallet_id: string
  client: string
  app_version: string
  os: string
  env: string
  ts: string
}

export type DenVaultSessionStarted = DenVaultBaseEvent & {
  type: 'DV_SESSION_STARTED'
}

export type DenVaultSessionEnded = DenVaultBaseEvent & {
  type: 'DV_SESSION_ENDED'
  end_reason: 'normal' | 'crash'
}

export type DenVaultWalletCreated = DenVaultBaseEvent & {
  type: 'DV_WALLET_CREATED'
}

export type DenVaultWalletImported = DenVaultBaseEvent & {
  type: 'DV_WALLET_IMPORTED'
}

export type DenVaultWalletLocked = DenVaultBaseEvent & {
  type: 'DV_WALLET_LOCKED'
}

export type DenVaultWalletUnlocked = DenVaultBaseEvent & {
  type: 'DV_WALLET_UNLOCKED'
}

export type DenVaultTxBase = DenVaultBaseEvent & {
  chain_id: string
  tx_family: 'evm' | 'stacks' | 'other'
  request_origin: string
  latency_ms: number
}

export type DenVaultTxSignRequested = DenVaultTxBase & {
  type: 'DV_TX_SIGN_REQUESTED'
}

export type DenVaultTxSignResult = DenVaultTxBase & {
  type: 'DV_TX_SIGN_RESULT'
  result: 'approved' | 'rejected' | 'failed'
  failure_code?: string
}

export type DenVaultEvent =
  | DenVaultSessionStarted
  | DenVaultSessionEnded
  | DenVaultWalletCreated
  | DenVaultWalletImported
  | DenVaultWalletLocked
  | DenVaultWalletUnlocked
  | DenVaultTxSignRequested
  | DenVaultTxSignResult

export const isTxEvent = (
  event: DenVaultEvent,
): event is DenVaultTxSignRequested | DenVaultTxSignResult =>
  'tx_family' in event && 'chain_id' in event
