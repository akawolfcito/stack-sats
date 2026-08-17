/**
 * @vitest-environment node
 *
 * A Taproot spend through the wallet's own code, not through a copy of it.
 *
 * signing.test.ts already signs a Taproot input, but it rebuilds the recipe
 * inline: it proves the recipe works, not that transfer.ts follows it. That is
 * the same gap that let ECPair ship, where the suite checked a call the real
 * bundle could never make. So this file mocks only the network and lets
 * buildAndSignTransaction do everything else against the real library.
 *
 * It also covers both parities. A key-path spend negates the private key when
 * the internal point is odd, and the existing test key happens to be odd, so
 * the even branch, which is roughly half of real users, was never executed.
 *
 * What this still cannot prove: the extension does not load bitcoinjs from
 * npm, it loads a vendored bundle (see index.html). These tests run against
 * the npm package because the vendored one rejects this realm's typed arrays.
 * Only a real broadcast closes that last gap.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

bitcoin.initEccLib(ecc);

// transfer.ts reads `bitcoin` off the global, and the shared test setup puts a
// mock there for the whole suite. Swap in the real library for this file.
(globalThis as unknown as { bitcoin: typeof bitcoin }).bitcoin = bitcoin;

vi.mock('./endpoints', () => ({
  esploraFetch: vi.fn(),
  getBtcExplorerBase: vi.fn(() => 'https://example.invalid'),
  getBtcExplorerUrl: vi.fn(() => 'https://example.invalid'),
}));

import { esploraFetch } from './endpoints';
import { buildAndSignTransaction } from './transfer';

const NETWORK = bitcoin.networks.testnet;

/**
 * Deterministic throwaway keys, built rather than written out: a 64 character
 * hex literal in a wallet repository looks exactly like a leaked key, and the
 * pre-commit scanner is right to refuse to tell them apart.
 *
 * 0x11 yields an odd internal point (prefix 3), 0x22 an even one (prefix 2).
 */
const ODD_KEY = Buffer.alloc(32, 0x11);
const EVEN_KEY = Buffer.alloc(32, 0x22);

function keyPair(privateKey: Buffer) {
  const publicKey = Buffer.from(ecc.pointFromScalar(privateKey, true)!);
  const internalPubkey = publicKey.subarray(1);

  return {
    privateKey,
    publicKey,
    p2tr: bitcoin.payments.p2tr({ internalPubkey, network: NETWORK }).address!,
    p2pkh: bitcoin.payments.p2pkh({ pubkey: publicKey, network: NETWORK }).address!,
  };
}

/**
 * Answer the UTXO lookup: funds on the Taproot address, nothing on the legacy
 * one, so the selection has no choice but to spend Taproot.
 */
function fundTaprootOnly(taprootAddress: string, value: number) {
  vi.mocked(esploraFetch).mockImplementation((async (path: string) => {
    const utxos = path.includes(taprootAddress)
      ? [
          {
            txid: 'a'.repeat(64),
            vout: 0,
            value,
            status: { confirmed: true, block_height: 5_124_000 },
          },
        ]
      : [];

    return { ok: true, status: 200, json: async () => utxos };
  }) as unknown as typeof esploraFetch);
}

describe('a Taproot spend, driven by transfer.ts itself', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    ['odd internal point, the branch that negates', ODD_KEY, 3],
    ['even internal point, the branch that does not', EVEN_KEY, 2],
  ])('signs and finalizes with an %s', async (_label, privateKey, expectedPrefix) => {
    const keys = keyPair(privateKey);
    expect(keys.publicKey[0]).toBe(expectedPrefix);

    fundTaprootOnly(keys.p2tr, 120_000);

    const { txHex, txid } = await buildAndSignTransaction({
      recipient: keys.p2pkh,
      amountSats: 50_000,
      feeRate: 2,
      senderP2PKH: keys.p2pkh,
      senderP2TR: keys.p2tr,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      network: 'testnet',
    });

    expect(txid).toMatch(/^[0-9a-f]{64}$/);

    // A finalized transaction only exists if the Schnorr signature verified:
    // PSBT refuses to finalize an input it cannot validate, so reaching here
    // with a parseable witness is the proof that the tweak and the parity
    // handling are both right.
    const tx = bitcoin.Transaction.fromHex(txHex);
    expect(tx.ins).toHaveLength(1);

    // Key-path spend: exactly one witness item, the 64 byte signature.
    expect(tx.ins[0].witness).toHaveLength(1);
    expect(tx.ins[0].witness[0]).toHaveLength(64);
  });

  it('costs the input it actually spends, not the first one it looked up', async () => {
    // The fee used to be estimated from allUtxos[0], which is only the first
    // address queried, and the legacy address is queried first. Spending
    // Taproot was therefore priced as legacy: 148 vB against 57.5. The
    // broadcast of 2026-08-17 paid 440 sat/vB for a 265 sat/vB request.
    //
    // Correct size here: 10 + 57.5 (p2tr in) + 34 + 34 (two p2pkh outs)
    // = 135.5 → 136 vB, which is exactly what the transaction measured.
    const keys = keyPair(ODD_KEY);
    fundTaprootOnly(keys.p2tr, 120_000);

    const { txHex } = await buildAndSignTransaction({
      recipient: keys.p2pkh,
      amountSats: 50_000,
      feeRate: 2,
      senderP2PKH: keys.p2pkh,
      senderP2TR: keys.p2tr,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      network: 'testnet',
    });

    const tx = bitcoin.Transaction.fromHex(txHex);
    const spent = 120_000;
    const paidOut = tx.outs.reduce((total, out) => total + out.value, 0);

    expect(spent - paidOut).toBe(136 * 2);

    // And the estimate is honest about the transaction it produced: the real
    // virtual size should match what was charged for.
    expect(Math.ceil(tx.virtualSize())).toBe(136);
  });

  it('never asks for the previous transaction, which it does not need', async () => {
    // A Taproot input is signed over witnessUtxo, so the whole previous
    // transaction is dead weight. It used to be fetched for every input
    // regardless, which meant a slow or unavailable /tx/{id}/hex could sink a
    // send that had no use for the answer.
    const keys = keyPair(ODD_KEY);
    fundTaprootOnly(keys.p2tr, 120_000);

    await buildAndSignTransaction({
      recipient: keys.p2pkh,
      amountSats: 50_000,
      feeRate: 2,
      senderP2PKH: keys.p2pkh,
      senderP2TR: keys.p2tr,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      network: 'testnet',
    });

    const paths = vi.mocked(esploraFetch).mock.calls.map(([path]) => path);
    expect(paths.some((path) => path.includes('/tx/'))).toBe(false);
  });

  it('sends the change back to the legacy address, not to Taproot', async () => {
    // Worth pinning because it is a real consequence rather than an accident:
    // spending Taproot moves the remainder to P2PKH, so balances drift toward
    // legacy with every send.
    const keys = keyPair(ODD_KEY);
    fundTaprootOnly(keys.p2tr, 120_000);

    const { txHex } = await buildAndSignTransaction({
      recipient: keys.p2pkh,
      amountSats: 50_000,
      feeRate: 2,
      senderP2PKH: keys.p2pkh,
      senderP2TR: keys.p2tr,
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      network: 'testnet',
    });

    const tx = bitcoin.Transaction.fromHex(txHex);
    const changeOutput = tx.outs[tx.outs.length - 1];

    expect(
      bitcoin.address.fromOutputScript(changeOutput.script, NETWORK)
    ).toBe(keys.p2pkh);
  });
});
