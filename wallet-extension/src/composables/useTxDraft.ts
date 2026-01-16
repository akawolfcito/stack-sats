/**
 * useTxDraft - V52.2 Single Source of Truth for Transaction Draft
 *
 * This composable manages the transaction draft state across views:
 * - SendView (form) → sets draft
 * - ConfirmTxView → reads draft
 * - SendView (confirm/PIN) → reads draft
 * - TxResultView → reads draft + result
 *
 * V52.2 Changes:
 * - Formalized step: form | confirmTx | confirmPin | submitting | result
 * - Formalized status: idle | pending | confirmed | error
 * - Explicit state transitions with guards
 * - Anti double-submit via isSubmitting computed
 *
 * Avoids query params for sensitive data (amount, recipient).
 * Provides guards for incomplete drafts.
 */
import { reactive, computed, readonly } from "vue";
import type { NetworkName } from "@/utils/network";

/**
 * V52.2: Formalized step states
 */
export type TxStep = "form" | "confirmTx" | "confirmPin" | "submitting" | "result";

/**
 * V52.2: Formalized status states
 */
export type TxStatus = "idle" | "pending" | "confirmed" | "error";

/**
 * Transaction draft state
 */
export interface TxDraft {
  // Sender info
  senderAddress: string;
  senderAddressShort: string;
  accountName: string;
  accountIndex: number;

  // Recipient info
  recipient: string;
  recipientShort: string;

  // Amounts (formatted strings for display)
  amount: string; // Raw input value
  amountDisplay: string; // Formatted: "1.5 STX"
  feeDisplay: string; // Formatted: "0.01 STX"
  totalDisplay: string; // Formatted: "1.51 STX"

  // Amounts (micro STX for calculations)
  amountMicroStx: bigint;

  // Optional
  memo: string;

  // Network
  network: NetworkName;
  networkLabel: string;

  // V52.2: Formalized flow states
  step: TxStep;
  status: TxStatus;

  // Result (set after broadcast)
  txid: string;
  error: string;
}

/**
 * Initial empty draft
 */
function createEmptyDraft(): TxDraft {
  return {
    senderAddress: "",
    senderAddressShort: "",
    accountName: "",
    accountIndex: 0,
    recipient: "",
    recipientShort: "",
    amount: "",
    amountDisplay: "",
    feeDisplay: "",
    totalDisplay: "",
    amountMicroStx: BigInt(0),
    memo: "",
    network: "devnet",
    networkLabel: "Devnet",
    step: "form",
    status: "idle",
    txid: "",
    error: "",
  };
}

// Singleton state - persists across component instances
const state = reactive<TxDraft>(createEmptyDraft());

/**
 * useTxDraft composable
 */
export function useTxDraft() {
  /**
   * Set draft data from SendView form
   */
  function setDraft(data: Partial<TxDraft>) {
    Object.assign(state, data);
  }

  /**
   * V52.2: Explicit transition to confirmTx step
   * Guards: must have valid amount and recipient
   */
  function transitionToConfirmTx(): boolean {
    if (state.recipient.trim() === "" || state.amountMicroStx <= BigInt(0)) {
      return false;
    }
    state.step = "confirmTx";
    state.status = "idle";
    return true;
  }

  /**
   * V52.2: Explicit transition to confirmPin step
   * Guards: must be in confirmTx step
   */
  function transitionToConfirmPin(): boolean {
    if (state.step !== "confirmTx") {
      return false;
    }
    state.step = "confirmPin";
    state.status = "idle";
    return true;
  }

  /**
   * V52.2: Explicit transition to submitting step
   * Guards: must be in confirmPin step, prevents double-submit
   */
  function transitionToSubmitting(): boolean {
    if (state.step !== "confirmPin" || state.status === "pending") {
      return false; // Anti double-submit
    }
    state.step = "submitting";
    state.status = "pending";
    return true;
  }

  /**
   * V52.2: Set transaction result (success)
   * Transition to result step with pending status (waiting for confirmation)
   */
  function setResult(txid: string) {
    state.txid = txid;
    state.error = "";
    state.step = "result";
    state.status = "pending"; // Will transition to confirmed via polling
  }

  /**
   * V52.2: Mark transaction as confirmed (after polling)
   */
  function setConfirmed() {
    state.status = "confirmed";
  }

  /**
   * V52.2: Set transaction error
   */
  function setError(error: string) {
    state.txid = "";
    state.error = error;
    state.step = "result";
    state.status = "error";
  }

  /**
   * V52.2: Go back to form (cancel/edit)
   */
  function transitionToForm() {
    state.step = "form";
    state.status = "idle";
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
   * V52.2: Check if currently submitting (anti double-submit)
   */
  const isSubmitting = computed(() => {
    return state.step === "submitting" || state.status === "pending";
  });

  /**
   * Check if draft has required fields for confirm-tx step
   */
  const isValidForConfirmTx = computed(() => {
    return (
      state.recipient.trim() !== "" &&
      state.amountMicroStx > BigInt(0) &&
      state.senderAddress.trim() !== ""
    );
  });

  /**
   * Check if draft has required fields for confirm-pin step
   */
  const isValidForConfirmPin = computed(() => {
    return isValidForConfirmTx.value && state.step === "confirmPin";
  });

  /**
   * Check if can submit (in confirmPin step and not already submitting)
   */
  const canSubmit = computed(() => {
    return state.step === "confirmPin" && state.status === "idle";
  });

  /**
   * Check if draft has result data
   */
  const hasResult = computed(() => {
    return state.step === "result" && (state.txid !== "" || state.error !== "");
  });

  /**
   * Check if result is success (has txid)
   */
  const isSuccess = computed(() => {
    return state.txid !== "" && state.error === "";
  });

  /**
   * Check if result is error
   */
  const isError = computed(() => {
    return state.error !== "";
  });

  /**
   * Check if result is confirmed
   */
  const isConfirmed = computed(() => {
    return state.status === "confirmed";
  });

  /**
   * Check if result is still pending
   */
  const isPending = computed(() => {
    return state.step === "result" && state.status === "pending";
  });

  return {
    // State (readonly to prevent direct mutation)
    draft: readonly(state),

    // V52.2: Explicit transitions
    transitionToConfirmTx,
    transitionToConfirmPin,
    transitionToSubmitting,
    transitionToForm,
    setResult,
    setConfirmed,
    setError,
    clearDraft,

    // Legacy mutations (for compatibility)
    setDraft,
    setStep: (step: TxStep) => { state.step = step; },

    // V52.2: Computed guards
    isSubmitting,
    canSubmit,
    isValidForConfirmTx,
    isValidForConfirmPin,
    hasResult,
    isSuccess,
    isError,
    isConfirmed,
    isPending,
  };
}

/**
 * Helper to truncate address (8...8 format)
 */
export function truncateAddress(address: string): string {
  if (!address || address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}
