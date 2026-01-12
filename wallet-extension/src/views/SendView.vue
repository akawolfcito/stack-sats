<script setup lang="ts">
import { ref, computed, onBeforeMount, nextTick } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import ConfirmSendModal from "@/components/send/ConfirmSendModal.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { Button, TextField, InlineAction } from "@/components/ui";
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

// Confirm Modal
const showConfirmModal = ref(false);

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

// Header
const headerTitle = computed(() => {
  switch (currentStep.value) {
    case "form": return "Send STX";
    case "confirm": return "Confirm Send";
    case "sending": return "Sending...";
    case "success": return "Success!";
    case "error": return "Error";
    default: return "Send STX";
  }
});
const showBackButton = computed(() => currentStep.value === "form" || currentStep.value === "confirm");

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

  showConfirmModal.value = true;
}

function handleModalClose() {
  showConfirmModal.value = false;
}

function handleModalConfirm() {
  showConfirmModal.value = false;
  currentStep.value = "confirm";
  nextTick(() => {
    pinInputRef.value?.focus();
  });
}

async function handlePinComplete(pin: string) {
  pinError.value = "";

  const mnemonic = await sessionManager.unlock(pin);
  if (!mnemonic) {
    pinError.value = `Invalid PIN. ${sessionManager.attemptsRemaining} attempts remaining`;
    return;
  }

  currentStep.value = "sending";

  let privateKey: string | null = null;

  try {
    privateKey = await getPrivateKey(mnemonic, accountIndex.value);

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
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        :title="headerTitle"
        :left="showBackButton ? 'back' : 'none'"
        @left-click="handleBack"
      />
    </template>

    <!-- Step: Form -->
    <div v-if="currentStep === 'form'" class="content">
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

      <!-- Recipient Input -->
      <div class="form-group">
        <label class="form-label">To</label>
        <TextField
          v-model="recipient"
          variant="neumorphic"
          mono
          placeholder="Address or BNS Name"
          :error="recipientError"
          @blur="validateRecipient"
        >
          <template #suffix>
            <InlineAction label="Paste" variant="ghost" @click="handlePaste" />
          </template>
        </TextField>
        <p v-if="recipientError" class="form-error">{{ recipientError }}</p>
      </div>

      <!-- Amount Input -->
      <div class="form-group">
        <label class="form-label">Amount</label>
        <TextField
          v-model="amount"
          variant="neumorphic"
          placeholder="0.00"
          :error="amountError"
          @blur="validateAmount"
        >
          <template #suffix>
            <InlineAction label="Max" variant="accent" @click="handleMaxAmount" />
          </template>
        </TextField>
        <div class="input-hint-row">
          <p v-if="amountError" class="form-error">{{ amountError }}</p>
          <span v-else class="input-hint">Available: {{ formattedBalance }} STX</span>
        </div>
      </div>

      <!-- Memo Input -->
      <div class="form-group">
        <div class="label-row">
          <label class="form-label">Memo</label>
          <span class="optional-label">Optional</span>
        </div>
        <TextField
          v-model="memo"
          variant="neumorphic"
          placeholder="Enter a message to the recipient"
          :maxlength="34"
        />
      </div>

    </div>

    <!-- Sticky Footer (form step only) -->
    <div v-if="currentStep === 'form'" class="sticky-footer">
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
        :disabled="!canSubmit"
        @click="handleContinue"
      >
        <span>Continue</span>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M5 12h14M12 5l7 7-7 7"/>
        </svg>
      </Button>
    </div>

    <!-- Step: Confirm -->
    <div v-else-if="currentStep === 'confirm'" class="content content-center">
      <p class="confirm-label">You are sending:</p>
      <p class="confirm-amount">{{ formattedAmount }} <span>STX</span></p>

      <div class="confirm-card">
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
        <div class="confirm-row confirm-row-total">
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
    <div v-else-if="currentStep === 'sending'" class="content content-center">
      <div class="spinner"></div>
      <p class="status-text">Broadcasting transaction...</p>
    </div>

    <!-- Step: Success -->
    <div v-else-if="currentStep === 'success'" class="content content-center">
      <div class="result-icon result-icon-success">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p class="result-title">Transaction Sent</p>

      <div class="result-card">
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
          <Button variant="ghost" size="sm" @click="copyTxid">Copy</Button>
        </div>
      </div>

      <Button v-if="explorerUrl" variant="secondary" full-width @click="openExplorer">
        View in Explorer
      </Button>

      <Button variant="primary" full-width @click="handleDone">Done</Button>
    </div>

    <!-- Step: Error -->
    <div v-else-if="currentStep === 'error'" class="content content-center">
      <div class="result-icon result-icon-error">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
      <p class="result-title">Transaction Failed</p>
      <p class="error-message">{{ errorMessage }}</p>

      <Button variant="primary" full-width @click="handleTryAgain">Try Again</Button>
      <Button variant="secondary" full-width @click="handleDone">Cancel</Button>
    </div>

    <!-- Confirm Modal -->
    <ConfirmSendModal
      :is-open="showConfirmModal"
      :network-label="networkLabel"
      :from-label="accountName"
      :from-address-short="senderAddressShort"
      :to-address="recipient.trim()"
      :to-address-short="truncatedRecipient"
      :amount-text="`${formattedAmount} STX`"
      :fee-text="`${formattedFee} STX`"
      :total-text="`${formattedTotal} STX`"
      :memo="memo.trim() || undefined"
      @close="handleModalClose"
      @confirm="handleModalConfirm"
    />
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

/* Zero Balance Notice */
.zero-balance-notice {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: 12px;
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

/* Form Group */
.form-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.form-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-left: var(--space-sm);
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 0 var(--space-sm);
}

.optional-label {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.2);
}

/* InlineAction styles are handled by the component */

.input-hint-row {
  display: flex;
  justify-content: flex-end;
  padding: 0 var(--space-sm);
  min-height: 20px;
}

.input-hint {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.02em;
}

.form-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0;
}

/* V44: Fee Card - Using V43 card pattern */
.fee-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: rgba(255, 255, 255, 0.02); /* V43: Card surface */
  border: 1px solid rgba(255, 255, 255, 0.06); /* V43: Card border */
  border-radius: var(--radius-md);
  margin-bottom: var(--space-sm);
  cursor: help;
  transition: background 0.15s ease;
}

.fee-card:hover {
  background: rgba(255, 255, 255, 0.04); /* V43: Subtle hover */
}

.fee-left {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.fee-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.6);
  transition: color 0.15s ease;
}

.fee-card:hover .fee-icon {
  color: var(--color-text-primary); /* v17: neutral hover */
}

.fee-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
}

.fee-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.fee-value {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-primary);
  font-family: monospace;
}

.fee-type {
  font-size: var(--font-size-2xs);
  color: rgba(255, 255, 255, 0.2);
  letter-spacing: 0.03em;
}

/* Sticky Footer */
.sticky-footer {
  position: sticky;
  bottom: 0;
  margin-top: auto;
  padding: var(--space-md) var(--space-lg) var(--space-lg);
  background: linear-gradient(
    to top,
    var(--color-bg-primary) 70%,
    rgba(10, 10, 10, 0.95) 85%,
    transparent
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10;
  /* Safe area for mobile */
  padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom));
}

/* Continue button now uses Button component */

/* Confirm */
.confirm-label {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 var(--space-sm);
}

.confirm-amount {
  font-size: var(--font-size-4xl);
  font-weight: 800;
  color: var(--color-text-primary); /* v17: neutral amount */
  margin: 0 0 var(--space-xl);
}

.confirm-amount span {
  color: var(--color-text-primary);
}

/* V44: Confirm Card - Using V43 card pattern */
.confirm-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.02); /* V43: Card surface */
  border: 1px solid rgba(255, 255, 255, 0.06); /* V43: Card border */
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.confirm-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.confirm-row-total {
  font-weight: 600;
}

.confirm-key {
  color: rgba(255, 255, 255, 0.5);
}

.confirm-value {
  color: var(--color-text-primary);
  word-break: break-all;
  text-align: right;
  max-width: 60%;
}

.confirm-divider {
  border: none;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin: var(--space-sm) 0;
}

.pin-section {
  width: 100%;
  margin-top: var(--space-md);
}

/* Spinner */
.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-text-muted); /* v17: neutral spinner */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  font-size: var(--font-size-sm);
  color: rgba(255, 255, 255, 0.5);
  margin-top: var(--space-lg);
}

/* Result */
.result-icon {
  width: var(--icon-size-xl);
  height: var(--icon-size-xl);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-lg);
}

.result-icon-success {
  background: var(--color-success);
  color: #0a0a0a;
  box-shadow: var(--shadow-success-lg);
}

.result-icon-error {
  background: var(--color-error);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-error-lg);
}

.result-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-lg);
}

/* V44: Result Card - Using V43 card pattern */
.result-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.02); /* V43: Card surface */
  border: 1px solid rgba(255, 255, 255, 0.06); /* V43: Card border */
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  margin-bottom: var(--space-lg);
}

.result-row {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
}

.result-key {
  color: rgba(255, 255, 255, 0.5);
}

.result-value {
  color: var(--color-text-primary);
}

.txid-section {
  width: 100%;
  margin-bottom: var(--space-lg);
}

.txid-label {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.5);
  margin: 0 0 var(--space-xs);
}

.txid-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.txid-value {
  font-size: var(--font-size-sm);
  font-family: monospace;
  color: var(--color-text-secondary); /* v17: neutral txid */
}

/* Copy button now uses Button variant="ghost" size="sm" */

.error-message {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  margin: 0 0 var(--space-xl);
  max-width: 100%;
  word-break: break-word;
}

/* Result step buttons use unified Button component with margin */
.content-center :deep(.btn) {
  margin-bottom: var(--space-sm);
}
</style>
