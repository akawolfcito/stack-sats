<script setup lang="ts">
import { ref, computed, onBeforeMount, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import StickyCTA from "@/components/layout/StickyCTA.vue";
import FormField from "@/components/forms/FormField.vue";
import PinInput from "@/components/PinInput.vue";
import { sessionManager } from "@/utils/security/session";
import { getPrivateKey } from "@/utils/accounts";
import { getSelectedNetwork, NETWORKS, type NetworkName } from "@/utils/network";
import { validateStxAddressWithError } from "@/utils/transfer";
import { fetchFungibleTokens } from "@/utils/balance";
import { formatTokenBalance } from "@/utils/tokens";
import { scheduleCleanup } from "@/utils/security/memory";
import {
  getCustomTokenByKey,
  type CustomToken,
} from "@/utils/tokens/custom";
import {
  transferToken,
  parseTokenAmount,
  formatTokenAmount,
  TOKEN_TRANSFER_FEE_MICRO_STX,
} from "@/utils/tokens/transfer";
import { microStxToStx, formatStxDisplay } from "@/utils/transfer";

const router = useRouter();
const route = useRoute();

// Get tokenKey from route params (URL decoded)
const tokenKey = computed(() => {
  const raw = route.params.tokenKey as string;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
});

// Steps
type Step = "form" | "confirm" | "sending" | "success" | "error";
const currentStep = ref<Step>("form");

// Token state
const token = ref<CustomToken | null>(null);
const tokenBalance = ref("0");
const isLoadingToken = ref(true);

// Form state
const recipient = ref("");
const amount = ref("");
const memo = ref("");

// Account state
const senderAddress = ref("");
const network = ref<NetworkName>("devnet");
const accountIndex = ref(0);
const accountName = ref("");

// Result state
const txid = ref("");
const errorMessage = ref("");

// Validation
const recipientError = ref("");
const amountError = ref("");

// Touched state
const touched = ref({
  recipient: false,
  amount: false,
});

// PIN
const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);
const pinError = ref("");

// Parse tokenKey (format: chainId:contractId)
function parseTokenKey(key: string): { chainId: NetworkName; contractId: string } | null {
  const parts = key.split(":");
  if (parts.length < 2) return null;
  const chainId = parts[0] as NetworkName;
  const contractId = parts.slice(1).join(":");
  return { chainId, contractId };
}

// Computed
const formattedBalance = computed(() => {
  if (!token.value) return "0";
  return formatTokenBalance(tokenBalance.value, token.value.decimals);
});

const formattedFee = computed(() => {
  return formatStxDisplay(microStxToStx(TOKEN_TRANSFER_FEE_MICRO_STX));
});

const headerTitle = computed(() => {
  if (!token.value) return "Send Token";
  switch (currentStep.value) {
    case "form": return `Send ${token.value.symbol}`;
    case "confirm": return "Confirm Send";
    case "sending": return "Sending...";
    case "success": return "Success!";
    case "error": return "Error";
    default: return `Send ${token.value.symbol}`;
  }
});

const showBackButton = computed(() => {
  return currentStep.value === "form" || currentStep.value === "confirm";
});

const canSubmit = computed(() => {
  if (!token.value) return false;
  if (!recipient.value.trim()) return false;
  if (!amount.value.trim()) return false;
  if (recipientError.value || amountError.value) return false;
  return true;
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
  if (!recipient.value || recipient.value.length <= 20) return recipient.value;
  return `${recipient.value.slice(0, 10)}...${recipient.value.slice(-10)}`;
});

// Validate recipient on blur
function validateRecipient() {
  touched.value.recipient = true;
  if (!recipient.value.trim()) {
    recipientError.value = "Recipient address is required";
    return;
  }
  const result = validateStxAddressWithError(recipient.value.trim(), network.value);
  recipientError.value = result.valid ? "" : (result.error || "Invalid address");
}

// Validate amount on blur
function validateAmount() {
  touched.value.amount = true;
  if (!amount.value.trim()) {
    amountError.value = "Amount is required";
    return;
  }

  const num = parseFloat(amount.value);
  if (isNaN(num) || num <= 0) {
    amountError.value = "Invalid amount";
    return;
  }

  // Check if amount exceeds balance
  if (token.value) {
    const amountBase = parseTokenAmount(amount.value, token.value.decimals);
    const balanceBase = BigInt(tokenBalance.value || "0");

    if (amountBase > balanceBase) {
      amountError.value = "Insufficient balance";
      return;
    }
  }

  amountError.value = "";
}

// Set max amount
function handleMax() {
  if (!token.value || !tokenBalance.value || tokenBalance.value === "0") return;

  amount.value = formatTokenAmount(BigInt(tokenBalance.value), token.value.decimals);
  validateAmount();
}

// Handle form submit - go to confirm step
function handleSubmit() {
  validateRecipient();
  validateAmount();

  if (!canSubmit.value) return;

  currentStep.value = "confirm";
  nextTick(() => {
    pinInputRef.value?.focus();
  });
}

// Handle back
function handleBack() {
  if (currentStep.value === "confirm") {
    currentStep.value = "form";
    pinError.value = "";
    return;
  }
  router.back();
}

// Handle PIN complete - execute transfer
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

    if (!token.value) {
      throw new Error("Token not loaded");
    }

    const amountBase = parseTokenAmount(amount.value, token.value.decimals);

    const result = await transferToken({
      contractId: token.value.contractId,
      recipient: recipient.value.trim(),
      amount: amountBase,
      memo: memo.value.trim() || undefined,
      senderKey: privateKey,
      senderAddress: senderAddress.value,
      network: network.value,
      decimals: token.value.decimals,
      symbol: token.value.symbol,
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

// Handle try again
function handleTryAgain() {
  errorMessage.value = "";
  pinError.value = "";
  currentStep.value = "form";
}

// Handle done
function handleDone() {
  router.push({ path: "/user" });
}

// Copy txid to clipboard
function copyTxid() {
  navigator.clipboard.writeText(txid.value);
}

// Open explorer
function openExplorer() {
  if (explorerUrl.value) {
    window.open(explorerUrl.value, "_blank");
  }
}

// Load token balance
async function loadTokenBalance(address: string, contractId: string) {
  try {
    const fungibleTokens = await fetchFungibleTokens(address, network.value);
    if (fungibleTokens && fungibleTokens[contractId]) {
      tokenBalance.value = fungibleTokens[contractId].balance;
    } else {
      tokenBalance.value = "0";
    }
  } catch {
    tokenBalance.value = "0";
  }
}

// Load token info
onBeforeMount(async () => {
  // Check session
  if (!sessionManager.hasWallet || sessionManager.isLocked) {
    router.push({ path: "/unlock" });
    return;
  }

  network.value = getSelectedNetwork();

  // Parse token key
  const parsed = parseTokenKey(tokenKey.value);
  if (!parsed) {
    errorMessage.value = "Invalid token key";
    isLoadingToken.value = false;
    return;
  }

  // Check network matches
  if (parsed.chainId !== network.value) {
    errorMessage.value = `Token is for ${parsed.chainId}, but you're on ${network.value}`;
    isLoadingToken.value = false;
    return;
  }

  // Load token info
  const tokenInfo = getCustomTokenByKey(parsed.chainId, parsed.contractId);
  if (!tokenInfo) {
    errorMessage.value = "Token not found";
    isLoadingToken.value = false;
    return;
  }

  token.value = tokenInfo;

  // Load account info
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

      // Load token balance
      await loadTokenBalance(senderAddress.value, parsed.contractId);
    }
  }

  isLoadingToken.value = false;
});
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

    <!-- Loading -->
    <div v-if="isLoadingToken" class="loading-state">
      <div class="spinner"></div>
      <p>Loading token...</p>
    </div>

    <!-- Error (initial load error) -->
    <div v-else-if="errorMessage && !token" class="error-state">
      <div class="error-icon">!</div>
      <p class="error-text">{{ errorMessage }}</p>
      <button class="back-btn-large" @click="handleBack">Go Back</button>
    </div>

    <!-- Form Step -->
    <div v-else-if="currentStep === 'form'" class="send-content">
      <!-- Token Info -->
      <div class="token-header">
        <div class="token-icon" :style="{ backgroundColor: token?.color + '20', borderColor: token?.color + '40' }">
          <span :style="{ color: token?.color }">{{ token?.symbol.charAt(0) }}</span>
        </div>
        <div class="token-info">
          <span class="token-symbol">{{ token?.symbol }}</span>
          <span class="token-balance">Balance: {{ formattedBalance }}</span>
        </div>
      </div>

      <!-- Recipient -->
      <FormField
        label="Recipient"
        :error="touched.recipient ? recipientError : ''"
        required
      >
        <input
          v-model="recipient"
          type="text"
          class="form-input"
          :placeholder="`${NETWORKS[network].addressPrefix}...`"
          @blur="validateRecipient"
        />
      </FormField>

      <!-- Amount -->
      <FormField
        label="Amount"
        :error="touched.amount ? amountError : ''"
        required
      >
        <div class="input-with-action">
          <input
            v-model="amount"
            type="text"
            inputmode="decimal"
            class="form-input form-input--with-action"
            placeholder="0.00"
            @blur="validateAmount"
          />
          <button class="max-btn" type="button" @click="handleMax">
            MAX
          </button>
        </div>
      </FormField>

      <!-- Memo (optional) -->
      <FormField label="Memo (optional)">
        <input
          v-model="memo"
          type="text"
          class="form-input"
          placeholder="Optional message"
          maxlength="34"
        />
      </FormField>

      <!-- Warning about fees -->
      <div class="fee-notice">
        <span class="fee-icon">i</span>
        <span class="fee-text">Network fee: {{ formattedFee }} STX</span>
      </div>
    </div>

    <!-- Confirm Step -->
    <div v-else-if="currentStep === 'confirm'" class="confirm-content">
      <p class="confirm-label">You are sending:</p>
      <p class="confirm-amount">{{ amount }} <span>{{ token?.symbol }}</span></p>

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
          <span class="confirm-key">Network Fee:</span>
          <span class="confirm-value">{{ formattedFee }} STX</span>
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

    <!-- Sending Step -->
    <div v-else-if="currentStep === 'sending'" class="content-center">
      <div class="spinner"></div>
      <p class="status-text">Broadcasting transaction...</p>
    </div>

    <!-- Success Step -->
    <div v-else-if="currentStep === 'success'" class="content-center">
      <div class="result-icon result-icon-success">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>
      <p class="result-title">Transaction Sent</p>

      <div class="result-card">
        <div class="result-row">
          <span class="result-key">Amount:</span>
          <span class="result-value">{{ amount }} {{ token?.symbol }}</span>
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

      <button v-if="explorerUrl" class="secondary-btn" @click="openExplorer">
        View in Explorer
      </button>

      <button class="primary-btn" @click="handleDone">Done</button>
    </div>

    <!-- Error Step -->
    <div v-else-if="currentStep === 'error'" class="content-center">
      <div class="result-icon result-icon-error">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </div>
      <p class="result-title">Transaction Failed</p>
      <p class="error-message">{{ errorMessage }}</p>

      <button class="primary-btn" @click="handleTryAgain">Try Again</button>
      <button class="secondary-btn" @click="handleDone">Cancel</button>
    </div>

    <!-- Footer CTA -->
    <template #footer>
      <StickyCTA
        v-if="currentStep === 'form'"
        primary-text="Review"
        :primary-disabled="!canSubmit"
        @primary="handleSubmit"
      />
    </template>
  </ScreenShell>
</template>

<style scoped>
.send-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  padding-bottom: 120px;
  overflow-y: auto;
}

.confirm-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  padding-bottom: 120px;
  overflow-y: auto;
}

.content-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-lg);
}

/* Loading & Error States */
.loading-state,
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  color: var(--color-text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-card);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error-icon {
  width: 56px;
  height: 56px;
  background: var(--color-error);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: bold;
  color: white;
}

.error-text {
  color: var(--color-text-secondary);
  text-align: center;
}

.back-btn-large {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: var(--space-md) var(--space-xl);
  color: var(--color-text-primary);
  cursor: pointer;
  width: auto;
}

/* Token Header */
.token-header {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.token-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.token-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.token-symbol {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.token-balance {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

/* Form Inputs */
.form-input {
  width: 100%;
  height: 52px;
  padding: 0 var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-family);
  transition: all var(--transition-fast);
}

.form-input::placeholder {
  color: var(--color-text-muted);
}

.form-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px var(--color-accent-primary-muted);
}

.form-input--with-action {
  padding-right: 80px;
}

/* Input with action button */
.input-with-action {
  position: relative;
  display: flex;
  align-items: center;
}

.max-btn {
  position: absolute;
  right: var(--space-md);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-accent-primary-muted);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--color-accent-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  width: auto;
  height: auto;
  min-width: auto;
}

.max-btn:hover {
  background: var(--color-accent-primary);
  color: var(--color-bg-primary);
}

/* Fee Notice */
.fee-notice {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-lg);
}

.fee-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(59, 130, 246, 0.3);
  border-radius: 50%;
  color: #60a5fa;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.fee-text {
  font-size: var(--font-size-sm);
  color: rgba(147, 197, 253, 0.9);
}

/* Confirm */
.confirm-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}

.confirm-amount {
  font-size: 2.5rem;
  font-weight: 800;
  color: var(--color-accent-primary);
  margin: 0;
}

.confirm-amount span {
  color: var(--color-text-primary);
}

.confirm-card {
  width: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.confirm-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.confirm-row:last-child {
  border-bottom: none;
}

.confirm-key {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.confirm-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-align: right;
  word-break: break-all;
  max-width: 60%;
}

.pin-section {
  width: 100%;
  margin-top: var(--space-md);
}

/* Status */
.status-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-top: var(--space-lg);
}

/* Result */
.result-icon {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: var(--space-lg);
}

.result-icon-success {
  background: var(--color-success);
  box-shadow: 0 0 30px rgba(34, 197, 94, 0.3);
}

.result-icon-error {
  background: var(--color-error);
  box-shadow: 0 0 30px rgba(239, 68, 68, 0.3);
}

.result-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-lg);
}

.result-card {
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
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
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
  font-family: var(--font-mono);
  color: var(--color-accent-primary);
}

.copy-btn {
  padding: var(--space-xs) var(--space-md);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all 0.15s ease;
  width: auto;
  height: auto;
  min-width: auto;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.error-message {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  margin: 0 0 var(--space-xl);
  max-width: 100%;
  word-break: break-word;
}

/* Buttons */
.primary-btn {
  width: 100%;
  height: 56px;
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-pill);
  color: #0a0a0a;
  font-size: var(--font-size-base);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-bottom: var(--space-sm);
}

.primary-btn:hover {
  filter: brightness(1.1);
}

.secondary-btn {
  width: 100%;
  height: 56px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-pill);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  margin-bottom: var(--space-sm);
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
