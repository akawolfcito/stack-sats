<script setup lang="ts">
/**
 * SendBtcView - Bitcoin Send Screen
 *
 * Single source of truth for BTC tx state via useBtcTxDraft composable.
 * Flow: Form → Confirm PIN → Submitting → Result
 *
 * Features:
 * - Combined balance from P2PKH + P2TR addresses
 * - Dynamic fee estimation (Fast/Medium/Slow)
 * - UTXO selection and fee calculation
 * - PIN verification before signing
 */
import { ref, computed, onBeforeMount, nextTick, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import PinInput from '@/components/PinInput.vue';
import ScreenShell from '@/components/layout/ScreenShell.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import { Button, TextField, InlineAction } from '@/components/ui';
import { sessionManager } from '@/utils/security/session';
import { generateInitialAccounts, getBtcKeyPair } from '@/utils/accounts';
import { getSelectedNetwork, type NetworkName } from '@/utils/network';
import {
  fetchCombinedBtcBalance,
  validateBtcAddress,
  estimateFees,
  getFeeRateForLevel,
  transferBtc,
  parseBtcAmount,
  formatBtcDisplay,
  satoshisToBtc,
  btcToSatoshis,
  calculateFee,
  fetchCombinedUtxos,
  type FeeLevel,
  type FeeEstimate,
  type BtcBalance,
  type UTXO,
} from '@/utils/bitcoin';
import { useBtcTxDraft, truncateBtcAddress } from '@/composables/useBtcTxDraft';

const router = useRouter();
const route = useRoute();

// BTC transaction draft state
const {
  draft,
  setDraft,
  setFeeLevel,
  transitionToConfirmPin,
  transitionToSubmitting,
  transitionToForm,
  setResult,
  setError,
  isValidForConfirmTx,
  isSubmitting,
  canSubmit,
} = useBtcTxDraft();

// Steps: form → confirm (PIN)
type Step = 'form' | 'confirm';
const currentStep = ref<Step>('form');

// Form state
const recipient = ref('');
const amount = ref('');

// Account state
const senderP2PKH = ref('');
const senderP2TR = ref('');
const accountName = ref('');
const network = ref<NetworkName>('devnet');
const accountIndex = ref(0);

// Balance state
const btcBalance = ref<BtcBalance>({ confirmed: 0, unconfirmed: 0, total: 0, txCount: 0 });
const isLoadingBalance = ref(false);

// UTXO state
const utxos = ref<{ address: string; utxos: UTXO[] }[]>([]);
const totalAvailableSats = computed(() => {
  let total = 0;
  for (const item of utxos.value) {
    for (const utxo of item.utxos) {
      if (utxo.status.confirmed) {
        total += utxo.value;
      }
    }
  }
  return total;
});

// Fee state
const feeEstimate = ref<FeeEstimate | null>(null);
const feeLevel = ref<FeeLevel>('medium');
const isLoadingFees = ref(false);

// Validation
const recipientError = ref('');
const amountError = ref('');

// PIN
const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);
const pinError = ref('');

// Computed values
const feeRate = computed(() => {
  if (!feeEstimate.value) return 10;
  return getFeeRateForLevel(feeEstimate.value, feeLevel.value);
});

const estimatedFee = computed(() => {
  // Estimate for 1 input, 2 outputs (recipient + change)
  return calculateFee(1, 2, feeRate.value, 'p2pkh');
});

const amountSats = computed(() => {
  if (!amount.value.trim()) return 0;
  const result = parseBtcAmount(amount.value);
  return result.success ? result.sats : 0;
});

const totalSats = computed(() => {
  return amountSats.value + estimatedFee.value;
});

const formattedBalance = computed(() => {
  return formatBtcDisplay(btcBalance.value.total);
});

const formattedFee = computed(() => {
  return formatBtcDisplay(estimatedFee.value);
});

const formattedAmount = computed(() => {
  return formatBtcDisplay(amountSats.value);
});

const formattedTotal = computed(() => {
  return formatBtcDisplay(totalSats.value);
});

const canContinue = computed(() => {
  return (
    recipient.value.trim() &&
    amount.value.trim() &&
    !recipientError.value &&
    !amountError.value &&
    totalAvailableSats.value >= totalSats.value
  );
});

const hasZeroBalance = computed(() => {
  return btcBalance.value.total <= 0;
});

const hasInsufficientBalance = computed(() => {
  return totalAvailableSats.value < totalSats.value && totalSats.value > 0;
});

// Network label
const networkLabel = computed(() => {
  const labels: Record<NetworkName, string> = {
    mainnet: 'Mainnet',
    testnet: 'Testnet',
    devnet: 'Devnet',
  };
  return labels[network.value] || network.value;
});

const senderAddressShort = computed(() => truncateBtcAddress(senderP2PKH.value));
const truncatedRecipient = computed(() => truncateBtcAddress(recipient.value.trim()));

// Header
const headerTitle = computed(() => {
  if (isSubmitting.value) return 'Sending...';
  return currentStep.value === 'confirm' ? 'Confirm Send' : 'Send BTC';
});

const showBackButton = computed(() => {
  if (isSubmitting.value) return false;
  return true;
});

const isTestOrDev = computed(() => {
  const label = networkLabel.value.toLowerCase();
  return label.includes('test') || label.includes('dev');
});

// Fee level options
const feeLevelOptions = computed(() => {
  if (!feeEstimate.value) {
    return [
      { key: 'fast', label: 'Fast', rate: 50, time: '~10 min' },
      { key: 'medium', label: 'Medium', rate: 25, time: '~30 min' },
      { key: 'slow', label: 'Slow', rate: 10, time: '~60 min' },
    ];
  }
  return [
    { key: 'fast', label: 'Fast', rate: feeEstimate.value.fastestFee, time: '~10 min' },
    { key: 'medium', label: 'Medium', rate: feeEstimate.value.halfHourFee, time: '~30 min' },
    { key: 'slow', label: 'Slow', rate: feeEstimate.value.hourFee, time: '~60 min' },
  ];
});

// Load account info
onBeforeMount(async () => {
  if (!sessionManager.hasWallet || sessionManager.isLocked) {
    router.push({ path: '/unlock' });
    return;
  }

  network.value = getSelectedNetwork();

  const savedIndex = localStorage.getItem('selected_account_index');
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
    const numAccounts = accountIndex.value + 1;
    const accounts = await generateInitialAccounts(mnemonic, numAccounts, network.value);
    if (accounts[accountIndex.value]) {
      senderP2PKH.value = accounts[accountIndex.value].btcP2PKHAddress;
      senderP2TR.value = accounts[accountIndex.value].btcP2TRAddress;
    }
  }

  // Load balance and fees in parallel
  await Promise.all([loadBalance(), loadFees(), loadUtxos()]);
});

async function loadBalance() {
  if (!senderP2PKH.value) return;

  isLoadingBalance.value = true;
  try {
    const addresses = [senderP2PKH.value];
    if (senderP2TR.value) addresses.push(senderP2TR.value);

    const result = await fetchCombinedBtcBalance(addresses, network.value);
    btcBalance.value = result;
  } catch {
    btcBalance.value = { confirmed: 0, unconfirmed: 0, total: 0, txCount: 0 };
  }
  isLoadingBalance.value = false;
}

async function loadFees() {
  isLoadingFees.value = true;
  try {
    feeEstimate.value = await estimateFees(network.value);
  } catch {
    feeEstimate.value = null;
  }
  isLoadingFees.value = false;
}

async function loadUtxos() {
  if (!senderP2PKH.value) return;

  try {
    const addresses = [senderP2PKH.value];
    if (senderP2TR.value) addresses.push(senderP2TR.value);

    utxos.value = await fetchCombinedUtxos(addresses, network.value);
  } catch {
    utxos.value = [];
  }
}

function validateRecipient() {
  recipientError.value = '';
  if (!recipient.value.trim()) {
    return;
  }
  const result = validateBtcAddress(recipient.value.trim(), network.value);
  if (!result.valid) {
    recipientError.value = result.error || 'Invalid address';
  }
}

function validateAmount() {
  amountError.value = '';
  if (!amount.value.trim()) {
    return;
  }

  const result = parseBtcAmount(amount.value);
  if (!result.success) {
    amountError.value = result.error || 'Invalid amount';
    return;
  }

  // Check if sufficient balance (including fee)
  const totalNeeded = result.sats + estimatedFee.value;
  if (totalNeeded > totalAvailableSats.value) {
    amountError.value = `Insufficient balance. Need ${formatBtcDisplay(totalNeeded)} BTC (including fee)`;
  }
}

function handleMaxAmount() {
  if (totalAvailableSats.value <= estimatedFee.value) {
    amountError.value = 'Insufficient balance for fee';
    return;
  }
  const maxSats = totalAvailableSats.value - estimatedFee.value;
  amount.value = satoshisToBtc(maxSats).toFixed(8);
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
    console.error('Failed to paste:', err);
  }
}

function handleBack() {
  if (isSubmitting.value) return;

  if (currentStep.value === 'confirm') {
    transitionToForm();
    currentStep.value = 'form';
    pinError.value = '';
  } else {
    router.push({ path: '/user' });
  }
}

function handleFeeSelect(level: FeeLevel) {
  feeLevel.value = level;
  setFeeLevel(level);
  // Revalidate amount in case fee changed
  if (amount.value.trim()) {
    validateAmount();
  }
}

function handleContinue() {
  validateRecipient();
  validateAmount();

  if (recipientError.value || amountError.value) {
    return;
  }

  // Set draft data
  setDraft({
    senderP2PKH: senderP2PKH.value,
    senderP2TR: senderP2TR.value,
    senderAddressShort: senderAddressShort.value,
    accountName: accountName.value,
    accountIndex: accountIndex.value,
    recipient: recipient.value.trim(),
    recipientShort: truncatedRecipient.value,
    amountBtc: amount.value,
    amountSats: amountSats.value,
    amountDisplay: `${formattedAmount.value} BTC`,
    feeLevel: feeLevel.value,
    feeRate: feeRate.value,
    feeEstimate: feeEstimate.value,
    feeSats: estimatedFee.value,
    feeDisplay: `${formattedFee.value} BTC`,
    totalSats: totalSats.value,
    totalDisplay: `${formattedTotal.value} BTC`,
    availableUtxos: utxos.value.flatMap((item) => item.utxos),
    totalAvailableSats: totalAvailableSats.value,
    network: network.value,
    networkLabel: networkLabel.value,
    step: 'confirmTx',
    status: 'idle',
    txid: '',
    error: '',
  });

  // Skip confirm-tx step, go directly to PIN
  transitionToConfirmPin();
  currentStep.value = 'confirm';
  nextTick(() => {
    pinInputRef.value?.focus();
  });
}

async function handlePinComplete(pin: string) {
  pinError.value = '';

  if (!canSubmit.value) {
    pinError.value = 'Please wait...';
    return;
  }

  const mnemonic = await sessionManager.unlock(pin);
  if (!mnemonic) {
    pinError.value = `Invalid PIN. ${sessionManager.attemptsRemaining} attempts remaining`;
    return;
  }

  if (!transitionToSubmitting()) {
    pinError.value = 'Transaction already in progress.';
    return;
  }

  try {
    // Get BTC key pair
    const keyPair = await getBtcKeyPair(mnemonic, draft.accountIndex);

    const result = await transferBtc({
      recipient: draft.recipient,
      amountSats: draft.amountSats,
      feeRate: draft.feeRate,
      senderP2PKH: draft.senderP2PKH,
      senderP2TR: draft.senderP2TR || undefined,
      privateKey: keyPair.privateKey,
      publicKey: keyPair.publicKey,
      network: draft.network,
    });

    if (result.success && result.txid) {
      setResult(result.txid);
      router.push({ path: '/tx-result', query: { type: 'btc' } });
    } else {
      setError(result.error || 'Transaction failed');
      router.push({ path: '/tx-result', query: { type: 'btc' } });
    }
  } catch (error) {
    setError(error instanceof Error ? error.message : 'Unknown error');
    router.push({ path: '/tx-result', query: { type: 'btc' } });
  } finally {
    // Sensitive data cleared by transferBtc
  }
}
</script>

<template>
  <ScreenShell :padded="false" data-roi="send-btc-screen">
    <template #header>
      <AppHeader
        :title="headerTitle"
        :left="showBackButton ? 'back' : 'none'"
        data-roi="send-btc-title"
        @left-click="handleBack"
      />
    </template>

    <!-- Step: Form -->
    <div v-if="currentStep === 'form'" class="content" data-roi="send-btc-form">
      <!-- From Account Card -->
      <div class="from-card">
        <div class="from-card-glow"></div>
        <div class="from-card-content">
          <div class="from-card-left">
            <div class="from-icon from-icon--btc">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F7931A" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/>
                <path d="M9 8h4c1.5 0 2.5 1 2.5 2.5S14.5 13 13 13H9m0-5v8m0-3h4.5c1.5 0 2.5 1 2.5 2.5S15 18 13.5 18H9"/>
                <path d="M11 6v2m2-2v2m-2 10v2m2-2v2"/>
              </svg>
            </div>
            <div class="from-info">
              <span class="from-name">{{ accountName }}</span>
              <span class="from-address">{{ truncateBtcAddress(senderP2PKH) }}</span>
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
        <span class="notice-text">Your BTC balance is empty.</span>
      </div>

      <!-- Insufficient balance warning -->
      <div v-if="hasInsufficientBalance && !hasZeroBalance" class="insufficient-notice">
        <span class="notice-icon">!</span>
        <span class="notice-text">Insufficient confirmed balance for this transaction.</span>
      </div>

      <!-- Recipient Input -->
      <div class="form-group" data-roi="send-btc-textfield-to">
        <label class="form-label">To</label>
        <TextField
          v-model="recipient"
          variant="default"
          placeholder="BTC Address"
          :error="recipientError"
          @blur="validateRecipient"
        >
          <template #suffix>
            <InlineAction label="Paste" variant="ghost" data-roi="send-btc-pill-paste" @click="handlePaste" />
          </template>
        </TextField>
        <p v-if="recipientError" class="form-error" data-roi="send-btc-error-recipient">{{ recipientError }}</p>
      </div>

      <!-- Amount Input -->
      <div class="form-group" data-roi="send-btc-textfield-amount">
        <label class="form-label">Amount</label>
        <TextField
          v-model="amount"
          variant="default"
          placeholder="0.00000000"
          :error="amountError"
          @blur="validateAmount"
        >
          <template #suffix>
            <InlineAction label="Max" variant="ghost" data-roi="send-btc-pill-max" @click="handleMaxAmount" />
          </template>
        </TextField>
        <div class="input-hint-row">
          <p v-if="amountError" class="form-error" data-roi="send-btc-error-amount">{{ amountError }}</p>
          <span v-else class="input-hint">Available: {{ formattedBalance }} BTC</span>
        </div>
      </div>

      <!-- Fee Selector -->
      <div class="form-group">
        <label class="form-label">Network Fee</label>
        <div class="fee-selector">
          <button
            v-for="option in feeLevelOptions"
            :key="option.key"
            class="fee-option"
            :class="{ 'fee-option--selected': feeLevel === option.key }"
            @click="handleFeeSelect(option.key as FeeLevel)"
          >
            <span class="fee-option-label">{{ option.label }}</span>
            <span class="fee-option-rate">{{ option.rate }} sat/vB</span>
            <span class="fee-option-time">{{ option.time }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Sticky Footer (form step only) -->
    <div v-if="currentStep === 'form'" class="sticky-footer" data-roi="send-btc-cta">
      <!-- Fee Summary Card -->
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
          <span class="fee-label">Estimated Fee</span>
        </div>
        <div class="fee-right">
          <span class="fee-value">{{ formattedFee }} BTC</span>
          <span class="fee-type">{{ feeLevel.charAt(0).toUpperCase() + feeLevel.slice(1) }}</span>
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

    <!-- Step: Confirm (PIN) -->
    <div v-else-if="currentStep === 'confirm'" class="confirm-pin-view" data-roi="send-btc-confirm-pin">
      <!-- Ambient glow -->
      <div class="ambient-wrapper">
        <div class="ambient-glow ambient-glow--btc" :class="{ 'ambient-glow--sending': isSubmitting }"></div>
      </div>

      <!-- Network Chip -->
      <div class="confirm-header">
        <span class="network-chip" :class="{ 'network-chip--warning': isTestOrDev }">
          <span class="network-dot" />
          <span class="network-label">{{ draft.networkLabel }}</span>
        </span>
      </div>

      <!-- Submitting Spinner Overlay -->
      <div v-if="isSubmitting" class="submitting-overlay" data-roi="send-btc-submitting">
        <div class="submitting-spinner">
          <svg class="spinner-svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
          </svg>
        </div>
        <p class="submitting-text">Broadcasting transaction...</p>
      </div>

      <!-- Transaction Summary Section -->
      <div class="tx-summary-section" data-roi="send-btc-confirm-summary-section">
        <p class="confirm-label">You are sending</p>
        <p class="confirm-amount" data-roi="send-btc-confirm-amount">{{ draft.amountDisplay }}</p>

        <!-- Summary Card -->
        <div class="summary-card" data-roi="send-btc-confirm-card">
          <div class="summary-row" data-roi="send-btc-confirm-to">
            <span class="row-label">To</span>
            <span class="row-value row-value--recipient">{{ draft.recipientShort }}</span>
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

      <!-- PIN Section -->
      <div class="pin-section" :class="{ 'pin-section--disabled': isSubmitting }">
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
  </ScreenShell>
</template>

<style scoped>
/* Content */
.content {
  flex: 1 1 auto;
  padding: 0 var(--space-lg);
  padding-bottom: 180px;
  min-height: 0;
  overflow-y: auto;
}

/* Zero/Insufficient Balance Notice */
.zero-balance-notice,
.insufficient-notice {
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

/* From Card */
.from-card {
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
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
  background: rgba(247, 147, 26, 0.15);
  border-radius: 50%;
  filter: blur(32px);
  pointer-events: none;
  transition: background 0.3s ease;
}

.from-card:hover .from-card-glow {
  background: rgba(247, 147, 26, 0.2);
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
  background: linear-gradient(135deg, #2d2518, #1f1a14);
  border: 1px solid rgba(247, 147, 26, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.from-icon--btc {
  background: linear-gradient(135deg, rgba(247, 147, 26, 0.15), rgba(247, 147, 26, 0.05));
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
  color: #F7931A;
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

/* Form Group */
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

/* Fee Selector */
.fee-selector {
  display: flex;
  gap: var(--space-sm);
}

.fee-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: var(--space-md) var(--space-sm);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.fee-option:hover {
  background: var(--surface-hover);
  border-color: rgba(255, 255, 255, 0.1);
}

.fee-option--selected {
  background: rgba(247, 147, 26, 0.1);
  border-color: rgba(247, 147, 26, 0.3);
}

.fee-option-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.fee-option-rate {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

.fee-option-time {
  font-size: var(--font-size-2xs);
  color: var(--color-text-muted);
}

/* Fee Card */
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

/* Sticky Footer */
.sticky-footer {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding: var(--space-lg) var(--space-lg);
  background: var(--color-bg-primary);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
  padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom));
}

/* ========== Confirm PIN View ========== */

.confirm-pin-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 0 var(--space-lg);
  padding-bottom: var(--space-md);
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

/* Ambient glow */
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

.ambient-glow--btc {
  background: #F7931A;
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

/* Network Chip */
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

/* Submitting Overlay */
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
  color: #F7931A;
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

/* Transaction Summary Section */
.tx-summary-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  position: relative;
  z-index: 1;
}

.confirm-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0 0 var(--space-xs);
}

.confirm-amount {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: #F7931A;
  letter-spacing: -0.01em;
  line-height: 1;
  margin: 0 0 var(--space-md);
}

/* Summary Card */
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

.row-value--recipient {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  letter-spacing: 0.01em;
}

.row-value--total {
  font-weight: var(--font-weight-bold);
  color: #F7931A;
}

.block-divider {
  height: 1px;
  background: var(--textfield-border);
  margin: var(--space-sm) 0;
  opacity: 0.6;
}

/* PIN Section */
.pin-section {
  width: 100%;
  margin-top: var(--space-md);
  position: relative;
  z-index: 1;
  transition: opacity 0.2s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.pin-section--disabled {
  opacity: 0.4;
  pointer-events: none;
}

.pin-intent-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0 0 var(--space-sm);
  letter-spacing: 0.02em;
}
</style>
