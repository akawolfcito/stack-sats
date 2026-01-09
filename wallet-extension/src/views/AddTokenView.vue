<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

// Storage keys
const CUSTOM_TOKENS_KEY = "custom_tokens";
const ENABLED_TOKENS_KEY = "enabled_tokens";

// Form state
const contractAddress = ref("");
const tokenName = ref("");
const tokenSymbol = ref("");
const tokenDecimals = ref<number | null>(6);

// UI state
const isLoading = ref(false);
const error = ref("");
const success = ref(false);

// Custom token interface
interface CustomToken {
  contractId: string;
  name: string;
  symbol: string;
  decimals: number;
  color: string;
}

// Validate contract address format
const isValidContractFormat = computed(() => {
  const addr = contractAddress.value.trim();
  if (!addr) return false;

  // Format: SP... or ST... followed by contract name
  // Examples:
  // SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex
  // SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex::alex
  const contractPattern = /^(SP|ST)[A-Z0-9]{38,}\.[a-zA-Z0-9_-]+(::[\w-]+)?$/;
  return contractPattern.test(addr);
});

// Check if form is valid
const isFormValid = computed(() => {
  return (
    isValidContractFormat.value &&
    tokenName.value.trim().length > 0 &&
    tokenSymbol.value.trim().length > 0 &&
    tokenDecimals.value !== null &&
    tokenDecimals.value >= 0 &&
    tokenDecimals.value <= 18
  );
});

// Generate a random color for the token
function generateTokenColor(): string {
  const colors = [
    "#7c3aed", "#f97316", "#eab308", "#3b82f6",
    "#22c55e", "#ec4899", "#06b6d4", "#f7931a",
    "#8b5cf6", "#10b981", "#f59e0b", "#ef4444",
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Load custom tokens from localStorage
function getCustomTokens(): CustomToken[] {
  const stored = localStorage.getItem(CUSTOM_TOKENS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as CustomToken[];
  } catch {
    return [];
  }
}

// Save custom tokens to localStorage
function saveCustomTokens(tokens: CustomToken[]): void {
  localStorage.setItem(CUSTOM_TOKENS_KEY, JSON.stringify(tokens));
}

// Load enabled tokens
function getEnabledTokens(): Set<string> {
  const stored = localStorage.getItem(ENABLED_TOKENS_KEY);
  if (!stored) return new Set(["STX"]);

  try {
    return new Set(JSON.parse(stored) as string[]);
  } catch {
    return new Set(["STX"]);
  }
}

// Save enabled tokens
function saveEnabledTokens(tokens: Set<string>): void {
  localStorage.setItem(ENABLED_TOKENS_KEY, JSON.stringify(Array.from(tokens)));
}

// Paste from clipboard
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    contractAddress.value = text.trim();
  } catch (err) {
    console.error("Failed to paste:", err);
  }
}

// Add token
async function handleAddToken() {
  if (!isFormValid.value) return;

  error.value = "";
  isLoading.value = true;

  try {
    const contractId = contractAddress.value.trim();

    // Check if token already exists
    const customTokens = getCustomTokens();
    const exists = customTokens.some((t) => t.contractId === contractId);

    if (exists) {
      error.value = "This token has already been added";
      isLoading.value = false;
      return;
    }

    // Create new token
    const newToken: CustomToken = {
      contractId,
      name: tokenName.value.trim(),
      symbol: tokenSymbol.value.trim().toUpperCase(),
      decimals: tokenDecimals.value || 6,
      color: generateTokenColor(),
    };

    // Save to custom tokens
    customTokens.push(newToken);
    saveCustomTokens(customTokens);

    // Enable the token automatically
    const enabledTokens = getEnabledTokens();
    enabledTokens.add(contractId);
    saveEnabledTokens(enabledTokens);

    // Show success and navigate back
    success.value = true;
    setTimeout(() => {
      router.back();
    }, 1000);
  } catch (err) {
    error.value = "Failed to add token. Please try again.";
  } finally {
    isLoading.value = false;
  }
}

// Navigation
function handleBack() {
  router.back();
}
</script>

<template>
  <div class="add-token-view">
    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="handleBack">
        <span class="back-arrow">&larr;</span>
      </button>
      <h1 class="title">Custom Token</h1>
      <div class="header-spacer"></div>
    </header>

    <!-- Content -->
    <main class="content">
      <!-- Contract Address Input -->
      <div class="input-group">
        <label class="input-label" for="contract-address">Contract Address</label>
        <div class="input-wrapper">
          <input
            id="contract-address"
            v-model="contractAddress"
            type="text"
            class="input contract-input"
            placeholder="SP32A..."
            :class="{ invalid: contractAddress && !isValidContractFormat }"
          />
          <button class="paste-btn" @click="handlePaste">
            <span class="paste-icon">&#128203;</span>
            PASTE
          </button>
        </div>
        <p class="input-hint">SIP-010 contract address required</p>
        <p v-if="contractAddress && !isValidContractFormat" class="input-error">
          Invalid format. Use: SP...contract-name or SP...contract::token
        </p>
      </div>

      <!-- Token Name -->
      <div class="input-group">
        <label class="input-label" for="token-name">Token Name</label>
        <input
          id="token-name"
          v-model="tokenName"
          type="text"
          class="input"
          placeholder="e.g. MiamiCoin"
        />
      </div>

      <!-- Symbol & Decimals Row -->
      <div class="row-inputs">
        <div class="input-group half">
          <label class="input-label" for="token-symbol">Symbol</label>
          <input
            id="token-symbol"
            v-model="tokenSymbol"
            type="text"
            class="input uppercase"
            placeholder="MIA"
            maxlength="10"
          />
        </div>
        <div class="input-group half">
          <label class="input-label" for="token-decimals">Decimals</label>
          <input
            id="token-decimals"
            v-model.number="tokenDecimals"
            type="number"
            class="input"
            placeholder="6"
            min="0"
            max="18"
          />
        </div>
      </div>

      <!-- Preview Section -->
      <div class="preview-section">
        <h3 class="preview-title">Preview</h3>

        <!-- Preview Card -->
        <div class="preview-card">
          <div class="preview-glow"></div>
          <div class="preview-content">
            <div class="preview-left">
              <div class="preview-icon">
                <span class="preview-icon-text">{{ tokenSymbol?.charAt(0) || '?' }}</span>
              </div>
              <div class="preview-info">
                <span class="preview-name">{{ tokenName || 'Token Name' }}</span>
                <span class="preview-symbol">{{ tokenSymbol?.toUpperCase() || 'SYM' }}</span>
              </div>
            </div>
            <div class="preview-right">
              <span class="preview-balance">0.00</span>
              <span class="preview-balance-label">Balance</span>
            </div>
          </div>
        </div>

        <!-- Info Message -->
        <div class="info-message">
          <span class="info-icon">&#9432;</span>
          <p class="info-text">
            Adding a custom token does not verify its authenticity. Please ensure the contract address is correct.
          </p>
        </div>
      </div>

      <!-- Error Message -->
      <p v-if="error" class="error-message">{{ error }}</p>

      <!-- Success Message -->
      <p v-if="success" class="success-message">Token added successfully!</p>
    </main>

    <!-- Add Button -->
    <div class="footer">
      <button
        class="add-btn"
        :class="{ disabled: !isFormValid || isLoading }"
        :disabled="!isFormValid || isLoading"
        @click="handleAddToken"
      >
        <span v-if="isLoading" class="spinner-small"></span>
        <span v-else class="add-icon">&#10133;</span>
        {{ isLoading ? 'Adding...' : 'Add Token' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.add-token-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
  position: relative;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  padding-top: var(--space-xl);
  position: sticky;
  top: 0;
  z-index: 50;
  background: var(--color-bg-primary);
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
  border-radius: var(--radius-pill);
}

.back-btn:hover {
  background: var(--color-bg-card);
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.header-spacer {
  width: 40px;
}

/* Content */
.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-lg);
  padding-bottom: 120px;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* Input Groups */
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.input-group.half {
  flex: 1;
}

.row-inputs {
  display: flex;
  gap: var(--space-lg);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-left: var(--space-xs);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input {
  width: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  outline: none;
  transition: all var(--transition-fast);
}

.input::placeholder {
  color: var(--color-text-muted);
}

.input:focus {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px var(--color-accent-primary-muted);
}

.input.invalid {
  border-color: var(--color-error);
}

.input.uppercase {
  text-transform: uppercase;
}

.contract-input {
  padding-right: 100px;
}

.paste-btn {
  position: absolute;
  right: var(--space-md);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
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
}

.paste-btn:hover {
  background: var(--color-accent-primary);
  color: var(--color-bg-primary);
}

.paste-icon {
  font-size: var(--font-size-sm);
}

.input-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: var(--space-xs);
}

.input-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin-left: var(--space-xs);
}

/* Preview Section */
.preview-section {
  margin-top: var(--space-md);
}

.preview-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-lg) var(--space-xs);
}

.preview-card {
  position: relative;
  overflow: hidden;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
}

.preview-glow {
  position: absolute;
  top: -40px;
  right: -40px;
  width: 128px;
  height: 128px;
  background: var(--color-accent-primary);
  opacity: 0.05;
  border-radius: 50%;
  filter: blur(40px);
  pointer-events: none;
}

.preview-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.preview-left {
  display: flex;
  align-items: center;
  gap: var(--space-lg);
}

.preview-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-icon-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-muted);
}

.preview-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-name {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
}

.preview-symbol {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.preview-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-balance {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.preview-balance-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Info Message */
.info-message {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  margin-top: var(--space-lg);
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-lg);
}

.info-icon {
  color: #60a5fa;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.info-text {
  font-size: var(--font-size-xs);
  color: rgba(147, 197, 253, 0.8);
  line-height: 1.5;
  margin: 0;
}

/* Messages */
.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

.success-message {
  color: var(--color-success);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

/* Footer */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-lg);
  background: linear-gradient(to top, var(--color-bg-primary) 60%, transparent);
  z-index: 40;
}

.add-btn {
  width: 100%;
  height: 56px;
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-xl);
  color: var(--color-bg-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  transition: all var(--transition-base);
  box-shadow: 0 0 15px var(--color-accent-primary-muted);
}

.add-btn:hover:not(.disabled) {
  background: var(--color-accent-primary-hover);
  transform: translateY(-1px);
}

.add-btn:active:not(.disabled) {
  transform: scale(0.98);
}

.add-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.add-icon {
  font-size: 1.25rem;
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-bg-primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
