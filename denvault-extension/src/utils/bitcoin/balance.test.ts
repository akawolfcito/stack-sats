/**
 * Tests for Bitcoin balance utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../network', () => ({
  getSelectedNetwork: vi.fn(() => 'testnet'),
}));

vi.mock('../security/logger', () => ({
  secureLog: vi.fn(),
}));

import {
  fetchBtcAddressInfo,
  fetchBtcBalance,
  fetchCombinedBtcBalance,
  satoshisToBtc,
  formatBtcBalance,
  getBtcExplorerUrl,
  getBtcTxExplorerUrl,
  type BtcAddressInfo,
} from './balance';

// --- Test data ---

const FAKE_ADDRESS = 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn';
const FAKE_ADDRESS_2 = 'n1wgm6Zj6Nkk4vpcgvJLDRwFhE2Eqym27w';
const FAKE_TXID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

function makeAddressInfo(overrides?: Partial<BtcAddressInfo>): BtcAddressInfo {
  return {
    address: FAKE_ADDRESS,
    chain_stats: {
      funded_txo_count: 5,
      funded_txo_sum: 500_000,
      spent_txo_count: 2,
      spent_txo_sum: 200_000,
      tx_count: 7,
    },
    mempool_stats: {
      funded_txo_count: 1,
      funded_txo_sum: 50_000,
      spent_txo_count: 0,
      spent_txo_sum: 0,
      tx_count: 1,
    },
    ...overrides,
  };
}

function mockFetchOk(data: unknown) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
  });
}

function mockFetchError(status: number) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    json: async () => ({ error: 'error' }),
  });
}

function mockFetchReject(message: string) {
  global.fetch = vi.fn().mockRejectedValueOnce(new Error(message));
}

// --- Tests ---

describe('Bitcoin balance utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  // ----------------------------------------------------------------
  // Pure functions
  // ----------------------------------------------------------------

  describe('satoshisToBtc', () => {
    it('should convert satoshis to BTC', () => {
      expect(satoshisToBtc(100_000_000)).toBe(1);
      expect(satoshisToBtc(0)).toBe(0);
      expect(satoshisToBtc(1)).toBe(0.00000001);
    });
  });

  describe('formatBtcBalance', () => {
    it('should return "0" for zero satoshis', () => {
      expect(formatBtcBalance(0)).toBe('0');
    });

    it('should format standard amounts with trailing zero removal', () => {
      expect(formatBtcBalance(100_000_000)).toBe('1');
      expect(formatBtcBalance(50_000_000)).toBe('0.5');
      expect(formatBtcBalance(150_000_000)).toBe('1.5');
    });

    it('should format very small amounts (< 0.00001 BTC) with 8 decimals', () => {
      // 100 sats = 0.00000100 → trimmed to 0.000001
      expect(formatBtcBalance(100)).toBe('0.000001');
      // 1 sat = 0.00000001
      expect(formatBtcBalance(1)).toBe('0.00000001');
    });

    it('should format small amounts (< 0.001 BTC) with 6 decimals', () => {
      // 10_000 sats = 0.00010000 → trimmed to 0.0001
      expect(formatBtcBalance(10_000)).toBe('0.0001');
    });

    it('should format large amounts (>= 1000 BTC) with 2 decimals', () => {
      // 1000 BTC = 100_000_000_000 sats
      expect(formatBtcBalance(100_000_000_000)).toBe('1000.00');
      // 1500.123 BTC
      expect(formatBtcBalance(150_012_300_000)).toBe('1500.12');
    });

    it('should handle amounts just below 1000 BTC', () => {
      // 999.99 BTC - should use standard formatting
      const sats = 99_999_000_000;
      const result = formatBtcBalance(sats);
      expect(result).toBe('999.99');
    });
  });

  // ----------------------------------------------------------------
  // Async functions
  // ----------------------------------------------------------------

  describe('fetchBtcAddressInfo', () => {
    it('should return address info on success', async () => {
      const info = makeAddressInfo();
      mockFetchOk(info);

      const result = await fetchBtcAddressInfo(FAKE_ADDRESS, 'testnet');
      expect(result).toEqual(info);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/address/${FAKE_ADDRESS}`)
      );
    });

    it('should return null on 400 status (address not found)', async () => {
      mockFetchError(400);
      const result = await fetchBtcAddressInfo(FAKE_ADDRESS, 'testnet');
      expect(result).toBeNull();
    });

    it('should return null on other error status', async () => {
      mockFetchError(500);
      const result = await fetchBtcAddressInfo(FAKE_ADDRESS, 'testnet');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      mockFetchReject('ECONNREFUSED');
      const result = await fetchBtcAddressInfo(FAKE_ADDRESS, 'testnet');
      expect(result).toBeNull();
    });

    it('should use testnet URL for devnet', async () => {
      mockFetchOk(makeAddressInfo());
      await fetchBtcAddressInfo(FAKE_ADDRESS, 'devnet');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('mempool.space/testnet/api')
      );
    });

    it('should use mainnet URL for mainnet', async () => {
      mockFetchOk(makeAddressInfo());
      await fetchBtcAddressInfo(FAKE_ADDRESS, 'mainnet');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/mempool\.space\/api\/address/)
      );
    });
  });

  describe('fetchBtcBalance', () => {
    it('should calculate confirmed balance as funded - spent', async () => {
      mockFetchOk(makeAddressInfo());
      const result = await fetchBtcBalance(FAKE_ADDRESS, 'testnet');
      // confirmed = 500_000 - 200_000 = 300_000
      expect(result.confirmed).toBe(300_000);
    });

    it('should calculate unconfirmed balance from mempool_stats', async () => {
      mockFetchOk(makeAddressInfo());
      const result = await fetchBtcBalance(FAKE_ADDRESS, 'testnet');
      // unconfirmed = 50_000 - 0 = 50_000
      expect(result.unconfirmed).toBe(50_000);
    });

    it('should calculate total as confirmed + unconfirmed', async () => {
      mockFetchOk(makeAddressInfo());
      const result = await fetchBtcBalance(FAKE_ADDRESS, 'testnet');
      expect(result.total).toBe(300_000 + 50_000);
    });

    it('should aggregate tx counts from chain + mempool', async () => {
      mockFetchOk(makeAddressInfo());
      const result = await fetchBtcBalance(FAKE_ADDRESS, 'testnet');
      // 7 + 1 = 8
      expect(result.txCount).toBe(8);
    });

    it('should return zero balance when address info is null', async () => {
      mockFetchError(400); // returns null
      const result = await fetchBtcBalance(FAKE_ADDRESS, 'testnet');
      expect(result.confirmed).toBe(0);
      expect(result.unconfirmed).toBe(0);
      expect(result.total).toBe(0);
      expect(result.txCount).toBe(0);
    });
  });

  describe('fetchCombinedBtcBalance', () => {
    it('should aggregate balances from multiple addresses', async () => {
      const info1 = makeAddressInfo();
      const info2 = makeAddressInfo({
        chain_stats: {
          funded_txo_count: 3,
          funded_txo_sum: 200_000,
          spent_txo_count: 1,
          spent_txo_sum: 100_000,
          tx_count: 4,
        },
        mempool_stats: {
          funded_txo_count: 0,
          funded_txo_sum: 0,
          spent_txo_count: 0,
          spent_txo_sum: 0,
          tx_count: 0,
        },
      });

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => info1 })
        .mockResolvedValueOnce({ ok: true, json: async () => info2 });

      const result = await fetchCombinedBtcBalance([FAKE_ADDRESS, FAKE_ADDRESS_2], 'testnet');
      // addr1: confirmed=300k, unconfirmed=50k, total=350k, tx=8
      // addr2: confirmed=100k, unconfirmed=0, total=100k, tx=4
      expect(result.confirmed).toBe(400_000);
      expect(result.unconfirmed).toBe(50_000);
      expect(result.total).toBe(450_000);
      expect(result.txCount).toBe(12);
    });

    it('should handle one address failing (returns zeros for that address)', async () => {
      const info1 = makeAddressInfo();

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => info1 })
        .mockRejectedValueOnce(new Error('Network error'));

      const result = await fetchCombinedBtcBalance([FAKE_ADDRESS, FAKE_ADDRESS_2], 'testnet');
      // addr1: confirmed=300k, addr2: 0 (error)
      expect(result.confirmed).toBe(300_000);
      expect(result.total).toBe(350_000);
    });

    it('should handle empty address list', async () => {
      const result = await fetchCombinedBtcBalance([], 'testnet');
      expect(result.confirmed).toBe(0);
      expect(result.unconfirmed).toBe(0);
      expect(result.total).toBe(0);
      expect(result.txCount).toBe(0);
    });
  });

  // ----------------------------------------------------------------
  // Explorer URL functions
  // ----------------------------------------------------------------

  describe('getBtcExplorerUrl', () => {
    it('should return mainnet explorer URL', () => {
      const url = getBtcExplorerUrl(FAKE_ADDRESS, 'mainnet');
      expect(url).toBe(`https://mempool.space/address/${FAKE_ADDRESS}`);
    });

    it('should return testnet explorer URL', () => {
      const url = getBtcExplorerUrl(FAKE_ADDRESS, 'testnet');
      expect(url).toBe(`https://mempool.space/testnet/address/${FAKE_ADDRESS}`);
    });

    it('should return testnet URL for devnet', () => {
      const url = getBtcExplorerUrl(FAKE_ADDRESS, 'devnet');
      expect(url).toBe(`https://mempool.space/testnet/address/${FAKE_ADDRESS}`);
    });

    it('should use selected network when no network provided', () => {
      localStorage.setItem('selected_network', 'mainnet');
      // Note: getSelectedNetwork is mocked to return 'testnet', but
      // getBtcExplorerUrl calls the real getSelectedNetwork via the mock
      const url = getBtcExplorerUrl(FAKE_ADDRESS);
      // Since mock returns 'testnet', this should be testnet URL
      expect(url).toContain('testnet');
    });
  });

  describe('getBtcTxExplorerUrl', () => {
    it('should return mainnet tx explorer URL', () => {
      const url = getBtcTxExplorerUrl(FAKE_TXID, 'mainnet');
      expect(url).toBe(`https://mempool.space/tx/${FAKE_TXID}`);
    });

    it('should return testnet tx explorer URL', () => {
      const url = getBtcTxExplorerUrl(FAKE_TXID, 'testnet');
      expect(url).toBe(`https://mempool.space/testnet/tx/${FAKE_TXID}`);
    });

    it('should return testnet URL for devnet', () => {
      const url = getBtcTxExplorerUrl(FAKE_TXID, 'devnet');
      expect(url).toBe(`https://mempool.space/testnet/tx/${FAKE_TXID}`);
    });
  });
});
