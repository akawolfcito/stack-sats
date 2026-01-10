<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useRouter, useRoute } from "vue-router";
import {
  fetchTransaction,
  formatFullDateTime,
  truncateAddress,
  getTransactionTypeLabel,
  getExplorerUrl,
  type Transaction,
} from "@/utils/transactions";
import { getSelectedNetwork, type NetworkName } from "@/utils/network";
import { microStxToStx, formatStxDisplay } from "@/utils/transfer";
import TxStatusBadge from "@/components/transaction/TxStatusBadge.vue";
import TxDetailRow from "@/components/transaction/TxDetailRow.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";

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

const txStatus = computed(() => {
  if (!transaction.value) return "pending";
  return transaction.value.status as "pending" | "success" | "failed";
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

function openExplorer() {
  if (explorerUrl.value) {
    window.open(explorerUrl.value, "_blank");
  }
}
</script>

<template>
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        title="Transaction Details"
        left="back"
        @left-click="handleBack"
      />
    </template>

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
      <!-- Hero Section (compact) -->
      <div class="tx-hero">
        <!-- Amount + Status row -->
        <div class="hero-main">
          <div class="token-icon">
            <span>STX</span>
          </div>
          <div class="hero-info">
            <h2 v-if="displayAmount" class="tx-amount" :class="{ outgoing: isOutgoing }">
              {{ displayAmount }}
            </h2>
            <h2 v-else class="tx-amount type-label">
              {{ getTransactionTypeLabel(transaction.type) }}
            </h2>
            <p class="tx-meta">{{ formatFullDateTime(transaction.timestamp) }}</p>
          </div>
          <TxStatusBadge :status="txStatus" compact />
        </div>
      </div>

      <!-- Details Card -->
      <div class="details-card">
        <TxDetailRow
          label="Type"
          :value="getTransactionTypeLabel(transaction.type)"
        />
        <TxDetailRow
          label="From"
          :value="truncateAddress(transaction.sender, 4)"
          :copyValue="transaction.sender"
          copyable
          mono
        />
        <TxDetailRow
          v-if="transaction.recipient"
          label="To"
          :value="truncateAddress(transaction.recipient, 4)"
          :copyValue="transaction.recipient"
          copyable
          mono
        />
        <TxDetailRow
          v-if="transaction.contractId"
          label="Contract"
          :value="truncateAddress(transaction.contractId, 6)"
          :copyValue="transaction.contractId"
          copyable
          mono
        />
        <TxDetailRow
          v-if="transaction.functionName"
          label="Function"
          :value="transaction.functionName"
          mono
          accent
        />
        <TxDetailRow
          label="Tx ID"
          :value="truncateAddress(transaction.txId, 6)"
          :copyValue="transaction.txId"
          copyable
          mono
        />
        <TxDetailRow
          label="Fee"
          :value="displayFee"
        />
        <TxDetailRow
          v-if="transaction.memo"
          label="Memo"
          :value="transaction.memo"
          truncate
        />
      </div>

      <!-- Explorer Button -->
      <button class="explorer-btn" @click="openExplorer">
        <span>View in Explorer</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          <polyline points="15 3 21 3 21 9" />
          <line x1="10" y1="14" x2="21" y2="3" />
        </svg>
      </button>
    </main>
  </ScreenShell>
</template>

<style scoped>
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
  padding: 0 var(--space-md) var(--space-lg);
  overflow-y: auto;
  gap: var(--space-md);
}

/* Hero Section (Compact) */
.tx-hero {
  padding: var(--space-sm) 0;
}

.hero-main {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.token-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-card));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.token-icon span {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.hero-info {
  flex: 1;
  min-width: 0;
}

.tx-amount {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-success);
  margin: 0;
  line-height: 1.2;
}

.tx-amount.outgoing {
  color: var(--color-text-primary);
}

.tx-amount.type-label {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}

.tx-meta {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 2px 0 0;
}

/* Details Card */
.details-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
  margin-bottom: var(--space-lg);
}

/* Explorer Button */
.explorer-btn {
  width: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: auto;
  transition: all 0.15s ease;
}

.explorer-btn:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.explorer-btn svg {
  flex-shrink: 0;
}
</style>
