<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  fetchTransaction,
  formatAmount,
  formatFullDateTime,
  truncateAddress,
  getTransactionTypeLabel,
  getStatusLabel,
  getExplorerUrl,
  type Transaction,
  type TransactionStatus,
} from "@/utils/transactions";
import { getSelectedNetwork, type NetworkName } from "@/utils/network";
import { microStxToStx, formatStxDisplay } from "@/utils/transfer";

const router = useRouter();
const route = useRoute();

// State
const transaction = ref<Transaction | null>(null);
const isLoading = ref(true);
const error = ref("");
const network = ref<NetworkName>("devnet");

// Get txId from route params
const txId = computed(() => route.params.txId as string);

// Computed
const isOutgoing = computed(() => {
  // This would need the user's address to determine
  // For now, we'll show it based on having a recipient
  return transaction.value?.recipient !== undefined;
});

const displayAmount = computed(() => {
  if (!transaction.value?.amount) return null;
  const stx = microStxToStx(transaction.value.amount);
  const formatted = formatStxDisplay(stx);
  const prefix = isOutgoing.value ? "-" : "+";
  return `${prefix}${formatted} STX`;
});

const displayFee = computed(() => {
  if (!transaction.value?.fee) return "0 STX";
  const stx = microStxToStx(transaction.value.fee);
  return `${formatStxDisplay(stx)} STX`;
});

const statusClass = computed(() => {
  if (!transaction.value) return "";
  const status = transaction.value.status;
  if (status === "success") return "status-success";
  if (status === "pending") return "status-pending";
  return "status-failed";
});

const explorerUrl = computed(() => {
  if (!transaction.value) return "";
  return getExplorerUrl(transaction.value.txId, network.value);
});

// Load transaction
onBeforeMount(async () => {
  network.value = getSelectedNetwork();

  if (!txId.value) {
    error.value = "No transaction ID provided";
    isLoading.value = false;
    return;
  }

  try {
    const tx = await fetchTransaction(txId.value, network.value);
    if (tx) {
      transaction.value = tx;
    } else {
      error.value = "Transaction not found";
    }
  } catch (e) {
    error.value = "Failed to load transaction";
  } finally {
    isLoading.value = false;
  }
});

// Actions
function handleBack() {
  router.back();
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function openExplorer() {
  if (explorerUrl.value) {
    window.open(explorerUrl.value, "_blank");
  }
}
</script>

<template>
  <div class="tx-details-view">
    <!-- Header -->
    <header class="tx-header">
      <button class="back-btn" @click="handleBack">
        <span class="back-arrow">&larr;</span>
      </button>
      <h1 class="tx-title">Transaction Details</h1>
      <div class="header-spacer"></div>
    </header>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading transaction...</p>
    </div>

    <!-- Error -->
    <div v-else-if="error" class="error-state">
      <div class="error-icon">!</div>
      <p class="error-message">{{ error }}</p>
      <button class="back-btn-large" @click="handleBack">Go Back</button>
    </div>

    <!-- Transaction Details -->
    <main v-else-if="transaction" class="tx-content">
      <!-- Hero Section -->
      <div class="tx-hero">
        <!-- Token Icon -->
        <div class="token-icon-wrapper">
          <div class="token-icon">
            <span class="token-symbol">STX</span>
          </div>
          <div class="direction-badge" :class="{ outgoing: isOutgoing }">
            <span v-if="isOutgoing">&nearr;</span>
            <span v-else>&swarr;</span>
          </div>
        </div>

        <!-- Amount -->
        <h2 v-if="displayAmount" class="tx-amount" :class="{ outgoing: isOutgoing }">
          {{ displayAmount }}
        </h2>
        <h2 v-else class="tx-amount type-label">
          {{ getTransactionTypeLabel(transaction.type) }}
        </h2>

        <!-- Meta Info -->
        <p class="tx-meta">
          {{ formatFullDateTime(transaction.timestamp) }}
        </p>

        <!-- Status Chip -->
        <div class="status-chip" :class="statusClass">
          <span class="status-icon">
            <template v-if="transaction.status === 'success'">&check;</template>
            <template v-else-if="transaction.status === 'pending'">&hellip;</template>
            <template v-else>&times;</template>
          </span>
          <span class="status-text">{{ getStatusLabel(transaction.status) }}</span>
        </div>
      </div>

      <!-- Details Card -->
      <div class="details-card">
        <!-- Type -->
        <div class="detail-row">
          <span class="detail-label">Type</span>
          <span class="detail-value">{{ getTransactionTypeLabel(transaction.type) }}</span>
        </div>

        <!-- Status -->
        <div class="detail-row">
          <span class="detail-label">Status</span>
          <span class="detail-value">{{ getStatusLabel(transaction.status) }}</span>
        </div>

        <!-- From -->
        <div class="detail-row">
          <span class="detail-label">From</span>
          <div class="detail-value-with-action">
            <span class="address">{{ truncateAddress(transaction.sender, 4) }}</span>
            <button class="copy-btn" @click="copyToClipboard(transaction.sender)">
              <span class="copy-icon">&#x2398;</span>
            </button>
          </div>
        </div>

        <!-- To (if transfer) -->
        <div v-if="transaction.recipient" class="detail-row">
          <span class="detail-label">To</span>
          <div class="detail-value-with-action">
            <span class="address">{{ truncateAddress(transaction.recipient, 4) }}</span>
            <button class="copy-btn" @click="copyToClipboard(transaction.recipient)">
              <span class="copy-icon">&#x2398;</span>
            </button>
          </div>
        </div>

        <!-- Contract (if contract call) -->
        <div v-if="transaction.contractId" class="detail-row">
          <span class="detail-label">Contract</span>
          <div class="detail-value-with-action">
            <span class="address">{{ truncateAddress(transaction.contractId, 6) }}</span>
            <button class="copy-btn" @click="copyToClipboard(transaction.contractId)">
              <span class="copy-icon">&#x2398;</span>
            </button>
          </div>
        </div>

        <!-- Function (if contract call) -->
        <div v-if="transaction.functionName" class="detail-row">
          <span class="detail-label">Function</span>
          <span class="detail-value function-name">{{ transaction.functionName }}</span>
        </div>

        <!-- Transaction ID -->
        <div class="detail-row">
          <span class="detail-label">Transaction ID</span>
          <div class="detail-value-with-action">
            <span class="address">{{ truncateAddress(transaction.txId, 6) }}</span>
            <button class="copy-btn" @click="copyToClipboard(transaction.txId)">
              <span class="copy-icon">&#x2398;</span>
            </button>
          </div>
        </div>

        <!-- Fee -->
        <div class="detail-row">
          <span class="detail-label">Network Fee</span>
          <span class="detail-value">{{ displayFee }}</span>
        </div>

        <!-- Memo (if present) -->
        <div v-if="transaction.memo" class="detail-row">
          <span class="detail-label">Memo</span>
          <span class="detail-value memo">{{ transaction.memo }}</span>
        </div>
      </div>

      <!-- Explorer Button -->
      <button class="explorer-btn" @click="openExplorer">
        View in Explorer
        <span class="external-icon">&nearr;</span>
      </button>
    </main>
  </div>
</template>

<style scoped>
.tx-details-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
}

/* Header */
.tx-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  padding-top: var(--space-xl);
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

.tx-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.header-spacer {
  width: 40px;
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

.error-message {
  color: var(--color-text-secondary);
}

.back-btn-large {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: var(--space-md) var(--space-xl);
  color: var(--color-text-primary);
  cursor: pointer;
}

/* Content */
.tx-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 var(--space-lg) var(--space-xl);
  overflow-y: auto;
}

/* Hero Section */
.tx-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-xl) 0;
}

.token-icon-wrapper {
  position: relative;
  margin-bottom: var(--space-lg);
}

.token-icon {
  width: 64px;
  height: 64px;
  background: linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-card));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 20px var(--color-accent-primary-muted);
}

.token-symbol {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.direction-badge {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 24px;
  height: 24px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: var(--color-success);
}

.direction-badge.outgoing {
  color: var(--color-text-primary);
}

.tx-amount {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-success);
  margin: 0 0 var(--space-sm);
}

.tx-amount.outgoing {
  color: var(--color-text-primary);
}

.tx-amount.type-label {
  font-size: var(--font-size-2xl);
  color: var(--color-text-primary);
}

.tx-meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-lg);
}

/* Status Chip */
.status-chip {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.status-chip.status-success {
  background: var(--color-accent-primary-muted);
  color: var(--color-accent-primary);
  border: 1px solid var(--color-accent-primary);
}

.status-chip.status-pending {
  background: var(--color-warning);
  background-opacity: 0.1;
  color: var(--color-warning);
  border: 1px solid var(--color-warning);
}

.status-chip.status-failed {
  background: rgba(255, 76, 76, 0.1);
  color: var(--color-error);
  border: 1px solid var(--color-error);
}

.status-icon {
  font-size: 14px;
}

/* Details Card */
.details-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  margin-bottom: var(--space-xl);
}

.detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.detail-row:last-child {
  border-bottom: none;
}

.detail-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.detail-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.detail-value-with-action {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.address {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.function-name {
  font-family: var(--font-mono);
  color: var(--color-accent-primary);
}

.memo {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  background: none;
  border: none;
  padding: var(--space-xs);
  cursor: pointer;
  color: var(--color-text-muted);
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  width: auto;
}

.copy-btn:hover {
  color: var(--color-accent-primary);
  background: var(--color-bg-elevated);
}

.copy-icon {
  font-size: 14px;
}

/* Explorer Button */
.explorer-btn {
  width: 100%;
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-pill);
  padding: var(--space-lg);
  color: var(--color-bg-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: auto;
  transition: all var(--transition-base);
}

.explorer-btn:hover {
  background: var(--color-accent-primary-hover);
  transform: translateY(-1px);
}

.external-icon {
  font-size: 1.1em;
}
</style>
