/**
 * Tests for Bitcoin transfer utilities
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Use vi.hoisted to create mocks that are available before module evaluation.
// transfer.ts calls bitcoin.initEccLib(ecc) at the top level,
// so the bitcoin global MUST exist before the module loads.
const { mockPsbt } = vi.hoisted(() => {
  const mockPsbt = {
    addInput: vi.fn(),
    addOutput: vi.fn(),
    signInput: vi.fn(),
    finalizeAllInputs: vi.fn(),
    extractTransaction: vi.fn(() => ({
      toHex: () => 'deadbeef01',
      getId: () => 'abc123txid',
    })),
  };

  // Psbt must be a real constructor function (not an arrow fn)
  // because transfer.ts uses `new bitcoin.Psbt(...)`.
  function MockPsbt() {
    return mockPsbt;
  }

  // @ts-expect-error - mock bitcoin global before transfer.ts loads
  globalThis.bitcoin = {
    initEccLib: vi.fn(),
    networks: {
      bitcoin: { messagePrefix: '\x18Bitcoin Signed Message:\n' },
      testnet: { messagePrefix: '\x18Bitcoin Signed Message:\n' },
    },
    Psbt: MockPsbt,
    payments: {
      p2wpkh: vi.fn(() => ({ output: Buffer.alloc(25) })),
      p2tr: vi.fn(() => ({ output: Buffer.alloc(34) })),
    },
    ECPair: {
      fromPrivateKey: vi.fn(() => ({
        publicKey: Buffer.alloc(33),
        sign: vi.fn(() => Buffer.alloc(64)),
      })),
    },
  };

  return { mockPsbt };
});

// Mock dependencies
vi.mock('@bitcoinerlab/secp256k1', () => ({
  default: {
    pointFromScalar: vi.fn(() => Buffer.alloc(33)),
    signSchnorr: vi.fn(() => Buffer.alloc(64)),
  },
}));

vi.mock('../network', () => ({
  getSelectedNetwork: vi.fn(() => 'testnet'),
}));

vi.mock('../security/logger', () => ({
  secureLog: vi.fn(),
}));

import {
  fetchUtxos,
  fetchCombinedUtxos,
  estimateFees,
  getFeeRateForLevel,
  estimateTxSize,
  calculateFee,
  selectUtxos,
  broadcastTransaction,
  buildAndSignTransaction,
  transferBtc,
  satoshisToBtc,
  btcToSatoshis,
  parseBtcAmount,
  formatBtcDisplay,
  type UTXO,
  type FeeEstimate,
} from './transfer';

// --- Test data ---

const FAKE_TXID = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
const FAKE_ADDRESS_P2PKH = 'mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn';
const FAKE_ADDRESS_P2TR = 'tb1p5cyxnuxmeuwuvkwfem96lqzszd02n6xdcjrs20cac6yqjjwudpxq8s5pku';
const FAKE_RECIPIENT = 'n1wgm6Zj6Nkk4vpcgvJLDRwFhE2Eqym27w';

function makeUtxo(value: number, confirmed = true): UTXO {
  return {
    txid: FAKE_TXID,
    vout: 0,
    value,
    status: {
      confirmed,
      block_height: confirmed ? 800000 : undefined,
    },
  };
}

const SAMPLE_FEES: FeeEstimate = {
  fastestFee: 50,
  halfHourFee: 25,
  hourFee: 10,
  economyFee: 5,
  minimumFee: 1,
};

function mockFetchOk(data: unknown, options?: { text?: string }) {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => options?.text ?? JSON.stringify(data),
  });
}

function mockFetchError(status: number, body = 'error') {
  global.fetch = vi.fn().mockResolvedValueOnce({
    ok: false,
    status,
    text: async () => body,
    json: async () => ({ error: body }),
  });
}

function mockFetchReject(message: string) {
  global.fetch = vi.fn().mockRejectedValueOnce(new Error(message));
}

// --- Tests ---

describe('Bitcoin transfer utilities', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    // Reset psbt mock state
    mockPsbt.addInput.mockClear();
    mockPsbt.addOutput.mockClear();
    mockPsbt.signInput.mockClear();
    mockPsbt.finalizeAllInputs.mockClear();
    mockPsbt.extractTransaction.mockClear();
    mockPsbt.extractTransaction.mockReturnValue({
      toHex: () => 'deadbeef01',
      getId: () => 'abc123txid',
    });
  });

  // ----------------------------------------------------------------
  // Pure functions
  // ----------------------------------------------------------------

  describe('satoshisToBtc', () => {
    it('should convert satoshis to BTC', () => {
      expect(satoshisToBtc(100_000_000)).toBe(1);
      expect(satoshisToBtc(50_000_000)).toBe(0.5);
      expect(satoshisToBtc(1)).toBe(0.00000001);
      expect(satoshisToBtc(0)).toBe(0);
    });
  });

  describe('btcToSatoshis', () => {
    it('should convert BTC to satoshis', () => {
      expect(btcToSatoshis(1)).toBe(100_000_000);
      expect(btcToSatoshis(0.5)).toBe(50_000_000);
      expect(btcToSatoshis(0.00000001)).toBe(1);
      expect(btcToSatoshis(0)).toBe(0);
    });

    it('should round to nearest satoshi', () => {
      // 0.000000019 * 1e8 = 1.9 → rounds to 2
      expect(btcToSatoshis(0.000000019)).toBe(2);
      // 0.000000014 * 1e8 = 1.4 → rounds to 1
      expect(btcToSatoshis(0.000000014)).toBe(1);
    });
  });

  describe('estimateTxSize', () => {
    it('should estimate P2PKH transaction size', () => {
      // 10 + 1*148 + 2*34 = 226
      expect(estimateTxSize(1, 2, 'p2pkh')).toBe(226);
    });

    it('should estimate P2WPKH transaction size', () => {
      // 10 + 1*68 + 2*34 = 146
      expect(estimateTxSize(1, 2, 'p2wpkh')).toBe(146);
    });

    it('should estimate P2TR transaction size', () => {
      // 10 + 1*57.5 + 2*34 = 135.5 → ceil = 136
      expect(estimateTxSize(1, 2, 'p2tr')).toBe(136);
    });

    it('should scale with multiple inputs', () => {
      // 10 + 3*148 + 2*34 = 522
      expect(estimateTxSize(3, 2, 'p2pkh')).toBe(522);
    });

    it('should default to p2pkh when no type provided', () => {
      expect(estimateTxSize(1, 2)).toBe(estimateTxSize(1, 2, 'p2pkh'));
    });

    it('should use p2pkh size for unknown type', () => {
      expect(estimateTxSize(1, 2, 'unknown')).toBe(estimateTxSize(1, 2, 'p2pkh'));
    });
  });

  describe('calculateFee', () => {
    it('should calculate fee as size * feeRate', () => {
      const size = estimateTxSize(1, 2, 'p2pkh'); // 226
      expect(calculateFee(1, 2, 10, 'p2pkh')).toBe(Math.ceil(size * 10));
    });

    it('should ceil to nearest satoshi', () => {
      // P2TR: size = 136, rate = 3 → 136*3 = 408 (exact, no ceil needed)
      expect(calculateFee(1, 2, 3, 'p2tr')).toBe(408);
    });

    it('should default to p2pkh', () => {
      expect(calculateFee(1, 2, 10)).toBe(calculateFee(1, 2, 10, 'p2pkh'));
    });
  });

  describe('getFeeRateForLevel', () => {
    it('should return fastestFee for fast', () => {
      expect(getFeeRateForLevel(SAMPLE_FEES, 'fast')).toBe(50);
    });

    it('should return halfHourFee for medium', () => {
      expect(getFeeRateForLevel(SAMPLE_FEES, 'medium')).toBe(25);
    });

    it('should return hourFee for slow', () => {
      expect(getFeeRateForLevel(SAMPLE_FEES, 'slow')).toBe(10);
    });

    it('should default to halfHourFee for unknown level', () => {
      // @ts-expect-error - testing default branch
      expect(getFeeRateForLevel(SAMPLE_FEES, 'unknown')).toBe(25);
    });
  });

  describe('selectUtxos', () => {
    it('should select sufficient UTXOs (single UTXO covers amount + fee)', () => {
      const utxos = [makeUtxo(100_000)];
      const result = selectUtxos(utxos, 50_000, 10, 'p2pkh');
      expect(result).not.toBeNull();
      expect(result!.selected).toHaveLength(1);
      expect(result!.fee).toBeGreaterThan(0);
      expect(result!.change).toBe(100_000 - 50_000 - result!.fee);
    });

    it('should return null when funds are insufficient', () => {
      const utxos = [makeUtxo(1_000)];
      const result = selectUtxos(utxos, 50_000, 10, 'p2pkh');
      expect(result).toBeNull();
    });

    it('should select multiple UTXOs when needed', () => {
      const utxos = [makeUtxo(30_000), makeUtxo(30_000), makeUtxo(30_000)];
      const result = selectUtxos(utxos, 80_000, 1, 'p2pkh');
      expect(result).not.toBeNull();
      expect(result!.selected.length).toBeGreaterThanOrEqual(3);
    });

    it('should sort UTXOs largest first', () => {
      const utxos = [makeUtxo(10_000), makeUtxo(100_000), makeUtxo(50_000)];
      const result = selectUtxos(utxos, 5_000, 1, 'p2pkh');
      expect(result).not.toBeNull();
      // Should pick the 100k UTXO first (largest)
      expect(result!.selected[0].value).toBe(100_000);
    });

    it('should roll dust change into fee (P2PKH dust = 546)', () => {
      const fee = calculateFee(1, 2, 1, 'p2pkh'); // 226 sats
      // total = amount + fee + dust_change (e.g., 500 sats which < 546)
      const utxos = [makeUtxo(50_000 + fee + 500)];
      const result = selectUtxos(utxos, 50_000, 1, 'p2pkh');
      expect(result).not.toBeNull();
      // Dust should be rolled into fee
      expect(result!.change).toBe(0);
      expect(result!.fee).toBe(fee + 500);
    });

    it('should keep change when above dust threshold', () => {
      const fee = calculateFee(1, 2, 1, 'p2pkh'); // 226
      const utxos = [makeUtxo(50_000 + fee + 1_000)];
      const result = selectUtxos(utxos, 50_000, 1, 'p2pkh');
      expect(result).not.toBeNull();
      expect(result!.change).toBe(1_000);
    });

    it('should use lower dust threshold for segwit (294)', () => {
      const fee = calculateFee(1, 2, 1, 'p2wpkh'); // 146
      // Set change to 200 sats < 294 (segwit dust threshold)
      const utxos = [makeUtxo(50_000 + fee + 200)];
      const result = selectUtxos(utxos, 50_000, 1, 'p2wpkh');
      expect(result).not.toBeNull();
      expect(result!.change).toBe(0);
      expect(result!.fee).toBe(fee + 200);
    });

    it('should return zero change when exact amount', () => {
      const fee = calculateFee(1, 2, 1, 'p2pkh');
      const utxos = [makeUtxo(50_000 + fee)];
      const result = selectUtxos(utxos, 50_000, 1, 'p2pkh');
      expect(result).not.toBeNull();
      expect(result!.change).toBe(0);
      expect(result!.fee).toBe(fee);
    });

    it('should handle empty UTXO array', () => {
      const result = selectUtxos([], 50_000, 10, 'p2pkh');
      expect(result).toBeNull();
    });
  });

  describe('parseBtcAmount', () => {
    it('should parse valid BTC amount', () => {
      const result = parseBtcAmount('0.001');
      expect(result.success).toBe(true);
      expect(result.sats).toBe(100_000);
    });

    it('should reject empty string', () => {
      const result = parseBtcAmount('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject whitespace-only string', () => {
      const result = parseBtcAmount('   ');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject negative amount', () => {
      const result = parseBtcAmount('-1');
      expect(result.success).toBe(false);
      expect(result.error).toContain('negative');
    });

    it('should reject zero amount', () => {
      const result = parseBtcAmount('0');
      expect(result.success).toBe(false);
      expect(result.error).toContain('greater than 0');
    });

    it('should reject non-numeric input', () => {
      const result = parseBtcAmount('abc');
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid amount');
    });

    it('should reject dust amounts (< 546 sats)', () => {
      // 0.00000100 = 100 sats (below 546)
      const result = parseBtcAmount('0.000001');
      expect(result.success).toBe(false);
      expect(result.error).toContain('dust');
    });

    it('should accept amounts at dust threshold', () => {
      // 546 sats = 0.00000546 BTC
      const result = parseBtcAmount('0.00000546');
      expect(result.success).toBe(true);
      expect(result.sats).toBe(546);
    });

    it('should handle trimming whitespace', () => {
      const result = parseBtcAmount('  0.001  ');
      expect(result.success).toBe(true);
      expect(result.sats).toBe(100_000);
    });
  });

  describe('formatBtcDisplay', () => {
    it('should return "0" for zero sats', () => {
      expect(formatBtcDisplay(0)).toBe('0');
    });

    it('should format standard amounts trimming trailing zeros', () => {
      expect(formatBtcDisplay(100_000_000)).toBe('1');
      expect(formatBtcDisplay(50_000_000)).toBe('0.5');
    });

    it('should format small amounts (< 0.00001) with 8 decimals', () => {
      // 100 sats = 0.00000100
      expect(formatBtcDisplay(100)).toBe('0.000001');
    });

    it('should format medium-small amounts (< 0.001) with 6 decimals', () => {
      // 10000 sats = 0.00010000
      expect(formatBtcDisplay(10_000)).toBe('0.0001');
    });

    it('should format 1 sat correctly', () => {
      expect(formatBtcDisplay(1)).toBe('0.00000001');
    });
  });

  // ----------------------------------------------------------------
  // Async functions (fetch mocking)
  // ----------------------------------------------------------------

  describe('fetchUtxos', () => {
    it('should return UTXOs on success', async () => {
      const utxos = [makeUtxo(50_000)];
      mockFetchOk(utxos);

      const result = await fetchUtxos(FAKE_ADDRESS_P2PKH, 'testnet');
      expect(result).toEqual(utxos);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/address/${FAKE_ADDRESS_P2PKH}/utxo`)
      );
    });

    it('should return empty array on 400 status', async () => {
      mockFetchError(400);
      const result = await fetchUtxos(FAKE_ADDRESS_P2PKH, 'testnet');
      expect(result).toEqual([]);
    });

    it('should return empty array on network error', async () => {
      mockFetchReject('Network error');
      const result = await fetchUtxos(FAKE_ADDRESS_P2PKH, 'testnet');
      expect(result).toEqual([]);
    });

    it('should return empty array on non-400 error status', async () => {
      mockFetchError(500);
      const result = await fetchUtxos(FAKE_ADDRESS_P2PKH, 'testnet');
      // 500 throws, caught by try/catch → empty array
      expect(result).toEqual([]);
    });

    it('should use testnet URL for devnet', async () => {
      mockFetchOk([]);
      await fetchUtxos(FAKE_ADDRESS_P2PKH, 'devnet');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('mempool.space/testnet/api')
      );
    });

    it('should use mainnet URL for mainnet', async () => {
      mockFetchOk([]);
      await fetchUtxos(FAKE_ADDRESS_P2PKH, 'mainnet');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(/mempool\.space\/api\/address/)
      );
    });
  });

  describe('fetchCombinedUtxos', () => {
    it('should aggregate UTXOs from multiple addresses', async () => {
      const utxos1 = [makeUtxo(10_000)];
      const utxos2 = [makeUtxo(20_000)];

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => utxos1 })
        .mockResolvedValueOnce({ ok: true, json: async () => utxos2 });

      const result = await fetchCombinedUtxos([FAKE_ADDRESS_P2PKH, FAKE_ADDRESS_P2TR], 'testnet');
      expect(result).toHaveLength(2);
      expect(result[0].address).toBe(FAKE_ADDRESS_P2PKH);
      expect(result[0].utxos).toEqual(utxos1);
      expect(result[1].address).toBe(FAKE_ADDRESS_P2TR);
      expect(result[1].utxos).toEqual(utxos2);
    });

    it('should handle empty address list', async () => {
      const result = await fetchCombinedUtxos([], 'testnet');
      expect(result).toEqual([]);
    });
  });

  describe('estimateFees', () => {
    it('should return fee estimates on success', async () => {
      mockFetchOk(SAMPLE_FEES);
      const result = await estimateFees('testnet');
      expect(result).toEqual(SAMPLE_FEES);
    });

    it('should return defaults on error', async () => {
      mockFetchReject('Network error');
      const result = await estimateFees('testnet');
      expect(result.fastestFee).toBe(50);
      expect(result.halfHourFee).toBe(25);
      expect(result.hourFee).toBe(10);
      expect(result.economyFee).toBe(5);
      expect(result.minimumFee).toBe(1);
    });

    it('should return defaults on non-ok response', async () => {
      mockFetchError(503);
      const result = await estimateFees('testnet');
      expect(result.fastestFee).toBe(50);
    });
  });

  describe('broadcastTransaction', () => {
    it('should return txid on success', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        text: async () => 'broadcast_txid_123',
      });

      const result = await broadcastTransaction('deadbeef', 'testnet');
      expect(result).toBe('broadcast_txid_123');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/tx'),
        expect.objectContaining({
          method: 'POST',
          body: 'deadbeef',
        })
      );
    });

    it('should throw on broadcast failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'bad-txns-inputs-missingorspent',
      });

      await expect(broadcastTransaction('deadbeef', 'testnet')).rejects.toThrow(
        'Broadcast failed'
      );
    });

    it('should throw on network error', async () => {
      mockFetchReject('ECONNREFUSED');
      await expect(broadcastTransaction('deadbeef', 'testnet')).rejects.toThrow('ECONNREFUSED');
    });
  });

  describe('buildAndSignTransaction', () => {
    const baseParams = {
      recipient: FAKE_RECIPIENT,
      amountSats: 10_000,
      feeRate: 10,
      senderP2PKH: FAKE_ADDRESS_P2PKH,
      privateKey: Buffer.alloc(32, 1),
      publicKey: Buffer.alloc(33, 2),
      network: 'testnet' as const,
    };

    it('should throw when no confirmed UTXOs available', async () => {
      // Return unconfirmed UTXOs only
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [makeUtxo(100_000, false)],
      });

      await expect(buildAndSignTransaction(baseParams)).rejects.toThrow(
        'No confirmed UTXOs available'
      );
    });

    it('should throw insufficient funds when balance too low', async () => {
      // Return small confirmed UTXO
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [makeUtxo(100, true)],
      });

      await expect(buildAndSignTransaction(baseParams)).rejects.toThrow('Insufficient funds');
    });

    it('should build and sign a P2PKH transaction', async () => {
      // fetchCombinedUtxos → fetchUtxos for senderP2PKH
      // Then fetchRawTransaction for each selected UTXO
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [makeUtxo(100_000, true)],
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'aabbccdd', // raw tx hex
        });

      const result = await buildAndSignTransaction(baseParams);
      expect(result.txHex).toBe('deadbeef01');
      expect(result.txid).toBe('abc123txid');
      expect(mockPsbt.addInput).toHaveBeenCalled();
      expect(mockPsbt.addOutput).toHaveBeenCalled();
      expect(mockPsbt.signInput).toHaveBeenCalled();
      expect(mockPsbt.finalizeAllInputs).toHaveBeenCalled();
    });

    it('should include P2TR address UTXOs when senderP2TR is provided', async () => {
      const params = { ...baseParams, senderP2TR: FAKE_ADDRESS_P2TR };

      // fetchUtxos for P2PKH then P2TR
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [makeUtxo(50_000, true)],
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [makeUtxo(60_000, true)],
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'aabbccdd', // raw tx hex for selected UTXO
        });

      const result = await buildAndSignTransaction(params);
      expect(result.txHex).toBeDefined();
    });
  });

  describe('transferBtc', () => {
    const baseParams = {
      recipient: FAKE_RECIPIENT,
      amountSats: 10_000,
      feeRate: 10,
      senderP2PKH: FAKE_ADDRESS_P2PKH,
      privateKey: Buffer.alloc(32, 1),
      publicKey: Buffer.alloc(33, 2),
      network: 'testnet' as const,
    };

    it('should return success with txid on successful transfer', async () => {
      // fetchUtxos, then fetchRawTx, then broadcastTransaction
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [makeUtxo(100_000, true)],
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'aabbccdd',
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'final_txid_456',
        });

      const result = await transferBtc(baseParams);
      expect(result.success).toBe(true);
      expect(result.txid).toBe('final_txid_456');
    });

    it('should return failure for insufficient funds', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [makeUtxo(100, true)],
      });

      const result = await transferBtc(baseParams);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient funds');
    });

    it('should return failure for no confirmed UTXOs', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [makeUtxo(100_000, false)],
      });

      const result = await transferBtc(baseParams);
      expect(result.success).toBe(false);
      expect(result.error).toContain('pending transactions to confirm');
    });

    it('should return failure with friendly message for no confirmed UTXOs (e.g. from network error)', async () => {
      // fetchUtxos catches network errors internally and returns [],
      // so the actual error seen by transferBtc is "No confirmed UTXOs"
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

      const result = await transferBtc(baseParams);
      expect(result.success).toBe(false);
      expect(result.error).toContain('pending transactions to confirm');
    });

    it('should return failure with broadcast error message', async () => {
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => [makeUtxo(100_000, true)],
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => 'aabbccdd',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          text: async () => 'Broadcast failed: bad-txns',
        });

      const result = await transferBtc(baseParams);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Transaction rejected');
    });

    it('should return failure for no UTXOs at all', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => [],
      });

      const result = await transferBtc(baseParams);
      expect(result.success).toBe(false);
    });
  });
});
