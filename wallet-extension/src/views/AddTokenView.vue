<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useRouter } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import FormField from "@/components/forms/FormField.vue";
import InlineError from "@/components/forms/InlineError.vue";
import StickyCTA from "@/components/layout/StickyCTA.vue";
import { TextField } from "@/components/ui";
import { getSelectedNetwork, NETWORKS, type NetworkName } from "@/utils/network";
import {
  getCustomTokens,
  addCustomToken,
  getTokenKey,
} from "@/utils/tokens/custom";

const router = useRouter();

// Current network
const currentNetwork = ref<NetworkName>("devnet");

// Form state
const contractId = ref("");
const tokenName = ref("");
const tokenSymbol = ref("");
const tokenDecimals = ref<number | null>(6);

// Existing custom tokens (for duplicate check)
const existingTokenKeys = ref<Set<string>>(new Set());

// Load current network and existing tokens
onBeforeMount(() => {
  currentNetwork.value = getSelectedNetwork();
  loadExistingTokens();
});

// Load existing token keys for duplicate check
function loadExistingTokens() {
  const tokens = getCustomTokens();
  existingTokenKeys.value = new Set(
    tokens.map((t) => getTokenKey(t.chainId, t.contractId))
  );
}

// Generate tokenKey for current network + contractId
const currentTokenKey = computed(() => {
  if (!contractId.value.trim()) return "";
  return `${currentNetwork.value}:${contractId.value.trim()}`;
});

// Check if token already exists
const isDuplicate = computed(() => {
  if (!currentTokenKey.value) return false;
  return existingTokenKeys.value.has(currentTokenKey.value);
});

// UI state
const isLoading = ref(false);
const submitError = ref("");

// Field touched state (for showing errors only after interaction)
const touched = ref({
  contractId: false,
  tokenName: false,
  tokenSymbol: false,
  tokenDecimals: false,
});

// Get expected address prefix for current network
const expectedPrefix = computed(() => NETWORKS[currentNetwork.value].addressPrefix);

// Validation
const contractIdError = computed(() => {
  if (!touched.value.contractId || !contractId.value) return "";

  const value = contractId.value.trim();

  // Check address prefix matches network
  if (!value.startsWith(expectedPrefix.value)) {
    return `Address must start with ${expectedPrefix.value} for ${NETWORKS[currentNetwork.value].name}`;
  }

  // Basic format: SP/ST + 38+ chars + dot + contract name
  const pattern = /^(SP|ST)[A-Z0-9]{38,}\.[a-zA-Z0-9_-]+(::[\w-]+)?$/;
  if (!pattern.test(value)) {
    return "Invalid format. Use: SP...contract-name or SP...contract::token";
  }

  // Check for duplicate
  if (isDuplicate.value) {
    return "Token already added for this network";
  }

  return "";
});

const tokenNameError = computed(() => {
  if (!touched.value.tokenName) return "";
  const name = tokenName.value.trim();
  if (!name) return "Token name is required";
  if (name.length < 2 || name.length > 32) return "Name must be 2-32 characters";
  return "";
});

const tokenSymbolError = computed(() => {
  if (!touched.value.tokenSymbol) return "";
  const symbol = tokenSymbol.value.trim();
  if (!symbol) return "Symbol is required";
  if (symbol.length < 2 || symbol.length > 10) return "Symbol must be 2-10 characters";
  if (!/^[A-Z0-9_]+$/i.test(symbol)) return "Only letters, numbers, and underscore";
  return "";
});

const tokenDecimalsError = computed(() => {
  if (!touched.value.tokenDecimals) return "";
  if (tokenDecimals.value === null || tokenDecimals.value === undefined) {
    return "Decimals is required";
  }
  if (tokenDecimals.value < 0 || tokenDecimals.value > 18) {
    return "Decimals must be 0-18";
  }
  if (!Number.isInteger(tokenDecimals.value)) {
    return "Decimals must be a whole number";
  }
  return "";
});

// Check if form is valid
const isFormValid = computed(() => {
  // Check all fields have values
  if (!contractId.value.trim()) return false;
  if (!tokenName.value.trim()) return false;
  if (!tokenSymbol.value.trim()) return false;
  if (tokenDecimals.value === null || tokenDecimals.value === undefined) return false;

  // Check contract ID format and network prefix
  const contractValue = contractId.value.trim();
  if (!contractValue.startsWith(expectedPrefix.value)) return false;
  const pattern = /^(SP|ST)[A-Z0-9]{38,}\.[a-zA-Z0-9_-]+(::[\w-]+)?$/;
  if (!pattern.test(contractValue)) return false;

  // Check for duplicate
  if (isDuplicate.value) return false;

  // Check other field validations
  if (tokenName.value.trim().length < 2 || tokenName.value.trim().length > 32) return false;
  if (tokenSymbol.value.trim().length < 2 || tokenSymbol.value.trim().length > 10) return false;
  if (!/^[A-Z0-9_]+$/i.test(tokenSymbol.value.trim())) return false;
  if (tokenDecimals.value < 0 || tokenDecimals.value > 18) return false;

  return true;
});

// Mark field as touched on blur
function handleBlur(field: keyof typeof touched.value) {
  touched.value[field] = true;
}

// Paste from clipboard
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    contractId.value = text.trim();
    touched.value.contractId = true;
  } catch (err) {
    console.error("Failed to paste:", err);
  }
}

// Add token and persist to storage
async function handleAddToken() {
  if (!isFormValid.value) return;

  // Mark all fields as touched to show any remaining errors
  Object.keys(touched.value).forEach((key) => {
    touched.value[key as keyof typeof touched.value] = true;
  });

  if (!isFormValid.value) return;

  submitError.value = "";
  isLoading.value = true;

  try {
    const added = addCustomToken({
      chainId: currentNetwork.value,
      contractId: contractId.value.trim(),
      name: tokenName.value.trim(),
      symbol: tokenSymbol.value.trim().toUpperCase(),
      decimals: tokenDecimals.value || 6,
    });

    if (!added) {
      submitError.value = "Token already exists for this network";
      return;
    }

    // Navigate back to manage tokens
    router.push({ path: "/manage-tokens" });
  } catch (err) {
    submitError.value = "Failed to add token. Please try again.";
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
  <ScreenShell :padded="false" data-roi="token-screen">
    <template #header>
      <AppHeader
        title="Add Token"
        left="back"
        data-roi="token-title"
        @left-click="handleBack"
      />
    </template>

    <!-- Content -->
    <div class="add-token-content" data-roi="token-form">
      <!-- Network Indicator -->
      <div class="network-indicator">
        <span class="network-label">Adding to:</span>
        <span class="network-badge">{{ NETWORKS[currentNetwork].name }}</span>
      </div>

      <!-- Contract ID Field -->
      <FormField
        label="Contract Address"
        hint="SIP-010 contract address (e.g., SP...contract-name)"
        :error="contractIdError"
        required
      >
        <TextField
          v-model="contractId"
          placeholder="SP32A..."
          :error="contractIdError"
          @blur="handleBlur('contractId')"
        >
          <template #suffix>
            <button class="paste-btn" type="button" @click="handlePaste">
              PASTE
            </button>
          </template>
        </TextField>
      </FormField>

      <!-- Token Name Field -->
      <FormField
        label="Token Name"
        :error="tokenNameError"
        required
      >
        <TextField
          v-model="tokenName"
          placeholder="e.g., MiamiCoin"
          :maxlength="32"
          :error="tokenNameError"
          @blur="handleBlur('tokenName')"
        />
      </FormField>

      <!-- Symbol & Decimals Row -->
      <div class="form-row">
        <FormField
          label="Symbol"
          :error="tokenSymbolError"
          required
        >
          <TextField
            v-model="tokenSymbol"
            uppercase
            placeholder="MIA"
            :maxlength="10"
            :error="tokenSymbolError"
            @blur="handleBlur('tokenSymbol')"
          />
        </FormField>

        <FormField
          label="Decimals"
          :error="tokenDecimalsError"
          required
        >
          <TextField
            :model-value="tokenDecimals ?? ''"
            type="number"
            placeholder="6"
            :min="0"
            :max="18"
            :error="tokenDecimalsError"
            @update:model-value="tokenDecimals = $event ? Number($event) : null"
            @blur="handleBlur('tokenDecimals')"
          />
        </FormField>
      </div>

      <!-- Preview Card -->
      <div class="preview-section" data-roi="token-preview">
        <h3 class="preview-title">Preview</h3>
        <div class="preview-card">
          <div class="preview-left">
            <div class="preview-icon">
              <span>{{ tokenSymbol?.charAt(0)?.toUpperCase() || '?' }}</span>
            </div>
            <div class="preview-info">
              <span class="preview-name">{{ tokenName || 'Token Name' }}</span>
              <span class="preview-symbol">{{ tokenSymbol?.toUpperCase() || 'SYM' }}</span>
            </div>
          </div>
          <div class="preview-right">
            <span class="preview-balance">0.00</span>
            <span class="preview-label">Balance</span>
          </div>
        </div>
      </div>

      <!-- Info Notice -->
      <div class="info-notice">
        <span class="info-icon">ℹ</span>
        <p class="info-text">
          Adding a custom token does not verify its authenticity.
          Please ensure the contract address is correct.
        </p>
      </div>

      <!-- Submit Error -->
      <InlineError v-if="submitError" :message="submitError" />
    </div>

    <!-- Sticky CTA -->
    <template #footer>
      <StickyCTA
        :primary-text="isLoading ? 'Adding...' : 'Add Token'"
        :primary-disabled="!isFormValid || isLoading"
        data-roi="token-cta"
        @primary="handleAddToken"
      />
    </template>
  </ScreenShell>
</template>

<style scoped>
.add-token-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  padding-bottom: 120px;
  overflow-y: auto;
}

/* Network Indicator */
.network-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.network-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.network-badge {
  padding: var(--space-xs) var(--space-sm);
  background: rgba(255, 255, 255, 0.08); /* v17: neutral badge */
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Form Row (side by side fields) */
.form-row {
  display: flex;
  gap: var(--space-lg);
}

.form-row > * {
  flex: 1;
}

/* Form inputs now use TextField component */

/* Paste button inside TextField suffix - v17: neutral secondary action */
.paste-btn {
  padding: var(--space-sm) var(--space-md);
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: var(--radius-lg);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  width: auto;
  height: auto;
  min-width: auto;
}

.paste-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: var(--color-text-primary);
}

/* Preview Section */
.preview-section {
  margin-top: var(--space-sm);
}

.preview-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-sm) var(--space-xs);
}

.preview-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.preview-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.preview-icon {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  border-radius: 50%;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
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
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.preview-symbol {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.preview-right {
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preview-balance {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
}

.preview-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Info Notice */
.info-notice {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: var(--radius-lg);
}

.info-icon {
  color: #60a5fa;
  font-size: var(--font-size-base);
  flex-shrink: 0;
}

.info-text {
  font-size: var(--font-size-xs);
  color: rgba(147, 197, 253, 0.9);
  line-height: 1.5;
  margin: 0;
}
</style>
