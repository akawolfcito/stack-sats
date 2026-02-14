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
import { detectAddressType, type BtcAddressType } from './validation';

// Initialize ECC library for bitcoinjs-lib
// @ts-expect-error - bitcoin is a global variable injected by bitcoinjs-lib.js
bitcoin.initEccLib(ecc);

/**
 * Mempool.space API URLs
 */
const MEMPOOL_URLS: Record<NetworkName, string> = {
  mainnet: 'https://mempool.space/api',
  testnet: 'https://mempool.space/testnet/api',
  devnet: 'https://mempool.space/testnet/api', // Devnet uses testnet for BTC
};

/**
 * Get the Mempool API URL for the specified network
 */
function getMempoolUrl(network?: NetworkName): string {
  const selectedNetwork = network || getSelectedNetwork();
  return MEMPOOL_URLS[selectedNetwork];
}

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
  const apiUrl = getMempoolUrl(network);
  const url = `${apiUrl}/address/${address}/utxo`;

  try {
    const response = await fetch(url);

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
export async function estimateFees(network?: NetworkName): Promise<FeeEstimate> {
  const apiUrl = getMempoolUrl(network);
  const url = `${apiUrl}/v1/fees/recommended`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch fees: ${response.status}`);
    }

    const data = await response.json();
    secureLog('BTC fees fetched', data);
    return data as FeeEstimate;
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
  inputType: BtcAddressType = 'p2pkh'
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

  // Output sizes (approximate)
  const outputSizes: Record<BtcAddressType, number> = {
    p2pkh: 34,
    p2sh: 32,
    p2wpkh: 31,
    p2tr: 43,
    unknown: 34,
  };

  const inputSize = inputSizes[inputType] || inputSizes.p2pkh;
  const avgOutputSize = 34; // Average across types

  return Math.ceil(overhead + inputCount * inputSize + outputCount * avgOutputSize);
}

/**
 * Calculate required fee in satoshis
 */
export function calculateFee(
  inputCount: number,
  outputCount: number,
  feeRate: number,
  inputType: BtcAddressType = 'p2pkh'
): number {
  const vBytes = estimateTxSize(inputCount, outputCount, inputType);
  return Math.ceil(vBytes * feeRate);
}

/**
 * Select UTXOs to cover the amount + fee
 * Uses simple "largest first" selection strategy
 */
export function selectUtxos(
  utxos: UTXO[],
  targetAmount: number,
  feeRate: number,
  inputType: BtcAddressType = 'p2pkh'
): { selected: UTXO[]; fee: number; change: number } | null {
  // Sort by value descending
  const sorted = [...utxos].sort((a, b) => b.value - a.value);

  const selected: UTXO[] = [];
  let totalInput = 0;

  for (const utxo of sorted) {
    selected.push(utxo);
    totalInput += utxo.value;

    // Calculate fee with current inputs (2 outputs: recipient + change)
    const fee = calculateFee(selected.length, 2, feeRate, inputType);
    const required = targetAmount + fee;

    if (totalInput >= required) {
      const change = totalInput - targetAmount - fee;

      // Check if change is dust (< 546 sats for legacy, < 294 for segwit)
      const dustThreshold = inputType === 'p2pkh' ? 546 : 294;

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

  // Determine primary input type for fee estimation
  const primaryType = allUtxos[0]?.type || 'p2pkh';

  // Select UTXOs
  const selection = selectUtxos(
    allUtxos.map((item) => item.utxo),
    amountSats,
    feeRate,
    primaryType
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

    // Fetch the raw transaction to get the scriptPubKey
    const rawTxHex = await fetchRawTransaction(selectedUtxo.txid, network);

    if (utxoInfo.type === 'p2pkh') {
      // Legacy P2PKH input
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
      address: senderP2PKH, // Send change back to P2PKH address
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
      // Taproot signing (Schnorr)
      psbt.signInput(i, {
        publicKey: publicKey.slice(1), // x-only pubkey
        sign: (hash: Buffer) => Buffer.from(ecc.signSchnorr(hash, privateKey)),
      });
    } else {
      // ECDSA signing for P2PKH and P2WPKH
      // @ts-expect-error - ECPair from bitcoin is a global
      const keyPair = bitcoin.ECPair.fromPrivateKey(privateKey, { network: btcNetwork });
      psbt.signInput(i, keyPair);
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
  const apiUrl = getMempoolUrl(network);
  const url = `${apiUrl}/tx/${txid}/hex`;

  const response = await fetch(url);
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
  const apiUrl = getMempoolUrl(network);
  const url = `${apiUrl}/tx`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
      },
      body: txHex,
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
  let privateKey: Buffer | null = params.privateKey;

  try {
    secureLog('Starting BTC transfer', {
      recipient: params.recipient.slice(0, 8) + '...',
      amount: params.amountSats,
      network: params.network,
    });

    // Build and sign the transaction
    const { txHex, txid: localTxid } = await buildAndSignTransaction(params);

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
      errorMessage = 'Amount is too small (dust). Minimum amount is ~546 satoshis.';
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
    // Clear sensitive data
    privateKey = null;
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
    return { success: false, sats: 0, error: 'Amount is too small (dust threshold is 546 sats)' };
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
