<script setup lang="ts">
import { ref, computed, onBeforeMount, nextTick } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import { sessionManager } from "@/utils/security/session";
import { getPrivateKey } from "@/utils/accounts";
import { getSelectedNetwork, NETWORKS, type NetworkName } from "@/utils/network";
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

const router = useRouter();

// Steps
type Step = "form" | "confirm" | "sending" | "success" | "error";
const currentStep = ref<Step>("form");

// Form state
const recipient = ref("");
const amount = ref("");
const memo = ref("");

// Account state
const senderAddress = ref("");
const balanceMicroStx = ref("0");
const accountName = ref("");
const network = ref<NetworkName>("devnet");
const accountIndex = ref(0);

// Result state
const txid = ref("");
const errorMessage = ref("");

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
const explorerUrl = computed(() => {
  if (!txid.value) return "";
  const base = NETWORKS[network.value].explorerUrl;
  if (!base) return "";
  // Ensure txid has 0x prefix and add chain param for non-mainnet
  const formattedTxId = txid.value.startsWith("0x") ? txid.value : `0x${txid.value}`;
  const chainParam = network.value === "mainnet" ? "" : `?chain=${network.value}`;
  return `${base}/txid/${formattedTxId}${chainParam}`;
});
const truncatedRecipient = computed(() => {
  if (recipient.value.length <= 20) return recipient.value;
  return `${recipient.value.slice(0, 10)}...${recipient.value.slice(-10)}`;
});
const canSubmit = computed(() => {
  return recipient.value.trim() && amount.value.trim() && !recipientError.value && !amountError.value;
});

// Load account info
onBeforeMount(async () => {
  if (!sessionManager.hasWallet || sessionManager.isLocked) {
    router.push({ path: "/unlock" });
    return;
  }

  network.value = getSelectedNetwork();

  // Get saved account index
  const savedIndex = localStorage.getItem("selected_account_index");
  accountIndex.value = savedIndex ? parseInt(savedIndex, 10) : 0;

  // Get account name
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

  // Generate address - need to generate enough accounts to reach the selected index
  const mnemonic = sessionManager.getMnemonic();
  if (mnemonic) {
    const { generateInitialAccounts } = await import("@/utils/accounts");
    // Generate accountIndex + 1 accounts to ensure we have the selected account
    const numAccounts = accountIndex.value + 1;
    const accounts = await generateInitialAccounts(mnemonic, numAccounts, network.value);
    if (accounts[accountIndex.value]) {
      senderAddress.value = accounts[accountIndex.value].stxAddress;
    }
  }

  // Fetch balance
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

// Validation
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

// Navigation
function handleBack() {
  if (currentStep.value === "confirm") {
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

  currentStep.value = "confirm";
  nextTick(() => {
    pinInputRef.value?.focus();
  });
}

// Send transaction
async function handlePinComplete(pin: string) {
  pinError.value = "";

  // Verify PIN by attempting unlock
  const mnemonic = await sessionManager.unlock(pin);
  if (!mnemonic) {
    pinError.value = `Invalid PIN. ${sessionManager.attemptsRemaining} attempts remaining`;
    return;
  }

  // Start sending
  currentStep.value = "sending";

  let privateKey: string | null = null;

  try {
    // Get private key
    privateKey = await getPrivateKey(mnemonic, accountIndex.value);

    // Execute transfer
    const result = await transferStx({
      recipient: recipient.value.trim(),
      amountMicroStx: stxToMicroStx(amount.value),
      memo: memo.value.trim() || undefined,
      senderKey: privateKey,
      network: network.value,
    });

    if (result.success && result.txid) {
      txid.value = result.txid;
      currentStep.value = "success";
    } else {
      errorMessage.value = result.error || "Transaction failed";
      currentStep.value = "error";
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "Unknown error";
    currentStep.value = "error";
  } finally {
    // Clear sensitive data
    privateKey = null;
    scheduleCleanup();
  }
}

function handleTryAgain() {
  errorMessage.value = "";
  currentStep.value = "form";
}

function handleDone() {
  router.push({ path: "/user" });
}

function copyTxid() {
  navigator.clipboard.writeText(txid.value);
}

function openExplorer() {
  if (explorerUrl.value) {
    window.open(explorerUrl.value, "_blank");
  }
}

function truncateAddress(address: string): string {
  if (address.length <= 16) return address;
  return `${address.slice(0, 8)}...${address.slice(-8)}`;
}
</script>

<template>
  <div class="send-view">
    <!-- Header -->
    <header class="send-header">
      <button
        v-if="currentStep === 'form' || currentStep === 'confirm'"
        class="back-btn"
        @click="handleBack"
      >
        <span class="back-arrow">&larr;</span>
      </button>
      <h1 class="send-title">
        <template v-if="currentStep === 'form'">Send STX</template>
        <template v-else-if="currentStep === 'confirm'">Confirm Send</template>
        <template v-else-if="currentStep === 'sending'">Sending...</template>
        <template v-else-if="currentStep === 'success'">Success!</template>
        <template v-else-if="currentStep === 'error'">Error</template>
      </h1>
      <div class="header-spacer"></div>
    </header>

    <!-- Step: Form -->
    <div v-if="currentStep === 'form'" class="send-content">
      <!-- From info -->
      <div class="from-info">
        <span class="from-label">From:</span>
        <span class="from-account">{{ accountName }}</span>
        <span class="from-address">{{ truncateAddress(senderAddress) }}</span>
        <span class="from-balance">Balance: {{ formattedBalance }} STX</span>
      </div>

      <!-- Recipient -->
      <div class="form-group">
        <label class="form-label">Recipient Address *</label>
        <input
          v-model="recipient"
          type="text"
          class="form-input"
          :class="{ 'has-error': recipientError }"
          placeholder="ST... or SP..."
          @blur="validateRecipient"
        />
        <p v-if="recipientError" class="form-error">{{ recipientError }}</p>
      </div>

      <!-- Amount -->
      <div class="form-group">
        <label class="form-label">Amount (STX) *</label>
        <div class="amount-input-wrapper">
          <input
            v-model="amount"
            type="text"
            class="form-input amount-input"
            :class="{ 'has-error': amountError }"
            placeholder="0.00"
            @blur="validateAmount"
          />
          <button class="max-btn" @click="handleMaxAmount">MAX</button>
        </div>
        <p v-if="amountError" class="form-error">{{ amountError }}</p>
        <p class="form-hint">Available: {{ formattedBalance }} STX</p>
      </div>

      <!-- Memo -->
      <div class="form-group">
        <label class="form-label">Memo (optional)</label>
        <input
          v-model="memo"
          type="text"
          class="form-input"
          placeholder="Add a note..."
          maxlength="34"
        />
      </div>

      <!-- Fee -->
      <div class="fee-info">
        <span>Network fee:</span>
        <span>{{ formattedFee }} STX</span>
      </div>

      <!-- Submit -->
      <button
        class="submit-btn"
        :disabled="!canSubmit"
        @click="handleContinue"
      >
        Continue
      </button>
    </div>

    <!-- Step: Confirm -->
    <div v-else-if="currentStep === 'confirm'" class="send-content confirm-content">
      <p class="confirm-label">You are sending:</p>
      <p class="confirm-amount">{{ formattedAmount }} STX</p>

      <div class="confirm-details">
        <div class="confirm-row">
          <span class="confirm-key">To:</span>
          <span class="confirm-value">{{ truncatedRecipient }}</span>
        </div>
        <div v-if="memo" class="confirm-row">
          <span class="confirm-key">Memo:</span>
          <span class="confirm-value">{{ memo }}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-key">Fee:</span>
          <span class="confirm-value">{{ formattedFee }} STX</span>
        </div>
        <hr class="confirm-divider" />
        <div class="confirm-row total">
          <span class="confirm-key">Total:</span>
          <span class="confirm-value">{{ formattedTotal }} STX</span>
        </div>
      </div>

      <div class="pin-section">
        <PinInput
          ref="pinInputRef"
          mode="unlock"
          :error="pinError"
          @complete="handlePinComplete"
        />
      </div>
    </div>

    <!-- Step: Sending -->
    <div v-else-if="currentStep === 'sending'" class="send-content center-content">
      <div class="spinner"></div>
      <p class="sending-text">Broadcasting transaction...</p>
    </div>

    <!-- Step: Success -->
    <div v-else-if="currentStep === 'success'" class="send-content center-content">
      <div class="success-icon">&#x2713;</div>
      <p class="success-title">Transaction Sent</p>

      <div class="result-details">
        <div class="result-row">
          <span class="result-key">Amount:</span>
          <span class="result-value">{{ formattedAmount }} STX</span>
        </div>
        <div class="result-row">
          <span class="result-key">To:</span>
          <span class="result-value">{{ truncatedRecipient }}</span>
        </div>
      </div>

      <div class="txid-section">
        <p class="txid-label">Transaction ID:</p>
        <div class="txid-row">
          <span class="txid-value">{{ txid.slice(0, 10) }}...{{ txid.slice(-10) }}</span>
          <button class="copy-btn" @click="copyTxid">Copy</button>
        </div>
      </div>

      <button
        v-if="explorerUrl"
        class="explorer-btn"
        @click="openExplorer"
      >
        View in Explorer
      </button>

      <button class="done-btn" @click="handleDone">Done</button>
    </div>

    <!-- Step: Error -->
    <div v-else-if="currentStep === 'error'" class="send-content center-content">
      <div class="error-icon">&#x2717;</div>
      <p class="error-title">Transaction Failed</p>
      <p class="error-message">{{ errorMessage }}</p>

      <button class="retry-btn" @click="handleTryAgain">Try Again</button>
      <button class="cancel-btn" @click="handleDone">Cancel</button>
    </div>
  </div>
</template>

<style scoped>
.send-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: var(--space-lg);
  box-sizing: border-box;
}

/* Header */
.send-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-text-primary);
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-sm);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.back-btn:hover {
  opacity: 0.7;
}

.send-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.header-spacer {
  width: 40px;
}

/* Content */
.send-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  overflow-y: auto;
}

.center-content {
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* From info card */
.from-info {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.from-info::before {
  content: '';
  width: 40px;
  height: 40px;
  background: var(--color-accent-primary);
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.from-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.from-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.from-account {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.from-address {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-family: var(--font-mono);
}

.from-balance {
  color: var(--color-accent-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-left: auto;
}

/* Form */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.form-input {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  height: auto;
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
}

.form-input.has-error {
  border-color: var(--color-error);
}

.form-error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin: 0;
}

.form-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0;
  text-align: right;
}

/* Amount input */
.amount-input-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding-right: var(--space-md);
  transition: border-color var(--transition-base);
}

.amount-input-wrapper:focus-within {
  border-color: var(--color-accent-primary);
}

.amount-input {
  flex: 1;
  background: transparent;
  border: none;
  padding: var(--space-lg);
  font-size: var(--font-size-base);
}

.amount-input:focus {
  outline: none;
  border: none;
}

.amount-suffix {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  padding: 0 var(--space-sm);
  border-right: 1px solid var(--color-border);
}

.max-btn {
  background: transparent;
  border: none;
  padding: var(--space-sm) var(--space-md);
  color: var(--color-accent-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  cursor: pointer;
  width: auto;
}

.max-btn:hover {
  color: var(--color-accent-primary-hover);
}

/* Fee */
.fee-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card);
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

/* Submit */
.submit-btn {
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-pill);
  padding: var(--space-lg);
  color: var(--color-bg-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  margin-top: auto;
  transition: all var(--transition-base);
}

.submit-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.submit-btn:hover:not(:disabled) {
  background: var(--color-accent-primary-hover);
  transform: translateY(-1px);
}

/* Confirm */
.confirm-content {
  align-items: center;
}

.confirm-label {
  color: var(--color-text-secondary);
  margin: 0;
}

.confirm-amount {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: var(--space-sm) 0 var(--space-xl);
}

.confirm-details {
  width: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
}

.confirm-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-sm) 0;
}

.confirm-row.total {
  font-weight: var(--font-weight-semibold);
}

.confirm-key {
  color: var(--color-text-muted);
}

.confirm-value {
  color: var(--color-text-primary);
  word-break: break-all;
  text-align: right;
  max-width: 60%;
}

.confirm-divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-sm) 0;
}

.pin-section {
  margin-top: var(--space-xl);
  width: 100%;
}

/* Sending */
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid var(--color-bg-card);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.sending-text {
  color: var(--color-text-muted);
  margin-top: var(--space-lg);
}

/* Success */
.success-icon {
  width: 72px;
  height: 72px;
  background: var(--color-success);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--color-bg-primary);
}

.success-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: var(--space-lg) 0;
}

.result-details {
  width: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.result-key {
  color: var(--color-text-muted);
}

.result-value {
  color: var(--color-text-primary);
}

.txid-section {
  width: 100%;
  margin-bottom: var(--space-lg);
}

.txid-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-sm);
}

.txid-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.txid-value {
  color: var(--color-accent-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.copy-btn {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  width: auto;
}

.copy-btn:hover {
  border-color: var(--color-border-hover);
}

.explorer-btn {
  width: 100%;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: var(--space-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  cursor: pointer;
  margin-bottom: var(--space-sm);
}

.explorer-btn:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card);
}

.done-btn {
  width: 100%;
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-pill);
  padding: var(--space-lg);
  color: var(--color-bg-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.done-btn:hover {
  background: var(--color-accent-primary-hover);
}

/* Error */
.error-icon {
  width: 72px;
  height: 72px;
  background: var(--color-error);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: var(--color-text-primary);
}

.error-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: var(--space-lg) 0 var(--space-sm);
}

.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-xl);
  max-width: 100%;
  word-break: break-word;
}

.retry-btn {
  width: 100%;
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-pill);
  padding: var(--space-lg);
  color: var(--color-bg-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  margin-bottom: var(--space-sm);
}

.retry-btn:hover {
  background: var(--color-accent-primary-hover);
}

.cancel-btn {
  width: 100%;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: var(--space-lg);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  cursor: pointer;
}

.cancel-btn:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card);
}
</style>
