<script setup lang="ts">
/**
 * ConfirmTxView - V51.1 Fullscreen Confirm Transaction
 *
 * Design rule: Fullscreen for security-critical/irreversible steps
 * (Verify PIN, Confirm Tx, Delete Wallet confirm)
 *
 * V51.1 Polish:
 * - Typography hierarchy: Total dominates, addresses subdued
 * - Grid rhythm: From/To block + Amount/Fee/Total block
 * - Network chip: smaller, doesn't compete with header
 * - Warning card: softer, single-line when possible
 */
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { Button } from "@/components/ui";

const router = useRouter();
const route = useRoute();

// Transaction data from query params
const networkLabel = ref("");
const fromLabel = ref("");
const fromAddressShort = ref("");
const toAddress = ref("");
const toAddressShort = ref("");
const amountText = ref("");
const feeText = ref("");
const totalText = ref("");
const memo = ref("");

// Computed: check if test/dev network
const isTestOrDev = computed(() => {
  const label = networkLabel.value.toLowerCase();
  return label.includes("test") || label.includes("dev");
});

// Parse query params on mount
onMounted(() => {
  networkLabel.value = (route.query.networkLabel as string) || "Mainnet";
  fromLabel.value = (route.query.fromLabel as string) || "";
  fromAddressShort.value = (route.query.fromAddressShort as string) || "";
  toAddress.value = (route.query.toAddress as string) || "";
  toAddressShort.value = (route.query.toAddressShort as string) || "";
  amountText.value = (route.query.amountText as string) || "";
  feeText.value = (route.query.feeText as string) || "";
  totalText.value = (route.query.totalText as string) || "";
  memo.value = (route.query.memo as string) || "";

  // Validate we have required data
  if (!toAddress.value || !amountText.value) {
    router.push({ path: "/send" });
  }
});

function handleCopyTo() {
  navigator.clipboard.writeText(toAddress.value);
}

function handleCancel() {
  router.push({ path: "/send", query: { cancelled: "true" } });
}

function handleConfirm() {
  // Navigate back to SendView with confirmed flag to proceed to PIN step
  router.push({ path: "/send", query: { confirmed: "true" } });
}
</script>

<template>
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        title="Confirm Transaction"
        left="back"
        @left-click="handleCancel"
      />
    </template>

    <div class="confirm-tx-view">
      <!-- Ambient Glow (V51: same as VerifyPinView) -->
      <div class="ambient-glow"></div>

      <!-- V51: Network Chip (pill style) -->
      <div class="confirm-header" data-roi="confirm-header">
        <span class="network-chip" :class="{ 'network-chip--warning': isTestOrDev }">
          <span class="network-dot" />
          <span class="network-label">{{ networkLabel }}</span>
        </span>
      </div>

      <!-- V51.1: Summary Card - Two logical blocks -->
      <div class="summary-card" data-roi="confirm-summary">
        <!-- Block 1: Parties (From/To) -->
        <div class="summary-block">
          <!-- From -->
          <div class="summary-row">
            <span class="row-label">From</span>
            <div class="row-value">
              <span v-if="fromLabel" class="value-name">{{ fromLabel }}</span>
              <span class="value-address">{{ fromAddressShort }}</span>
            </div>
          </div>

          <!-- To -->
          <div class="summary-row">
            <span class="row-label">To</span>
            <div class="row-value row-value--copyable">
              <span class="value-address">{{ toAddressShort }}</span>
              <button class="copy-btn" title="Copy address" @click="handleCopyTo">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        <!-- Divider between blocks -->
        <div class="block-divider" />

        <!-- Block 2: Financials (Amount/Fee/Memo/Total) -->
        <div class="summary-block">
          <!-- Amount -->
          <div class="summary-row">
            <span class="row-label">Amount</span>
            <span class="row-value row-value--amount">{{ amountText }}</span>
          </div>

          <!-- Fee -->
          <div v-if="feeText" class="summary-row">
            <span class="row-label">Fee</span>
            <span class="row-value row-value--fee">{{ feeText }}</span>
          </div>

          <!-- Memo -->
          <div v-if="memo" class="summary-row">
            <span class="row-label">Memo</span>
            <span class="row-value row-value--memo">{{ memo }}</span>
          </div>
        </div>

        <!-- Total (always separated, hero treatment) -->
        <div v-if="totalText" class="total-divider" />
        <div v-if="totalText" class="summary-row summary-row--total">
          <span class="row-label row-label--total">Total</span>
          <span class="row-value row-value--total">{{ totalText }}</span>
        </div>
      </div>

      <!-- V51.1: Warning - Softer, inline hint -->
      <div class="warning-hint" data-roi="confirm-warning">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span>Verify address and network. Transactions cannot be reversed.</span>
      </div>
    </div>

    <!-- V51: CTA Rail (V49.2 bottom rail) -->
    <div class="cta-rail" data-roi="confirm-cta-rail">
      <Button variant="ghost" full-width @click="handleCancel">
        Cancel
      </Button>
      <Button variant="primary" full-width @click="handleConfirm">
        Confirm & Send
      </Button>
    </div>
  </ScreenShell>
</template>

<style scoped>
/* V51.1: Fullscreen confirm view layout */
.confirm-tx-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0 var(--space-lg);
  padding-bottom: 120px;
  overflow-y: auto;
}

/* V51.1: Ambient Glow - subtle */
.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 50%;
  background: var(--color-accent-primary);
  opacity: 0.04;
  filter: blur(100px);
  border-radius: 50%;
  pointer-events: none;
}

/* === V51.1: Network Chip - Smaller, doesn't compete === */
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

/* === V51.1: Summary Card - Refined === */
.summary-card {
  padding: var(--space-md);
  background: var(--surface-hover);
  border: 1px solid var(--textfield-border);
  border-radius: var(--radius-control);
  position: relative;
  z-index: 1;
}

/* V51.1: Logical blocks */
.summary-block {
  display: flex;
  flex-direction: column;
}

/* V51.1: Block divider - very subtle */
.block-divider {
  height: 1px;
  background: var(--textfield-border);
  margin: var(--space-sm) 0;
  opacity: 0.6;
}

/* V51.1: Total divider - more prominent */
.total-divider {
  height: 1px;
  background: var(--textfield-border);
  margin: var(--space-md) 0 var(--space-sm);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 28px;
  padding: 4px 0;
}

.summary-row--total {
  padding-top: 0;
}

/* V51.1: Row labels - smaller, more muted */
.row-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  flex-shrink: 0;
}

/* V51.1: Total label - slightly more visible */
.row-label--total {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

/* V51.1: Row values - clean hierarchy */
.row-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.row-value--copyable {
  flex-direction: row;
  align-items: center;
  gap: var(--space-xs);
}

/* V51.1: Account name - secondary */
.value-name {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

/* V51.1: Addresses - subdued mono */
.value-address {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
  letter-spacing: 0.01em;
}

/* V51.1: Amount - bold but not hero */
.row-value--amount {
  font-weight: var(--font-weight-semibold);
}

/* V51.1: Fee - muted */
.row-value--fee {
  font-weight: var(--font-weight-normal);
  color: var(--color-text-secondary);
}

/* V51.1: Total - HERO treatment */
.row-value--total {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  letter-spacing: -0.01em;
}

/* V51.1: Memo - compact */
.row-value--memo {
  max-width: 160px;
  word-break: break-word;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
}

/* V51.1: Copy button - smaller, subtle */
.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  opacity: 0.6;
}

.copy-btn:hover {
  color: var(--color-text-primary);
  opacity: 1;
}

/* === V51.1: Warning Hint - Softer, inline === */
.warning-hint {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  position: relative;
  z-index: 1;
}

.warning-hint svg {
  flex-shrink: 0;
  opacity: 0.6;
}

/* === V51.1: CTA Rail === */
.cta-rail {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-lg);
  background: var(--color-bg-primary);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
  padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom));
}
</style>
