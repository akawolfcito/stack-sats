<script setup lang="ts">
/**
 * SendView - V52.3 Confirm Send PIN Premium Pass
 *
 * Single source of truth for tx state via useTxDraft composable.
 * Data flows: SendView → ConfirmTxView → SendView (PIN) → TxResultView
 *
 * V52.3 Changes (Confirm PIN step only):
 * - PIN-first hierarchy: reduced amount dominance, promoted PIN intent
 * - Tighter vertical rhythm: less spacing between card ↔ PIN header ↔ dots
 * - Improved 'To' legibility: secondary color + semibold (not muted)
 * - Error slot uses PinInput V52.3 (fixed height, no layout shift)
 *
 * V52.2 (retained):
 * - Formalized state transitions with guards
 * - Anti double-submit protection
 * - Disabled keypad/back during submission
 * - Premium scaffold with ambient glow + card tokens
 */
import { ref, computed, onBeforeMount, nextTick, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { Button, TextField, InlineAction } from "@/components/ui";
import { sessionManager } from "@/utils/security/session";
import { getPrivateKey } from "@/utils/accounts";
import { getSelectedNetwork, type NetworkName } from "@/utils/network";
import { fetchStxBalance } from "@/utils/balance";
import {
  transferStx,
  validateStxAddressWithError,
  stxToMicroStx,
  microStxToStx,
  formatStxDisplay,
  isValidAmount,
  TRANSFER_FEE_MICRO_STX,
} from "@/utils/transfer";
import { scheduleCleanup } from "@/utils/security/memory";
import { useTxDraft, truncateAddress } from "@/composables/useTxDraft";

const router = useRouter();
const route = useRoute();

// V52.2: Single source of truth with explicit transitions
const {
  draft,
  setDraft,
  transitionToConfirmTx,
  transitionToConfirmPin,
  transitionToSubmitting,
  transitionToForm,
  setResult,
  setError,
  isValidForConfirmTx,
  isSubmitting,
  canSubmit,
} = useTxDraft();

// V52: Steps simplified - sending/success/error now in TxResultView
type Step = "form" | "confirm";
const currentStep = ref<Step>("form");

// Form state (local refs for form input)
const recipient = ref("");
const amount = ref("");
const memo = ref("");

// Account state
const senderAddress = ref("");
const balanceMicroStx = ref("0");
const accountName = ref("");
const network = ref<NetworkName>("devnet");
const accountIndex = ref(0);

// Validation
const recipientError = ref("");
const amountError = ref("");

// PIN
const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);
const pinError = ref("");

// Computed
const formattedBalance = computed(() => formatStxDisplay(microStxToStx(balanceMicroStx.value)));
const formattedFee = computed(() => formatStxDisplay(microStxToStx(TRANSFER_FEE_MICRO_STX)));
const formattedAmount = computed(() => {
  const micro = stxToMicroStx(amount.value);
  return formatStxDisplay(microStxToStx(micro));
});
const formattedTotal = computed(() => {
  const amountMicro = stxToMicroStx(amount.value);
  const total = amountMicro + TRANSFER_FEE_MICRO_STX;
  return formatStxDisplay(microStxToStx(total));
});
// V51.9: Unified address truncation (8...8 format)
const truncatedRecipient = computed(() => {
  return truncateAddress(recipient.value.trim());
});
// V52.2: Renamed to canContinue (form Continue button) to avoid conflict with draft.canSubmit
const canContinue = computed(() => {
  return recipient.value.trim() && amount.value.trim() && !recipientError.value && !amountError.value;
});

const hasZeroBalance = computed(() => {
  const balance = BigInt(balanceMicroStx.value);
  return balance <= TRANSFER_FEE_MICRO_STX;
});

// Modal props
const networkLabel = computed(() => {
  const labels: Record<NetworkName, string> = {
    mainnet: "Mainnet",
    testnet: "Testnet",
    devnet: "Devnet",
  };
  return labels[network.value] || network.value;
});
const senderAddressShort = computed(() => truncateAddress(senderAddress.value));

// Header - V52.2: With submitting state
const headerTitle = computed(() => {
  if (isSubmitting.value) return "Sending...";
  return currentStep.value === "confirm" ? "Confirm Send" : "Send STX";
});
// V52.2: Disable back button during submission
const showBackButton = computed(() => {
  if (isSubmitting.value) return false;
  return currentStep.value === "form" || currentStep.value === "confirm";
});
// V52.2: Check if test/dev network (for chip warning style)
const isTestOrDev = computed(() => {
  const label = networkLabel.value.toLowerCase();
  return label.includes("test") || label.includes("dev");
});

// Load account info
onBeforeMount(async () => {
  if (!sessionManager.hasWallet || sessionManager.isLocked) {
    router.push({ path: "/unlock" });
    return;
  }

  network.value = getSelectedNetwork();

  const savedIndex = localStorage.getItem("selected_account_index");
  accountIndex.value = savedIndex ? parseInt(savedIndex, 10) : 0;

  const walletId = sessionManager.activeWalletId;
  if (walletId) {
    const namesKey = `account_names_${walletId}`;
    const savedNames = localStorage.getItem(namesKey);
    if (savedNames) {
      try {
        const names = JSON.parse(savedNames);
        accountName.value = names[accountIndex.value] || `Account ${accountIndex.value + 1}`;
      } catch {
        accountName.value = `Account ${accountIndex.value + 1}`;
      }
    } else {
      accountName.value = `Account ${accountIndex.value + 1}`;
    }
  }

  const mnemonic = sessionManager.getMnemonic();
  if (mnemonic) {
    const { generateInitialAccounts } = await import("@/utils/accounts");
    const numAccounts = accountIndex.value + 1;
    const accounts = await generateInitialAccounts(mnemonic, numAccounts, network.value);
    if (accounts[accountIndex.value]) {
      senderAddress.value = accounts[accountIndex.value].stxAddress;
    }
  }

  await loadBalance();
});

async function loadBalance() {
  if (!senderAddress.value) return;

  try {
    const result = await fetchStxBalance(senderAddress.value, network.value);
    balanceMicroStx.value = result || "0";
  } catch {
    balanceMicroStx.value = "0";
  }
}

function validateRecipient() {
  recipientError.value = "";
  if (!recipient.value.trim()) {
    return;
  }
  const result = validateStxAddressWithError(recipient.value.trim(), network.value);
  if (!result.valid) {
    recipientError.value = result.error || "Invalid address";
  }
}

function validateAmount() {
  amountError.value = "";
  if (!amount.value.trim()) {
    return;
  }

  const amountMicro = stxToMicroStx(amount.value);
  const balanceMicro = BigInt(balanceMicroStx.value);
  const result = isValidAmount(amountMicro, balanceMicro);

  if (!result.valid) {
    amountError.value = result.error || "Invalid amount";
  }
}

function handleMaxAmount() {
  const balanceMicro = BigInt(balanceMicroStx.value);
  if (balanceMicro <= TRANSFER_FEE_MICRO_STX) {
    amountError.value = "Insufficient balance for fee";
    return;
  }
  const maxAmount = balanceMicro - TRANSFER_FEE_MICRO_STX;
  amount.value = formatStxDisplay(microStxToStx(maxAmount));
  validateAmount();
}

async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    if (text) {
      recipient.value = text.trim();
      validateRecipient();
    }
  } catch (err) {
    console.error("Failed to paste:", err);
  }
}

function handleBack() {
  // V52.2: Prevent back during submission
  if (isSubmitting.value) return;

  if (currentStep.value === "confirm") {
    transitionToForm();
    currentStep.value = "form";
    pinError.value = "";
  } else {
    router.push({ path: "/user" });
  }
}

function handleContinue() {
  validateRecipient();
  validateAmount();

  if (recipientError.value || amountError.value) {
    return;
  }

  // V52.2: Set draft before navigating (single source of truth)
  setDraft({
    senderAddress: senderAddress.value,
    senderAddressShort: senderAddressShort.value,
    accountName: accountName.value,
    accountIndex: accountIndex.value,
    recipient: recipient.value.trim(),
    recipientShort: truncatedRecipient.value,
    amount: amount.value,
    amountDisplay: `${formattedAmount.value} STX`,
    feeDisplay: `${formattedFee.value} STX`,
    totalDisplay: `${formattedTotal.value} STX`,
    amountMicroStx: stxToMicroStx(amount.value),
    memo: memo.value.trim(),
    network: network.value,
    networkLabel: networkLabel.value,
    step: "confirmTx",
    status: "idle",
    txid: "",
    error: "",
  });

  // Use explicit transition
  transitionToConfirmTx();

  // Navigate to fullscreen confirm-tx view
  router.push({ path: "/confirm-tx" });
}

// V52.2: Watch for return from confirm-tx view
watch(
  () => route.query.confirmed,
  (confirmed) => {
    if (confirmed === "true") {
      // V52.2: Guard - validate draft before showing PIN step
      if (!isValidForConfirmTx.value) {
        // Draft is incomplete, redirect to form
        router.replace({ path: "/send", query: { error: "incomplete" } });
        return;
      }

      // User confirmed, proceed to PIN step via explicit transition
      transitionToConfirmPin();
      currentStep.value = "confirm";
      nextTick(() => {
        pinInputRef.value?.focus();
      });
      // Clear query param
      router.replace({ path: "/send", query: {} });
    }
  },
  { immediate: true }
);

async function handlePinComplete(pin: string) {
  pinError.value = "";

  // V52.2: Anti double-submit guard
  if (!canSubmit.value) {
    pinError.value = "Please wait...";
    return;
  }

  const mnemonic = await sessionManager.unlock(pin);
  if (!mnemonic) {
    pinError.value = `Invalid PIN. ${sessionManager.attemptsRemaining} attempts remaining`;
    return;
  }

  // V52.2: Transition to submitting state (prevents double-submit)
  if (!transitionToSubmitting()) {
    pinError.value = "Transaction already in progress.";
    return;
  }

  let privateKey: string | null = null;

  try {
    // V52.2: Use draft data (single source of truth)
    privateKey = await getPrivateKey(mnemonic, draft.accountIndex);

    const result = await transferStx({
      recipient: draft.recipient,
      amountMicroStx: draft.amountMicroStx,
      memo: draft.memo || undefined,
      senderKey: privateKey,
      network: draft.network,
    });

    if (result.success && result.txid) {
      // V52.1: Set result in draft and navigate
      setResult(result.txid);
      router.push({ path: "/tx-result" });
    } else {
      // V52.1: Set error in draft and navigate
      setError(result.error || "Transaction failed");
      router.push({ path: "/tx-result" });
    }
  } catch (error) {
    // V52.1: Set error in draft and navigate
    setError(error instanceof Error ? error.message : "Unknown error");
    router.push({ path: "/tx-result" });
  } finally {
    privateKey = null;
    scheduleCleanup();
  }
}

// V52.1: truncateAddress imported from useTxDraft composable
</script>

<template>
  <ScreenShell :padded="false" data-roi="send-screen">
    <template #header>
      <AppHeader
        :title="headerTitle"
        :left="showBackButton ? 'back' : 'none'"
        data-roi="send-title"
        @left-click="handleBack"
      />
    </template>

    <!-- Step: Form -->
    <div v-if="currentStep === 'form'" class="content" data-roi="send-form">
      <!-- From Account Card -->
      <div class="from-card">
        <div class="from-card-glow"></div>
        <div class="from-card-content">
          <div class="from-card-left">
            <div class="from-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.5">
                <rect x="2" y="5" width="20" height="15" rx="2"/>
                <path d="M2 9h20"/>
              </svg>
            </div>
            <div class="from-info">
              <span class="from-name">{{ accountName }}</span>
              <span class="from-address">{{ truncateAddress(senderAddress) }}</span>
            </div>
          </div>
          <div class="from-balance">
            <span class="balance-value">{{ formattedBalance }}</span>
            <span class="balance-label">AVAILABLE</span>
          </div>
        </div>
      </div>

      <!-- Zero balance warning -->
      <div v-if="hasZeroBalance" class="zero-balance-notice">
        <span class="notice-icon">!</span>
        <span class="notice-text">Your balance is too low to send STX (fee required).</span>
      </div>

      <!-- V49.5: Recipient Input - NO mono in form (reduces visual noise), mono only in confirm/result -->
      <div class="form-group" data-roi="send-textfield-to">
        <label class="form-label">To</label>
        <TextField
          v-model="recipient"
          variant="default"
          placeholder="Address or BNS Name"
          :error="recipientError"
          @blur="validateRecipient"
        >
          <template #suffix>
            <InlineAction label="Paste" variant="ghost" data-roi="send-pill-paste" @click="handlePaste" />
          </template>
        </TextField>
        <p v-if="recipientError" class="form-error" data-roi="send-error-recipient">{{ recipientError }}</p>
      </div>

      <!-- V49.3: Amount Input - MAX matches PASTE with ghost variant for pill parity -->
      <div class="form-group" data-roi="send-textfield-amount">
        <label class="form-label">Amount</label>
        <TextField
          v-model="amount"
          variant="default"
          placeholder="0.00"
          :error="amountError"
          @blur="validateAmount"
        >
          <template #suffix>
            <InlineAction label="Max" variant="ghost" data-roi="send-pill-max" @click="handleMaxAmount" />
          </template>
        </TextField>
        <div class="input-hint-row">
          <p v-if="amountError" class="form-error" data-roi="send-error-amount">{{ amountError }}</p>
          <span v-else class="input-hint">Available: {{ formattedBalance }} STX</span>
        </div>
      </div>

      <!-- V49.1: Memo Input - default variant -->
      <div class="form-group">
        <div class="label-row">
          <label class="form-label">Memo</label>
          <span class="optional-label">Optional</span>
        </div>
        <TextField
          v-model="memo"
          variant="default"
          placeholder="Enter a message to the recipient"
          :maxlength="34"
        />
      </div>

    </div>

    <!-- Sticky Footer (form step only) -->
    <div v-if="currentStep === 'form'" class="sticky-footer" data-roi="send-cta">
      <!-- Fee Card -->
      <div class="fee-card">
        <div class="fee-left">
          <div class="fee-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 22V8a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v14"/>
              <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
              <path d="M15 6h4a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3h-1"/>
              <path d="M15 22v-4"/>
              <circle cx="6" cy="18" r="2"/>
              <circle cx="18" cy="18" r="2"/>
            </svg>
          </div>
          <span class="fee-label">Network Fee</span>
        </div>
        <div class="fee-right">
          <span class="fee-value">{{ formattedFee }} STX</span>
          <span class="fee-type">Standard</span>
        </div>
      </div>

      <!-- Continue Button -->
      <Button
        variant="primary"
        full-width
        :disabled="!canContinue"
        @click="handleContinue"
      >
        <span>Continue</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </Button>
    </div>

    <!-- Step: Confirm (PIN) - V52.2: Premium scaffold with ambient glow -->
    <div v-else-if="currentStep === 'confirm'" class="confirm-pin-view" data-roi="send-confirm-pin">
      <!-- V52.2: Ambient glow wrapper (same as ConfirmTxView) -->
      <div class="ambient-wrapper">
        <div class="ambient-glow" :class="{ 'ambient-glow--sending': isSubmitting }"></div>
      </div>

      <!-- V52.2: Network Chip (pill style) -->
      <div class="confirm-header">
        <span class="network-chip" :class="{ 'network-chip--warning': isTestOrDev }">
          <span class="network-dot" />
          <span class="network-label">{{ draft.networkLabel }}</span>
        </span>
      </div>

      <!-- V52.2: Submitting Spinner Overlay -->
      <div v-if="isSubmitting" class="submitting-overlay" data-roi="send-submitting">
        <div class="submitting-spinner">
          <svg class="spinner-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
          </svg>
        </div>
        <p class="submitting-text">Sending transaction...</p>
      </div>

      <!-- V52.3: Transaction Summary Section (reduced dominance) -->
      <div class="tx-summary-section" data-roi="send-confirm-summary-section">
        <!-- Amount (reduced hero - demoted 1 step) -->
        <p class="confirm-label">You are sending</p>
        <p class="confirm-amount" data-roi="send-confirm-amount">{{ draft.amountDisplay }}</p>

        <!-- V52.3: Summary Card (V48-V51 card tokens) - tighter to amount -->
        <div class="summary-card" data-roi="send-confirm-card">
          <div class="summary-row" data-roi="send-confirm-to">
            <span class="row-label">To</span>
            <span class="row-value row-value--recipient">{{ draft.recipientShort }}</span>
          </div>
          <div v-if="draft.memo" class="summary-row">
            <span class="row-label">Memo</span>
            <span class="row-value row-value--memo">{{ draft.memo }}</span>
          </div>
          <div class="summary-row">
            <span class="row-label">Fee</span>
            <span class="row-value">{{ draft.feeDisplay }}</span>
          </div>
          <div class="block-divider" />
          <div class="summary-row summary-row--total">
            <span class="row-label row-label--total">Total</span>
            <span class="row-value row-value--total">{{ draft.totalDisplay }}</span>
          </div>
        </div>
      </div>

      <!-- V52.3: PIN Section with promoted intent -->
      <div class="pin-section" :class="{ 'pin-section--disabled': isSubmitting }">
        <!-- V52.3: PIN Intent Label (promoted hierarchy) -->
        <p class="pin-intent-label">Enter PIN to send</p>

        <PinInput
          ref="pinInputRef"
          mode="unlock"
          :error="pinError"
          :disabled="isSubmitting"
          hide-label
          @complete="handlePinComplete"
        />
      </div>
    </div>

    <!-- V52: Steps sending/success/error now handled by TxResultView -->

  </ScreenShell>
</template>

<style scoped>
/* Content */
.content {
  flex: 1 1 auto;
  padding: 0 var(--space-lg);
  padding-bottom: 180px; /* Space for sticky footer */
  min-height: 0;
  overflow-y: auto;
}

.content-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding-bottom: var(--space-xl);
}

/* V49.3: Zero Balance Notice - radius-md for control coherence */
.zero-balance-notice {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: var(--radius-md);
  margin-bottom: var(--space-md);
}

.notice-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(234, 179, 8, 0.3);
  border-radius: 50%;
  color: #fbbf24;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.notice-text {
  font-size: var(--font-size-sm);
  color: rgba(253, 224, 71, 0.9);
}

/* V44: From Card - Using V43 card pattern */
.from-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.02); /* V43: Card surface */
  border: 1px solid rgba(255, 255, 255, 0.06); /* V43: Card border */
  padding: var(--space-sm) var(--space-md) var(--space-sm) var(--space-sm);
  margin-top: var(--space-xs);
  margin-bottom: var(--space-lg);
}

.from-card-glow {
  position: absolute;
  top: -16px;
  right: -16px;
  width: 96px;
  height: 96px;
  background: rgba(255, 255, 255, 0.08); /* v19: neutral glow */
  border-radius: 50%;
  filter: blur(32px);
  pointer-events: none;
  transition: background 0.3s ease;
}

.from-card:hover .from-card-glow {
  background: rgba(255, 255, 255, 0.12); /* v19: neutral hover */
}

.from-card-content {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.from-card-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.from-icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #252525, #1a1a1a); /* v17: neutral gradient */
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary); /* v17: neutral icon */
}

.from-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.from-name {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-primary);
}

.from-address {
  font-size: var(--font-size-xs);
  font-family: monospace;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.03em;
}

.from-balance {
  text-align: right;
}

.balance-value {
  display: block;
  font-size: var(--font-size-base);
  font-weight: 700;
  color: var(--color-text-primary); /* v17: neutral balance */
  font-variant-numeric: tabular-nums;
}

.balance-label {
  display: block;
  font-size: var(--font-size-2xs);
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* V49.1: Form Group - tighter vertical rhythm */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.form-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-left: var(--space-sm);
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 var(--space-sm);
}

.optional-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* InlineAction styles are handled by the component */

.input-hint-row {
  display: flex;
  justify-content: flex-end;
  padding: 0 var(--space-sm);
  min-height: 18px;
}

.input-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  letter-spacing: 0.02em;
}

.form-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0;
}

/* V49.3: Fee Card - radius-control for form-level coherence */
.fee-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-control);
  margin-bottom: var(--space-md);
  cursor: help;
  transition: all var(--transition-fast);
}

.fee-card:hover {
  background: var(--surface-hover);
  border-color: rgba(255, 255, 255, 0.1);
}

.fee-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.fee-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: var(--surface-hover);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
}

.fee-card:hover .fee-icon {
  color: var(--color-text-secondary);
  background: var(--surface-pressed);
}

.fee-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.fee-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.fee-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.fee-type {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* V49.2: Bottom Rail - Solid anchored footer for CTA presence */
.sticky-footer {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding: var(--space-lg) var(--space-lg);
  /* V49.2: Solid background - no transparency to mute CTA */
  background: var(--color-bg-primary);
  /* V49.2: Subtle top border for rail definition */
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
  /* Safe area for mobile */
  padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom));
}

/* Continue button now uses Button component */

/* ========== V52.3: Premium Confirm PIN View ========== */

/* V52.3: Confirm PIN View - fullscreen premium scaffold */
.confirm-pin-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 0 var(--space-lg);
  padding-bottom: var(--space-md); /* V52.3: Tighter bottom padding */
  overflow-y: auto;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
}

.confirm-pin-view *,
.confirm-pin-view *::before,
.confirm-pin-view *::after {
  box-sizing: border-box;
}

/* V52.2: Ambient glow wrapper */
.ambient-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  overflow: hidden;
  pointer-events: none;
}

.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 100%;
  background: var(--color-success);
  opacity: 0.04;
  filter: blur(100px);
  border-radius: 50%;
  transition: background 0.3s ease, opacity 0.3s ease;
}

.ambient-glow--sending {
  background: var(--color-warning);
  opacity: 0.06;
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%, 100% { opacity: 0.04; }
  50% { opacity: 0.08; }
}

/* V52.2: Network Chip */
.confirm-header {
  display: flex;
  justify-content: center;
  padding: var(--space-md) 0;
  position: relative;
  z-index: 1;
}

.network-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--space-sm);
  background: var(--color-success-muted);
  border-radius: var(--radius-pill);
}

.network-chip--warning {
  background: var(--color-warning-muted);
}

.network-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-success);
}

.network-chip--warning .network-dot {
  background: var(--color-warning);
}

.network-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* V52.2: Submitting Overlay */
.submitting-overlay {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  z-index: 100;
  background: rgba(10, 10, 10, 0.9);
  padding: var(--space-xl);
  border-radius: var(--radius-lg);
}

.submitting-spinner {
  color: var(--color-warning);
}

.spinner-svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.submitting-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin: 0;
}

/* V52.3: Transaction Summary Section - groups amount + card */
.tx-summary-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  position: relative;
  z-index: 1;
}

/* V52.3: Confirm Label - demoted (secondary context) */
.confirm-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 var(--space-xs); /* V52.3: Tighter to amount */
}

/* V52.3: Amount - reduced dominance (down 1 step from hero) */
.confirm-amount {
  font-size: var(--font-size-3xl); /* V52.3: Reduced from 5xl */
  font-weight: var(--font-weight-bold); /* V52.3: Reduced from 900 */
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
  line-height: 1;
  margin: 0 0 var(--space-md); /* V52.3: Tighter to card */
}

/* V52.2: Summary Card (V48-V51 tokens) */
.summary-card {
  padding: var(--space-md);
  background: var(--surface-hover);
  border: 1px solid var(--textfield-border);
  border-radius: var(--radius-control);
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 100%;
}

/* V52.2: Summary rows - 2-column grid */
.summary-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  column-gap: var(--space-md);
  align-items: center;
  min-height: 32px;
  padding: 4px 0;
}

.summary-row--total {
  padding-top: var(--space-sm);
}

.row-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.row-label--total {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.row-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  text-align: right;
  justify-self: end;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* V52.3: Recipient address - improved legibility (not placeholder-like) */
.row-value--recipient {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium); /* V52.3: Semibold for legibility */
  color: var(--color-text-secondary); /* V52.3: Less muted than before */
  letter-spacing: 0.01em;
}

/* V52.3: Memo stays muted (secondary info) */
.row-value--memo {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
  letter-spacing: 0.01em;
}

.row-value--total {
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.block-divider {
  height: 1px;
  background: var(--textfield-border);
  margin: var(--space-sm) 0;
  opacity: 0.6;
}

/* V52.3: PIN Section - promoted hierarchy */
.pin-section {
  width: 100%;
  margin-top: var(--space-md); /* V52.3: Tighter to card */
  position: relative;
  z-index: 1;
  transition: opacity 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1; /* V52.3: Fill remaining space to push keypad down consistently */
}

.pin-section--disabled {
  opacity: 0.4;
  pointer-events: none;
}

/* V52.3: PIN Intent Label - promoted (higher contrast than "You are sending") */
.pin-intent-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary); /* V52.3: Higher contrast than muted */
  text-align: center;
  margin: 0 0 var(--space-sm); /* V52.3: Tight to dots */
  letter-spacing: 0.02em;
}

/* V52: Result styles moved to TxResultView.vue */
</style>
