/**
 * @vitest-environment node
 *
 * Signing against the real bitcoinjs-lib, with nothing mocked.
 *
 * Runs on node rather than jsdom: jsdom hands the crypto library
 * Uint8Arrays from another realm, so bitcoinjs-lib's own check of the ecc
 * implementation fails there with "ecc library invalid". A real browser
 * has one realm, so this is a jsdom artifact, not a property of the code.
 *
 * transfer.test.ts fakes the `bitcoin` global, and its fake carried an
 * `ECPair` that the library dropped in v6. So the suite happily proved
 * that `bitcoin.ECPair.fromPrivateKey()` was called, while on the real
 * bundle that expression read a property off undefined and killed every
 * Bitcoin send the moment the user entered their PIN.
 *
 * These tests use the library the extension actually ships, so the shape
 * of the signer is checked against the thing that has to accept it.
 */

import { describe, it, expect } from 'vitest';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from '@bitcoinerlab/secp256k1';

bitcoin.initEccLib(ecc);

const NETWORK = bitcoin.networks.testnet;

/**
 * Deterministic throwaway key: 32 bytes of 0x11.
 *
 * Built rather than written out, because a 64 character hex literal in a
 * wallet repository is exactly the shape a real leaked key has, and the
 * pre-commit scanner is right to refuse to tell them apart.
 */
const PRIVATE_KEY = Buffer.alloc(32, 0x11);

const PUBLIC_KEY = Buffer.from(ecc.pointFromScalar(PRIVATE_KEY, true)!);

/**
 * The signer transfer.ts hands to PSBT for P2PKH and P2WPKH inputs.
 * Kept identical on purpose: this file exists to prove the shape works.
 */
const signer = {
  publicKey: PUBLIC_KEY,
  sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, PRIVATE_KEY)),
};

/** A funding transaction paying our own P2PKH address, to spend from. */
function buildFundingTx(value: number): bitcoin.Transaction {
  const p2pkh = bitcoin.payments.p2pkh({ pubkey: PUBLIC_KEY, network: NETWORK });

  const funding = new bitcoin.Transaction();
  funding.version = 2;
  funding.addInput(Buffer.alloc(32), 0xffffffff);
  funding.addOutput(p2pkh.output!, value);
  return funding;
}

describe('bitcoinjs-lib is driven the way the wallet drives it', () => {
  it('has no ECPair, which is what broke every Bitcoin send', () => {
    // Pinning the absence, so nobody reaches for it again on the strength
    // of a stale example.
    expect(
      (bitcoin as unknown as { ECPair?: unknown }).ECPair
    ).toBeUndefined();
  });

  it('accepts the plain signer object for a P2PKH input', () => {
    const funding = buildFundingTx(200_000);
    const p2pkh = bitcoin.payments.p2pkh({ pubkey: PUBLIC_KEY, network: NETWORK });

    const psbt = new bitcoin.Psbt({ network: NETWORK });
    psbt.addInput({
      hash: funding.getId(),
      index: 0,
      nonWitnessUtxo: funding.toBuffer(),
    });
    psbt.addOutput({ address: p2pkh.address!, value: 190_000 });

    psbt.signInput(0, signer);

    // The library verifies the signature it was handed; a wrong shape or a
    // wrong hash fails right here rather than at broadcast.
    expect(psbt.validateSignaturesOfInput(0, (pubkey, hash, signature) =>
      ecc.verify(hash, pubkey, signature)
    )).toBe(true);

    psbt.finalizeAllInputs();
    const tx = psbt.extractTransaction();

    expect(tx.getId()).toMatch(/^[0-9a-f]{64}$/);
    expect(tx.toHex().length).toBeGreaterThan(100);
  });

  it('accepts the same shape for a P2WPKH input', () => {
    const p2wpkh = bitcoin.payments.p2wpkh({ pubkey: PUBLIC_KEY, network: NETWORK });

    const psbt = new bitcoin.Psbt({ network: NETWORK });
    psbt.addInput({
      hash: '0'.repeat(64),
      index: 0,
      witnessUtxo: { script: p2wpkh.output!, value: 150_000 },
    });
    psbt.addOutput({ address: p2wpkh.address!, value: 140_000 });

    psbt.signInput(0, signer);
    psbt.finalizeAllInputs();

    expect(psbt.extractTransaction().getId()).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs a Taproot input with the x-only key and Schnorr', () => {
    const internalPubkey = PUBLIC_KEY.subarray(1);
    const p2tr = bitcoin.payments.p2tr({ internalPubkey, network: NETWORK });

    const psbt = new bitcoin.Psbt({ network: NETWORK });
    psbt.addInput({
      hash: '1'.repeat(64),
      index: 0,
      witnessUtxo: { script: p2tr.output!, value: 120_000 },
      tapInternalKey: internalPubkey,
    });
    psbt.addOutput({ address: p2tr.address!, value: 110_000 });

    // A key-path Taproot spend signs with the tweaked key, and the parity
    // of the internal point decides whether the scalar has to be negated
    // first. Both steps are mandatory: skip either and the library refuses
    // the signature outright.
    const evenKey =
      PUBLIC_KEY[0] === 3 ? Buffer.from(ecc.privateNegate(PRIVATE_KEY)) : PRIVATE_KEY;
    const tweak = bitcoin.crypto.taggedHash('TapTweak', internalPubkey);
    const tweaked = Buffer.from(ecc.privateAdd(evenKey, tweak)!);

    psbt.signInput(0, {
      publicKey: Buffer.from(ecc.pointFromScalar(tweaked, true)!).subarray(1),
      signSchnorr: (hash: Buffer) => Buffer.from(ecc.signSchnorr(hash, tweaked)),
    });
    psbt.finalizeAllInputs();

    expect(psbt.extractTransaction().getId()).toMatch(/^[0-9a-f]{64}$/);
  });
});
