/**
 * Bitcoin utilities module
 *
 * Provides balance fetching, formatting, address validation, and transfers
 * for Bitcoin addresses. Uses Mempool.space public API.
 */

// Balance utilities
export {
  fetchBtcAddressInfo,
  fetchBtcBalance,
  fetchCombinedBtcBalance,
  satoshisToBtc,
  formatBtcBalance,
  getBtcExplorerUrl,
  getBtcTxExplorerUrl,
  type BtcAddressInfo,
  type BtcBalance,
} from './balance';

// Address validation
export {
  validateBtcAddress,
  isValidBtcAddress,
  detectAddressType,
  getAddressTypeLabel,
  type BtcAddressType,
  type BtcAddressValidationResult,
} from './validation';

// Transfer utilities
export {
  fetchUtxos,
  fetchCombinedUtxos,
  estimateFees,
  getFeeRateForLevel,
  estimateTxSize,
  calculateFee,
  selectUtxos,
  buildAndSignTransaction,
  broadcastTransaction,
  transferBtc,
  btcToSatoshis,
  parseBtcAmount,
  formatBtcDisplay,
  type UTXO,
  type FeeEstimate,
  type FeeLevel,
  type BtcTransferParams,
  type BtcTransferResult,
} from './transfer';
