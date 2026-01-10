<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useRouter, useRoute } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import StickyCTA from "@/components/layout/StickyCTA.vue";
import FormField from "@/components/forms/FormField.vue";
import InlineError from "@/components/forms/InlineError.vue";
import { sessionManager } from "@/utils/security/session";
import { getSelectedNetwork, NETWORKS, type NetworkName } from "@/utils/network";
import { validateStxAddressWithError } from "@/utils/transfer";
import { formatTokenBalance } from "@/utils/tokens";
import {
  getCustomTokenByKey,
  type CustomToken,
} from "@/utils/tokens/custom";

const router = useRouter();
const route = useRoute();

// Get tokenKey from route params
const tokenKey = computed(() => route.params.tokenKey as string);

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

const canSubmit = computed(() => {
  if (!token.value) return false;
  if (!recipient.value.trim()) return false;
  if (!amount.value.trim()) return false;
  if (recipientError.value || amountError.value) return false;
  return true;
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
    const decimals = token.value.decimals;
    const amountBase = BigInt(Math.floor(num * Math.pow(10, decimals)));
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

  const decimals = token.value.decimals;
  const balance = BigInt(tokenBalance.value);
  const divisor = BigInt(Math.pow(10, decimals));
  const whole = balance / divisor;
  const frac = balance % divisor;

  if (frac === 0n) {
    amount.value = whole.toString();
  } else {
    const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
    amount.value = `${whole}.${fracStr}`;
  }

  validateAmount();
}

// Handle form submit
function handleSubmit() {
  validateRecipient();
  validateAmount();

  if (!canSubmit.value) return;

  // Move to confirm step (actual transfer in Commit 6)
  currentStep.value = "confirm";
}

// Handle back
function handleBack() {
  if (currentStep.value === "confirm") {
    currentStep.value = "form";
    return;
  }
  router.back();
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

  const mnemonic = sessionManager.getMnemonic();
  if (mnemonic) {
    const { generateInitialAccounts } = await import("@/utils/accounts");
    const numAccounts = accountIndex.value + 1;
    const accounts = await generateInitialAccounts(mnemonic, numAccounts, network.value);
    if (accounts[accountIndex.value]) {
      senderAddress.value = accounts[accountIndex.value].stxAddress;
    }
  }

  // TODO: Fetch actual token balance (for now use 0)
  tokenBalance.value = "0";

  isLoadingToken.value = false;
});
</script>

<template>
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        :title="headerTitle"
        left="back"
        @left-click="handleBack"
      />
    </template>

    <!-- Loading -->
    <div v-if="isLoadingToken" class="loading-state">
      <div class="spinner"></div>
      <p>Loading token...</p>
    </div>

    <!-- Error -->
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
        <span class="fee-icon">ℹ</span>
        <span class="fee-text">Network fees will be paid in STX</span>
      </div>
    </div>

    <!-- Confirm Step -->
    <div v-else-if="currentStep === 'confirm'" class="confirm-content">
      <div class="confirm-card">
        <div class="confirm-row">
          <span class="confirm-label">Token</span>
          <span class="confirm-value">{{ token?.symbol }}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">Amount</span>
          <span class="confirm-value">{{ amount }} {{ token?.symbol }}</span>
        </div>
        <div class="confirm-row">
          <span class="confirm-label">To</span>
          <span class="confirm-value mono">{{ recipient.slice(0, 10) }}...{{ recipient.slice(-10) }}</span>
        </div>
        <div v-if="memo" class="confirm-row">
          <span class="confirm-label">Memo</span>
          <span class="confirm-value">{{ memo }}</span>
        </div>
      </div>

      <InlineError message="Token transfers are coming in the next update" icon="🚧" />
    </div>

    <!-- Footer CTA -->
    <template #footer>
      <StickyCTA
        v-if="currentStep === 'form'"
        primary-text="Review"
        :primary-disabled="!canSubmit"
        @primary="handleSubmit"
      />
      <StickyCTA
        v-else-if="currentStep === 'confirm'"
        primary-text="Send (Coming Soon)"
        :primary-disabled="true"
        @primary="() => {}"
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
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  padding-bottom: 120px;
  overflow-y: auto;
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
  color: #60a5fa;
  font-size: var(--font-size-base);
  flex-shrink: 0;
}

.fee-text {
  font-size: var(--font-size-sm);
  color: rgba(147, 197, 253, 0.9);
}

/* Confirm Card */
.confirm-card {
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

.confirm-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.confirm-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-align: right;
}

.confirm-value.mono {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
}
</style>
