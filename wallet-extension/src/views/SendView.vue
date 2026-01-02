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
  validateStxAddress,
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
  if (!validateStxAddress(recipient.value.trim(), network.value)) {
    recipientError.value = `Invalid address. Must start with ${NETWORKS[network.value].addressPrefix}`;
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
  padding: 16px;
  box-sizing: border-box;
}

/* Header */
.send-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.back-btn {
  background: none;
  border: none;
  color: #646cff;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 4px 8px;
}

.back-btn:hover {
  opacity: 0.8;
}

.send-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: #fff;
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
  gap: 16px;
  overflow-y: auto;
}

.center-content {
  align-items: center;
  justify-content: center;
  text-align: center;
}

/* From info */
.from-info {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.from-label {
  color: #888;
  font-size: 0.75rem;
}

.from-account {
  color: #fff;
  font-weight: 600;
}

.from-address {
  color: #888;
  font-size: 0.875rem;
  font-family: monospace;
}

.from-balance {
  color: #646cff;
  font-size: 0.875rem;
  font-weight: 500;
}

/* Form */
.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  color: #888;
  font-size: 0.875rem;
}

.form-input {
  background: #1a1a2e;
  border: 1px solid #333;
  border-radius: 8px;
  padding: 12px;
  color: #fff;
  font-size: 1rem;
}

.form-input:focus {
  outline: none;
  border-color: #646cff;
}

.form-input.has-error {
  border-color: #ff4444;
}

.form-error {
  color: #ff4444;
  font-size: 0.75rem;
  margin: 0;
}

.form-hint {
  color: #666;
  font-size: 0.75rem;
  margin: 0;
}

/* Amount input */
.amount-input-wrapper {
  display: flex;
  gap: 8px;
  align-items: stretch;
  width: 100%;
}

.amount-input {
  flex: 1 1 auto;
  min-width: 100px;
  width: 100%;
}

.max-btn {
  background: #333;
  border: none;
  border-radius: 8px;
  padding: 0 16px;
  color: #646cff;
  font-weight: 600;
  cursor: pointer;
  flex: 0 0 auto;
  white-space: nowrap;
}

.max-btn:hover {
  background: #444;
}

/* Fee */
.fee-info {
  display: flex;
  justify-content: space-between;
  color: #888;
  font-size: 0.875rem;
  padding: 8px 0;
}

/* Submit */
.submit-btn {
  background: #646cff;
  border: none;
  border-radius: 8px;
  padding: 14px;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-top: auto;
}

.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.submit-btn:hover:not(:disabled) {
  background: #5258cc;
}

/* Confirm */
.confirm-content {
  align-items: center;
}

.confirm-label {
  color: #888;
  margin: 0;
}

.confirm-amount {
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  margin: 8px 0 24px;
}

.confirm-details {
  width: 100%;
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
}

.confirm-row {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
}

.confirm-row.total {
  font-weight: 600;
}

.confirm-key {
  color: #888;
}

.confirm-value {
  color: #fff;
  word-break: break-all;
  text-align: right;
  max-width: 60%;
}

.confirm-divider {
  border: none;
  border-top: 1px solid #333;
  margin: 8px 0;
}

.pin-section {
  margin-top: 24px;
  width: 100%;
}

/* Sending */
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #333;
  border-top-color: #646cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.sending-text {
  color: #888;
  margin-top: 16px;
}

/* Success */
.success-icon {
  width: 64px;
  height: 64px;
  background: #4caf50;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #fff;
}

.success-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
  margin: 16px 0;
}

.result-details {
  width: 100%;
  background: #1a1a2e;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: 4px 0;
}

.result-key {
  color: #888;
}

.result-value {
  color: #fff;
}

.txid-section {
  width: 100%;
  margin-bottom: 16px;
}

.txid-label {
  color: #888;
  font-size: 0.875rem;
  margin: 0 0 8px;
}

.txid-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.txid-value {
  color: #646cff;
  font-family: monospace;
  font-size: 0.875rem;
}

.copy-btn {
  background: #333;
  border: none;
  border-radius: 4px;
  padding: 4px 12px;
  color: #fff;
  font-size: 0.75rem;
  cursor: pointer;
}

.copy-btn:hover {
  background: #444;
}

.explorer-btn {
  width: 100%;
  background: #333;
  border: none;
  border-radius: 8px;
  padding: 12px;
  color: #646cff;
  font-size: 1rem;
  cursor: pointer;
  margin-bottom: 8px;
}

.explorer-btn:hover {
  background: #444;
}

.done-btn {
  width: 100%;
  background: #646cff;
  border: none;
  border-radius: 8px;
  padding: 14px;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.done-btn:hover {
  background: #5258cc;
}

/* Error */
.error-icon {
  width: 64px;
  height: 64px;
  background: #ff4444;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  color: #fff;
}

.error-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #fff;
  margin: 16px 0 8px;
}

.error-message {
  color: #ff4444;
  font-size: 0.875rem;
  margin: 0 0 24px;
  max-width: 100%;
  word-break: break-word;
}

.retry-btn {
  width: 100%;
  background: #646cff;
  border: none;
  border-radius: 8px;
  padding: 14px;
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 8px;
}

.retry-btn:hover {
  background: #5258cc;
}

.cancel-btn {
  width: 100%;
  background: #333;
  border: none;
  border-radius: 8px;
  padding: 14px;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
}

.cancel-btn:hover {
  background: #444;
}
</style>
