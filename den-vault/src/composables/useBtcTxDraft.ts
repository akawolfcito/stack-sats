/**
 * useBtcTxDraft - Bitcoin Transaction Draft State Manager
 *
 * Similar to useTxDraft but specialized for BTC transactions.
 * Manages the transaction draft state across views:
 * - SendBtcView (form) → sets draft
 * - SendBtcView (confirm/PIN) → reads draft
 * - TxResultView → reads draft + result (shared with STX)
 *
 * Includes BTC-specific fields:
 * - UTXOs and selected UTXOs
 * - Fee rate and fee level
 * - Sender P2PKH and P2TR addresses
 */
import { reactive, computed, readonly } from 'vue';
import type { NetworkName } from '@/utils/network';
import type { FeeLevel, UTXO, FeeEstimate } from '@/utils/bitcoin';

/**
 * BTC transaction step states
 */
export type BtcTxStep = 'form' | 'confirmTx' | 'confirmPin' | 'submitting' | 'result';

/**
 * BTC transaction status states
 */
export type BtcTxStatus = 'idle' | 'pending' | 'confirmed' | 'error';

/**
 * BTC Transaction draft state
 */
export interface BtcTxDraft {
  // Sender info
  senderP2PKH: string;
  senderP2TR: string;
  senderAddressShort: string;
  accountName: string;
  accountIndex: number;

  // Recipient info
  recipient: string;
  recipientShort: string;

  // Amounts
  amountBtc: string; // Raw input value (e.g., "0.001")
  amountSats: number; // Amount in satoshis
  amountDisplay: string; // Formatted: "0.001 BTC"

  // Fees
  feeLevel: FeeLevel;
  feeRate: number; // sat/vB
  feeEstimate: FeeEstimate | null;
  feeSats: number; // Total fee in satoshis
  feeDisplay: string; // Formatted: "0.00001 BTC"

  // Total
  totalSats: number;
  totalDisplay: string; // Formatted: "0.00101 BTC"

  // UTXOs
  availableUtxos: UTXO[];
  selectedUtxos: UTXO[];
  totalAvailableSats: number;

  // Network
  network: NetworkName;
  networkLabel: string;

  // Flow states
  step: BtcTxStep;
  status: BtcTxStatus;

  // Result (set after broadcast)
  txid: string;
  error: string;
}

/**
 * Initial empty draft
 */
function createEmptyDraft(): BtcTxDraft {
  return {
    senderP2PKH: '',
    senderP2TR: '',
    senderAddressShort: '',
    accountName: '',
    accountIndex: 0,
    recipient: '',
    recipientShort: '',
    amountBtc: '',
    amountSats: 0,
    amountDisplay: '',
    feeLevel: 'medium',
    feeRate: 0,
    feeEstimate: null,
    feeSats: 0,
    feeDisplay: '',
    totalSats: 0,
    totalDisplay: '',
    availableUtxos: [],
    selectedUtxos: [],
    totalAvailableSats: 0,
    network: 'devnet',
    networkLabel: 'Devnet',
    step: 'form',
    status: 'idle',
    txid: '',
    error: '',
  };
}

// Singleton state - persists across component instances
const state = reactive<BtcTxDraft>(createEmptyDraft());

/**
 * useBtcTxDraft composable
 */
export function useBtcTxDraft() {
  /**
   * Set draft data from SendBtcView form
   */
  function setDraft(data: Partial<BtcTxDraft>) {
    Object.assign(state, data);
  }

  /**
   * Update fee level and recalculate fee
   */
  function setFeeLevel(level: FeeLevel) {
    state.feeLevel = level;
    if (state.feeEstimate) {
      const rates: Record<FeeLevel, number> = {
        fast: state.feeEstimate.fastestFee,
        medium: state.feeEstimate.halfHourFee,
        slow: state.feeEstimate.hourFee,
      };
      state.feeRate = rates[level];
    }
  }

  /**
   * Explicit transition to confirmTx step
   * Guards: must have valid amount and recipient
   */
  function transitionToConfirmTx(): boolean {
    if (state.recipient.trim() === '' || state.amountSats <= 0) {
      return false;
    }
    state.step = 'confirmTx';
    state.status = 'idle';
    return true;
  }

  /**
   * Explicit transition to confirmPin step
   * Guards: must be in confirmTx step
   */
  function transitionToConfirmPin(): boolean {
    if (state.step !== 'confirmTx') {
      return false;
    }
    state.step = 'confirmPin';
    state.status = 'idle';
    return true;
  }

  /**
   * Explicit transition to submitting step
   * Guards: must be in confirmPin step, prevents double-submit
   */
  function transitionToSubmitting(): boolean {
    if (state.step !== 'confirmPin' || state.status === 'pending') {
      return false; // Anti double-submit
    }
    state.step = 'submitting';
    state.status = 'pending';
    return true;
  }

  /**
   * Set transaction result (success)
   * Transition to result step with pending status
   */
  function setResult(txid: string) {
    state.txid = txid;
    state.error = '';
    state.step = 'result';
    state.status = 'pending';
  }

  /**
   * Mark transaction as confirmed
   */
  function setConfirmed() {
    state.status = 'confirmed';
  }

  /**
   * Set transaction error
   */
  function setError(error: string) {
    state.txid = '';
    state.error = error;
    state.step = 'result';
    state.status = 'error';
  }

  /**
   * Go back to form (cancel/edit)
   */
  function transitionToForm() {
    state.step = 'form';
    state.status = 'idle';
    // Keep draft data for editing
  }

  /**
   * Clear draft and reset to initial state
   */
  function clearDraft() {
    Object.assign(state, createEmptyDraft());
  }

  // ==================== Computed Guards ====================

  /**
   * Check if currently submitting (anti double-submit)
   */
  const isSubmitting = computed(() => {
    return state.step === 'submitting' || state.status === 'pending';
  });

  /**
   * Check if draft has required fields for confirm-tx step
   */
  const isValidForConfirmTx = computed(() => {
    return (
      state.recipient.trim() !== '' &&
      state.amountSats > 0 &&
      state.senderP2PKH.trim() !== '' &&
      state.totalAvailableSats >= state.totalSats
    );
  });

  /**
   * Check if draft has required fields for confirm-pin step
   */
  const isValidForConfirmPin = computed(() => {
    return isValidForConfirmTx.value && state.step === 'confirmPin';
  });

  /**
   * Check if can submit (in confirmPin step and not already submitting)
   */
  const canSubmit = computed(() => {
    return state.step === 'confirmPin' && state.status === 'idle';
  });

  /**
   * Check if draft has result data
   */
  const hasResult = computed(() => {
    return state.step === 'result' && (state.txid !== '' || state.error !== '');
  });

  /**
   * Check if result is success (has txid)
   */
  const isSuccess = computed(() => {
    return state.txid !== '' && state.error === '';
  });

  /**
   * Check if result is error
   */
  const isError = computed(() => {
    return state.error !== '';
  });

  /**
   * Check if result is confirmed
   */
  const isConfirmed = computed(() => {
    return state.status === 'confirmed';
  });

  /**
   * Check if result is still pending
   */
  const isPending = computed(() => {
    return state.step === 'result' && state.status === 'pending';
  });

  /**
   * Check if sufficient balance
   */
  const hasSufficientBalance = computed(() => {
    return state.totalAvailableSats >= state.totalSats;
  });

  return {
    // State (readonly to prevent direct mutation)
    draft: readonly(state),

    // Explicit transitions
    transitionToConfirmTx,
    transitionToConfirmPin,
    transitionToSubmitting,
    transitionToForm,
    setResult,
    setConfirmed,
    setError,
    clearDraft,

    // Mutations
    setDraft,
    setFeeLevel,
    setStep: (step: BtcTxStep) => {
      state.step = step;
    },

    // Computed guards
    isSubmitting,
    canSubmit,
    isValidForConfirmTx,
    isValidForConfirmPin,
    hasResult,
    isSuccess,
    isError,
    isConfirmed,
    isPending,
    hasSufficientBalance,
  };
}

/**
 * Helper to truncate address (8...8 format)
 */
export function truncateBtcAddress(address: string): string {
  if (!address || address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}
