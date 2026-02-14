/**
 * Snapshot Mode Composable
 *
 * When VITE_UI_SNAPSHOT=1 is set, this provides:
 * - Fixed balance values (118.20 STX, $0.00 USD)
 * - Disabled refresh timers
 * - Stable timestamps ("Just now")
 * - Mock network state (always Devnet)
 *
 * Usage:
 *   const { isSnapshotMode, mockBalance, mockTimestamp } = useSnapshotMode();
 */

import { computed } from 'vue';

/**
 * Check if we're running in snapshot mode
 */
export const isSnapshotMode = computed(() => {
  return import.meta.env.VITE_UI_SNAPSHOT === '1' ||
         import.meta.env.VITE_UI_SNAPSHOT === 'true';
});

/**
 * Mock balance data for deterministic screenshots
 */
export const SNAPSHOT_MOCK_DATA = {
  // Balance
  stxBalance: '118200000', // 118.20 STX in microSTX
  stxBalanceFormatted: '118.20',
  usdValue: '$0.00',

  // Account
  accountName: 'Account 1',
  accountAddress: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
  accountAddressShort: 'ST2CY5V...RK9AG',

  // Network
  network: 'devnet' as const,
  networkName: 'Devnet',

  // Timestamps
  timestamp: 'Just now',

  // Transactions (mock list - txIds shortened to avoid security scanner false positives)
  transactions: [
    {
      txId: '0x1234...mock-tx-1',
      type: 'token_transfer',
      status: 'success',
      amount: '10000000', // 10 STX
      sender: 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG',
      recipient: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM',
      timestamp: Date.now() - 3600000, // 1 hour ago
    },
    {
      txId: '0xabcd...mock-tx-2',
      type: 'contract_call',
      status: 'pending',
      contractId: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.my-contract',
      functionName: 'transfer',
      timestamp: Date.now() - 300000, // 5 minutes ago
    },
  ],

  // Tokens (mock list)
  tokens: [
    {
      contractId: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM.token-a',
      symbol: 'TOKA',
      name: 'Token A',
      decimals: 6,
      balance: '1000000000',
      formattedBalance: '1,000.00',
    },
  ],
} as const;

/**
 * Composable for snapshot mode utilities
 */
export function useSnapshotMode() {
  /**
   * Get mock balance or real balance based on mode
   */
  function getMockBalance(realBalance: string): string {
    if (isSnapshotMode.value) {
      return SNAPSHOT_MOCK_DATA.stxBalance;
    }
    return realBalance;
  }

  /**
   * Get mock formatted balance or real formatted balance
   */
  function getMockFormattedBalance(realFormatted: string): string {
    if (isSnapshotMode.value) {
      return SNAPSHOT_MOCK_DATA.stxBalanceFormatted;
    }
    return realFormatted;
  }

  /**
   * Get mock timestamp or real timestamp
   */
  function getMockTimestamp(realTimestamp: string): string {
    if (isSnapshotMode.value) {
      return SNAPSHOT_MOCK_DATA.timestamp;
    }
    return realTimestamp;
  }

  /**
   * Check if auto-refresh should be disabled
   */
  function shouldDisableRefresh(): boolean {
    return isSnapshotMode.value;
  }

  return {
    isSnapshotMode,
    mockData: SNAPSHOT_MOCK_DATA,
    getMockBalance,
    getMockFormattedBalance,
    getMockTimestamp,
    shouldDisableRefresh,
  };
}

export default useSnapshotMode;
