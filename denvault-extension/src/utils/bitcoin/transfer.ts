/**
 * Bitcoin Transfer Module
 *
 * Handles building, signing, and broadcasting Bitcoin transactions.
 * Uses Mempool.space API for UTXO fetching, fee estimation, and broadcasting.
 *
 * Supports:
 * - P2PKH (Legacy) inputs/outputs
 * - P2WPKH (Native SegWit) inputs/outputs
 * - P2TR (Taproot) inputs/outputs
 */

import { Buffer } from 'buffer';
import ecc from '@bitcoinerlab/secp256k1';
import { getSelectedNetwork, type NetworkName } from '../network';
import { secureLog } from '../security/logger';
import { esploraFetch } from './endpoints';
import { detectAddressType, type BtcAddressType } from './validation';

// Initialize ECC library for bitcoinjs-lib
// @ts-expect-error - bitcoin is a global variable injected by bitcoinjs-lib.js
bitcoin.initEccLib(ecc);

/**
 * Get the bitcoinjs-lib network object
 */
function getBitcoinNetwork(network?: NetworkName) {
  const selectedNetwork = network || getSelectedNetwork();
  // @ts-expect-error - bitcoin is a global variable injected by bitcoinjs-lib.js
  return selectedNetwork === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;
}

/**
 * UTXO (Unspent Transaction Output)
 */
export interface UTXO {
  txid: string;
  vout: number;
  value: number; // in satoshis
  status: {
    confirmed: boolean;
    block_height?: number;
    block_hash?: string;
    block_time?: number;
  };
}

/**
 * Fee rates from Mempool.space (sat/vB)
 */
export interface FeeEstimate {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
  minimumFee: number;
}

/**
 * Fee level selection
 */
export type FeeLevel = 'fast' | 'medium' | 'slow';

/**
 * Transfer parameters
 */
export interface BtcTransferParams {
  /** Recipient Bitcoin address */
  recipient: string;
  /** Amount to send in satoshis */
  amountSats: number;
  /** Fee rate in sat/vB */
  feeRate: number;
  /** Sender's P2PKH address (for change) */
  senderP2PKH: string;
  /** Sender's P2TR address (optional, for Taproot inputs) */
  senderP2TR?: string;
  /** Private key (Buffer) for signing */
  privateKey: Buffer;
  /** Public key (Buffer) for deriving addresses */
  publicKey: Buffer;
  /** Network */
  network: NetworkName;
}

/**
 * Transfer result
 */
export interface BtcTransferResult {
  success: boolean;
  txid?: string;
  error?: string;
}

/**
 * Fetch UTXOs for a Bitcoin address
 */
export async function fetchUtxos(
  address: string,
  network?: NetworkName
): Promise<UTXO[]> {
  const selectedNetwork = network || getSelectedNetwork();

  try {
    const response = await esploraFetch(`/address/${address}/utxo`, {
      network: selectedNetwork,
    });

    if (!response.ok) {
      if (response.status === 400) {
        // Address not found or invalid - return empty
        secureLog('BTC UTXO fetch: address not found', { address: address.slice(0, 8) + '...' });
        return [];
      }
      throw new Error(`Failed to fetch UTXOs: ${response.status}`);
    }

    const data = await response.json();
    secureLog('BTC UTXOs fetched', { address: address.slice(0, 8) + '...', count: data.length });
    return data as UTXO[];
  } catch (error) {
    secureLog('BTC UTXO fetch error', { error: String(error) });
    return [];
  }
}

/**
 * Fetch UTXOs for multiple addresses and combine them
 */
export async function fetchCombinedUtxos(
  addresses: string[],
  network?: NetworkName
): Promise<{ address: string; utxos: UTXO[] }[]> {
  const results = await Promise.all(
    addresses.map(async (address) => ({
      address,
      utxos: await fetchUtxos(address, network),
    }))
  );
  return results;
}

/**
 * Estimate fees from Mempool.space
 */
/**
 * Turn Esplora's confirmation-target map into the levels the UI offers.
 *
 * Esplora answers `{ "1": 12.3, "6": 5, "144": 1.1 }`, keyed by target in
 * blocks. The ladder is not guaranteed: blockstream's testnet publishes
 * only 144, 504 and 1008, so every level has to degrade to the best
 * estimate that exists rather than assume a key is there.
 *
 * `/v1/fees/recommended`, which this used to call, is mempool.space's own
 * shape and does not exist on the standard Esplora API.
 */
export function feeEstimateFromEsplora(
  estimates: Record<string, number>
): FeeEstimate {
  const targets = Object.keys(estimates)
    .map(Number)
    .filter((target) => Number.isFinite(target))
    .sort((a, b) => a - b);

  if (targets.length === 0) {
    throw new Error('Fee estimates were empty');
  }

  const rateFor = (target: number): number => {
    // The most economical target that still confirms this soon, or the
    // fastest published when nothing is that fast.
    const withinTarget = targets.filter((candidate) => candidate <= target);
    const chosen = withinTarget.length > 0 ? withinTarget[withinTarget.length - 1] : targets[0];
    // Esplora answers in full float precision, and 17.730999999999998
    // reached the fee selector verbatim. Rounded up, never down, so
    // tidying the number can never underpay a transaction.
    const rate = Math.ceil(estimates[String(chosen)] * 100) / 100;
    return Math.max(1, rate);
  };

  return {
    fastestFee: rateFor(1),
    halfHourFee: rateFor(3),
    hourFee: rateFor(6),
    economyFee: rateFor(144),
    minimumFee: rateFor(1008),
  };
}

export async function estimateFees(network?: NetworkName): Promise<FeeEstimate> {
  const selectedNetwork = network || getSelectedNetwork();

  try {
    const response = await esploraFetch('/fee-estimates', {
      network: selectedNetwork,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch fees: ${response.status}`);
    }

    const data = (await response.json()) as Record<string, number>;
    const fees = feeEstimateFromEsplora(data);
    secureLog('BTC fees fetched', fees);
    return fees;
  } catch (error) {
    secureLog('BTC fee fetch error', { error: String(error) });
    // Return conservative defaults
    return {
      fastestFee: 50,
      halfHourFee: 25,
      hourFee: 10,
      economyFee: 5,
      minimumFee: 1,
    };
  }
}

/**
 * Get fee rate for a given level
 */
export function getFeeRateForLevel(fees: FeeEstimate, level: FeeLevel): number {
  switch (level) {
    case 'fast':
      return fees.fastestFee;
    case 'medium':
      return fees.halfHourFee;
    case 'slow':
      return fees.hourFee;
    default:
      return fees.halfHourFee;
  }
}

/**
 * Estimate transaction size in virtual bytes (vB)
 * This is a simplified estimation - actual size may vary slightly
 */
export function estimateTxSize(
  inputCount: number,
  outputCount: number,
  inputType: BtcAddressType = 'p2pkh',
  outputTypes?: BtcAddressType[]
): number {
  // Base transaction overhead
  const overhead = 10;

  // Input sizes by type (approximate)
  const inputSizes: Record<BtcAddressType, number> = {
    p2pkh: 148,    // Legacy
    p2sh: 91,      // Script hash (SegWit wrapped)
    p2wpkh: 68,    // Native SegWit
    p2tr: 57.5,    // Taproot (key path)
    unknown: 148,  // Default to legacy
  };

  const inputSize = inputSizes[inputType] || inputSizes.p2pkh;

  /**
   * Output sizes by type: 8 bytes of value, 1 of script length, then the
   * script itself.
   *
   * A previous comment here called 34 "the largest of the common types" and
   * used it for every output. That is wrong, and it cost real money: a
   * Taproot output is 43 vB. Paying to a tb1p address therefore
   * underestimated the transaction, and on 2026-08-17 the wallet paid
   * 255.66 sat/vB against the 264.71 it had told the user it was paying.
   *
   * Unknown falls to the largest, so an unrecognised address overpays
   * instead of sitting in the mempool.
   */
  const outputSizes: Record<BtcAddressType, number> = {
    p2pkh: 34,     // 8 + 1 + 25
    p2sh: 32,      // 8 + 1 + 23
    p2wpkh: 31,    // 8 + 1 + 22
    p2tr: 43,      // 8 + 1 + 34
    unknown: 43,
  };

  // Callers that do not know their output types keep the old flat estimate,
  // which is correct whenever every output is legacy.
  const outputsSize = outputTypes
    ? outputTypes.reduce((total, type) => total + (outputSizes[type] ?? outputSizes.unknown), 0)
    : outputCount * outputSizes.p2pkh;

  return Math.ceil(overhead + inputCount * inputSize + outputsSize);
}

/**
 * Calculate required fee in satoshis
 */
export function calculateFee(
  inputCount: number,
  outputCount: number,
  feeRate: number,
  inputType: BtcAddressType = 'p2pkh',
  outputTypes?: BtcAddressType[]
): number {
  const vBytes = estimateTxSize(inputCount, outputCount, inputType, outputTypes);
  return Math.ceil(vBytes * feeRate);
}

/**
 * Below these values an output costs more to spend than it holds, and the
 * network will not relay it. Keyed by the output's own script type.
 */
const DUST_THRESHOLDS: Record<BtcAddressType, number> = {
  p2pkh: 546,
  p2sh: 540,
  p2wpkh: 294,
  p2tr: 330,
  unknown: 546,
};

/**
 * Select UTXOs to cover the amount + fee
 * Uses simple "largest first" selection strategy
 */
export function selectUtxos(
  utxos: UTXO[],
  targetAmount: number,
  feeRate: number,
  inputType: BtcAddressType = 'p2pkh',
  /** Recipient and change, in that order, when the caller knows them. */
  outputTypes?: BtcAddressType[]
): { selected: UTXO[]; fee: number; change: number } | null {
  // Sort by value descending
  const sorted = [...utxos].sort((a, b) => b.value - a.value);

  const selected: UTXO[] = [];
  let totalInput = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalInput += utxo.value;

    // Calculate fee with current inputs (2 outputs: recipient + change)
    const fee = calculateFee(selected.length, 2, feeRate, inputType, outputTypes);
    const required = targetAmount + fee;

    if (totalInput >= required) {
      const change = totalInput - targetAmount - fee;

      /**
       * Dust is a property of the output being created, not of the input
       * being spent, and the two stopped agreeing once change began
       * following the input type. A Taproot output is dust below 330 sats,
       * so the old 294 would have built one the network refuses to relay.
       *
       * Callers that do not say where the change is going keep the previous
       * input-based guess, which is what every existing test asserts.
       */
      const changeType = outputTypes?.[1];
      const dustThreshold = changeType
        ? DUST_THRESHOLDS[changeType]
        : inputType === 'p2pkh'
          ? 546
          : 294;

      if (change > 0 && change < dustThreshold) {
        // Add dust to fee instead
        return { selected, fee: fee + change, change: 0 };
      }

      return { selected, fee, change };
    }
  }

  // Not enough funds
  return null;
}

/**
 * Build and sign a Bitcoin transaction using PSBT
 */
export async function buildAndSignTransaction(
  params: BtcTransferParams
): Promise<{ txHex: string; txid: string }> {
  const { recipient, amountSats, feeRate, senderP2PKH, senderP2TR, privateKey, publicKey, network } =
    params;

  const btcNetwork = getBitcoinNetwork(network);

  // Fetch UTXOs from both addresses
  const addresses = [senderP2PKH];
  if (senderP2TR) {
    addresses.push(senderP2TR);
  }

  const utxoResults = await fetchCombinedUtxos(addresses, network);

  // Flatten UTXOs with their source address info
  const allUtxos: { utxo: UTXO; address: string; type: BtcAddressType }[] = [];

  for (const result of utxoResults) {
    const addrType = detectAddressType(result.address, network);
    for (const utxo of result.utxos) {
      // Only include confirmed UTXOs
      if (utxo.status.confirmed) {
        allUtxos.push({ utxo, address: result.address, type: addrType });
      }
    }
  }

  if (allUtxos.length === 0) {
    throw new Error('No confirmed UTXOs available');
  }

  // Calculate total available
  const totalAvailable = allUtxos.reduce((sum, item) => sum + item.utxo.value, 0);

  /**
   * Primary input type for the fee estimate: the type of the largest UTXO,
   * because selectUtxos sorts by value and takes that one first.
   *
   * This used to read allUtxos[0], which is merely the first address queried,
   * and the legacy address is queried first. So spending a Taproot UTXO was
   * costed as if it were legacy, 148 vB against 57.5. On 2026-08-17 that
   * turned a 265 sat/vB request into 440 paid, which the explorer flagged as
   * overpaying by 66%.
   */
  const largestUtxo = [...allUtxos].sort((a, b) => b.utxo.value - a.utxo.value)[0];
  const primaryType = largestUtxo?.type || 'p2pkh';

  /**
   * Change returns to the type it was spent from.
   *
   * It used to go to the legacy address unconditionally, so every Taproot
   * send quietly migrated the remainder to P2PKH. That charged the user
   * twice: a legacy input costs 148 vB to spend later against 57.5, and it
   * silently undid the address format they had chosen in Receive.
   *
   * This wallet has no internal change chain, so the change lands on an
   * address the user already uses. Reusing it is a privacy cost that a
   * proper BIP-32 change branch would remove, but sending it to the wrong
   * script type was a cost on top of that one, not a substitute for it.
   */
  const changeAddress =
    primaryType === 'p2tr' && senderP2TR ? senderP2TR : senderP2PKH;

  const outputTypes: BtcAddressType[] = [
    detectAddressType(recipient, network),
    detectAddressType(changeAddress, network),
  ];

  // Select UTXOs
  const selection = selectUtxos(
    allUtxos.map((item) => item.utxo),
    amountSats,
    feeRate,
    primaryType,
    outputTypes
  );

  if (!selection) {
    throw new Error(
      `Insufficient funds. Available: ${satoshisToBtc(totalAvailable)} BTC, ` +
        `Required: ~${satoshisToBtc(amountSats + calculateFee(allUtxos.length, 2, feeRate, primaryType))} BTC`
    );
  }

  // Create PSBT
  // @ts-expect-error - bitcoin is a global variable injected by bitcoinjs-lib.js
  const psbt = new bitcoin.Psbt({ network: btcNetwork });

  // Add inputs
  for (const selectedUtxo of selection.selected) {
    const utxoInfo = allUtxos.find(
      (item) => item.utxo.txid === selectedUtxo.txid && item.utxo.vout === selectedUtxo.vout
    );

    if (!utxoInfo) {
      throw new Error(`UTXO info not found for ${selectedUtxo.txid}:${selectedUtxo.vout}`);
    }

    if (utxoInfo.type === 'p2pkh') {
      // Legacy P2PKH input.
      //
      // Only this branch needs the whole previous transaction: a legacy input
      // is signed over it, while segwit and Taproot inputs carry the amount
      // and script in witnessUtxo. This fetch used to run for every input,
      // so a Taproot send died whenever /tx/{id}/hex was slow or unavailable,
      // waiting on data it was never going to use.
      const rawTxHex = await fetchRawTransaction(selectedUtxo.txid, network);

      psbt.addInput({
        hash: selectedUtxo.txid,
        index: selectedUtxo.vout,
        nonWitnessUtxo: Buffer.from(rawTxHex, 'hex'),
      });
    } else if (utxoInfo.type === 'p2wpkh') {
      // Native SegWit input
      // @ts-expect-error - bitcoin is a global variable
      const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: publicKey,
        network: btcNetwork,
      });
      psbt.addInput({
        hash: selectedUtxo.txid,
        index: selectedUtxo.vout,
        witnessUtxo: {
          script: p2wpkh.output!,
          value: selectedUtxo.value,
        },
      });
    } else if (utxoInfo.type === 'p2tr') {
      // Taproot input
      const internalPubKey = publicKey.slice(1); // Remove prefix byte for x-only pubkey
      // @ts-expect-error - bitcoin is a global variable
      const p2tr = bitcoin.payments.p2tr({
        internalPubkey: internalPubKey,
        network: btcNetwork,
      });
      psbt.addInput({
        hash: selectedUtxo.txid,
        index: selectedUtxo.vout,
        witnessUtxo: {
          script: p2tr.output!,
          value: selectedUtxo.value,
        },
        tapInternalKey: internalPubKey,
      });
    }
  }

  // Add recipient output
  psbt.addOutput({
    address: recipient,
    value: amountSats,
  });

  // Add change output if there's change
  if (selection.change > 0) {
    psbt.addOutput({
      address: changeAddress, // Same script type the inputs came from
      value: selection.change,
    });
  }

  // Sign all inputs
  for (let i = 0; i < selection.selected.length; i++) {
    const utxoInfo = allUtxos.find(
      (item) =>
        item.utxo.txid === selection.selected[i].txid &&
        item.utxo.vout === selection.selected[i].vout
    );

    if (utxoInfo?.type === 'p2tr') {
      // Key-path Taproot spend.
      //
      // Two things were wrong here and neither could ever have produced a
      // valid signature: the signer offered `sign` where the library calls
      // `signSchnorr`, and it signed with the raw private key. A key-path
      // spend signs with the tweaked key, and the parity of the internal
      // point decides whether the scalar is negated first.
      const internalPubKey = publicKey.subarray(1); // x-only
      const evenKey =
        publicKey[0] === 3 ? Buffer.from(ecc.privateNegate(privateKey)) : privateKey;
      // @ts-expect-error - bitcoin is a global variable
      const tapTweak = bitcoin.crypto.taggedHash('TapTweak', internalPubKey);
      const tweakedKey = Buffer.from(ecc.privateAdd(evenKey, tapTweak)!);

      psbt.signInput(i, {
        publicKey: Buffer.from(ecc.pointFromScalar(tweakedKey, true)!).subarray(1),
        signSchnorr: (hash: Buffer) => Buffer.from(ecc.signSchnorr(hash, tweakedKey)),
      });
    } else {
      // ECDSA signing for P2PKH and P2WPKH.
      //
      // This used to call bitcoin.ECPair.fromPrivateKey(). ECPair left
      // bitcoinjs-lib in v6 and moved to its own package, so on the real
      // bundle that read `fromPrivateKey` off undefined and every Bitcoin
      // send died there, one PIN after the user had approved it. The unit
      // test did not catch it because the mocked `bitcoin` global carried
      // an ECPair the library has not shipped for years.
      //
      // Same signer shape the Taproot branch above already used: PSBT only
      // needs a public key and something that can sign a hash.
      psbt.signInput(i, {
        publicKey,
        sign: (hash: Buffer) => Buffer.from(ecc.sign(hash, privateKey)),
      });
    }
  }

  // Finalize and extract
  psbt.finalizeAllInputs();
  const tx = psbt.extractTransaction();

  return {
    txHex: tx.toHex(),
    txid: tx.getId(),
  };
}

/**
 * Fetch raw transaction hex
 */
async function fetchRawTransaction(txid: string, network?: NetworkName): Promise<string> {
  const selectedNetwork = network || getSelectedNetwork();

  const response = await esploraFetch(`/tx/${txid}/hex`, {
    network: selectedNetwork,
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch raw transaction: ${response.status}`);
  }

  return await response.text();
}

/**
 * Broadcast a signed transaction
 */
export async function broadcastTransaction(
  txHex: string,
  network?: NetworkName
): Promise<string> {
  const selectedNetwork = network || getSelectedNetwork();

  try {
    const response = await esploraFetch('/tx', {
      network: selectedNetwork,
      init: {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: txHex,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Broadcast failed: ${errorText}`);
    }

    const txid = await response.text();
    secureLog('BTC transaction broadcast', { txid });
    return txid;
  } catch (error) {
    secureLog('BTC broadcast error', { error: String(error) });
    throw error;
  }
}

/**
 * Execute a complete BTC transfer
 */
export async function transferBtc(params: BtcTransferParams): Promise<BtcTransferResult> {
  try {
    secureLog('Starting BTC transfer', {
      recipient: params.recipient.slice(0, 8) + '...',
      amount: params.amountSats,
      network: params.network,
    });

    // Build and sign the transaction
    // The locally computed txid is discarded; the broadcast response is
    // the authoritative one.
    const { txHex } = await buildAndSignTransaction(params);

    // Broadcast the transaction
    const txid = await broadcastTransaction(txHex, params.network);

    secureLog('BTC transfer successful', { txid });

    return {
      success: true,
      txid,
    };
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error);
    let errorMessage = rawError;

    // Provide user-friendly error messages
    if (rawError.includes('Insufficient funds')) {
      errorMessage = rawError;
    } else if (rawError.includes('No confirmed UTXOs')) {
      errorMessage = 'No confirmed balance available. Please wait for pending transactions to confirm.';
    } else if (rawError.includes('dust')) {
      errorMessage = 'Amount is too small. The minimum is 0.00000546 BTC (546 sats).';
    } else if (rawError.includes('Network') || rawError.includes('fetch') || rawError.includes('ECONNREFUSED')) {
      errorMessage = `Network error. Please check your connection and try again.`;
    } else if (rawError.includes('Broadcast failed')) {
      errorMessage = `Transaction rejected: ${rawError}`;
    }

    secureLog('BTC transfer failed', {
      error: rawError,
      recipient: params.recipient.slice(0, 8) + '...',
      amount: params.amountSats,
    });

    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Zero the key bytes in place. This previously nulled a local copy of
    // the reference, which cleared nothing: params.privateKey still held
    // the Buffer, and so did the caller's keyPair. Buffer extends
    // Uint8Array, so filling it wipes the bytes the caller shares.
    params.privateKey.fill(0);
  }
}

/**
 * Convert satoshis to BTC
 */
export function satoshisToBtc(sats: number): number {
  return sats / 100_000_000;
}

/**
 * Convert BTC to satoshis
 */
export function btcToSatoshis(btc: number): number {
  return Math.round(btc * 100_000_000);
}

/**
 * Parse BTC amount string to satoshis
 */
export function parseBtcAmount(btcStr: string): { success: boolean; sats: number; error?: string } {
  if (!btcStr || btcStr.trim() === '') {
    return { success: false, sats: 0, error: 'Amount is required' };
  }

  const trimmed = btcStr.trim();

  if (trimmed.startsWith('-')) {
    return { success: false, sats: 0, error: 'Amount cannot be negative' };
  }

  const num = parseFloat(trimmed);
  if (isNaN(num)) {
    return { success: false, sats: 0, error: 'Invalid amount format' };
  }

  if (num <= 0) {
    return { success: false, sats: 0, error: 'Amount must be greater than 0' };
  }

  const sats = btcToSatoshis(num);

  // Check for dust
  if (sats < 546) {
    return {
      success: false,
      sats: 0,
      // "546 sats" means nothing to someone who thinks in BTC, and this is
      // the first wall a new user hits when trying a tiny test amount.
      error: 'Amount is too small. The minimum is 0.00000546 BTC (546 sats)',
    };
  }

  return { success: true, sats };
}

/**
 * Format satoshis for display as BTC
 */
export function formatBtcDisplay(sats: number): string {
  const btc = satoshisToBtc(sats);

  if (btc === 0) return '0';

  // For very small amounts, show more decimals
  if (btc < 0.00001) {
    return btc.toFixed(8).replace(/\.?0+$/, '');
  }

  if (btc < 0.001) {
    return btc.toFixed(6).replace(/\.?0+$/, '');
  }

  // Standard display: up to 8 decimals, trim trailing zeros
  return btc.toFixed(8).replace(/\.?0+$/, '');
}
