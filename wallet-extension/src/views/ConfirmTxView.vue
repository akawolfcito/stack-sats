<script setup lang="ts">
/**
 * ConfirmTxView - V51 Fullscreen Confirm Transaction
 *
 * Design rule: Fullscreen for security-critical/irreversible steps
 * (Verify PIN, Confirm Tx, Delete Wallet confirm)
 *
 * Reuses SendView/VerifyPinView scaffold:
 * - ScreenShell + AppHeader
 * - Ambient glow
 * - V49.2 bottom rail
 *
 * Query params passed from SendView:
 * - All transaction details encoded
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

      <!-- V51: Summary Card (V43 card surface) -->
      <div class="summary-card" data-roi="confirm-summary">
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Amount -->
        <div class="summary-row">
          <span class="row-label">Amount</span>
          <span class="row-value row-value--amount">{{ amountText }}</span>
        </div>

        <!-- Fee -->
        <div v-if="feeText" class="summary-row">
          <span class="row-label">Fee</span>
          <span class="row-value">{{ feeText }}</span>
        </div>

        <!-- Memo -->
        <div v-if="memo" class="summary-row">
          <span class="row-label">Memo</span>
          <span class="row-value row-value--memo">{{ memo }}</span>
        </div>

        <!-- Total (separated) -->
        <div v-if="totalText" class="summary-divider" />
        <div v-if="totalText" class="summary-row summary-row--total">
          <span class="row-label">Total</span>
          <span class="row-value row-value--total">{{ totalText }}</span>
        </div>
      </div>

      <!-- V51: Warning Card (discrete) -->
      <div class="warning-card" data-roi="confirm-warning">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 9v4M12 17h.01" />
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        </svg>
        <span>Double-check address and network. Transactions are irreversible.</span>
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
/* V51: Fullscreen confirm view layout */
.confirm-tx-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0 var(--space-lg);
  padding-bottom: 120px; /* Space for CTA rail */
  overflow-y: auto;
}

/* V51: Ambient Glow (same as VerifyPinView) */
.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 50%;
  background: var(--color-accent-primary);
  opacity: 0.05;
  filter: blur(100px);
  border-radius: 50%;
  pointer-events: none;
}

/* === V51: Confirm Header with Network Chip === */
.confirm-header {
  display: flex;
  justify-content: center;
  padding: var(--space-lg) 0;
  position: relative;
  z-index: 1;
}

.network-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-success-muted);
  border-radius: var(--radius-pill);
}

.network-chip--warning {
  background: var(--color-warning-muted);
}

.network-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
}

.network-chip--warning .network-dot {
  background: var(--color-warning);
}

.network-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  text-transform: capitalize;
}

/* === V51: Summary Card (V43 card pattern) === */
.summary-card {
  padding: var(--space-md);
  background: var(--surface-hover);
  border: 1px solid var(--textfield-border);
  border-radius: var(--radius-control);
  position: relative;
  z-index: 1;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-sm) 0;
}

.summary-row:first-child {
  padding-top: 0;
}

.summary-row--total {
  padding-top: var(--space-md);
}

.summary-divider {
  height: 1px;
  background: var(--textfield-border);
  margin: var(--space-sm) 0;
}

/* V51: Row labels - uppercase muted */
.row-label {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  flex-shrink: 0;
}

/* V51: Row values - right-aligned, 600 weight */
.row-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
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

.value-name {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.value-address {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-secondary);
  letter-spacing: 0.02em;
}

.row-value--amount {
  font-weight: var(--font-weight-bold);
}

.row-value--total {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
}

.row-value--memo {
  max-width: 180px;
  word-break: break-word;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
}

/* V51: Copy button */
.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: var(--surface-hover);
  border: 1px solid var(--textfield-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.copy-btn:hover {
  background: var(--surface-pressed);
  border-color: var(--textfield-border-hover);
  color: var(--color-text-primary);
}

/* === V51: Warning Card (discrete) === */
.warning-card {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-warning-muted);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-sm);
  color: var(--color-warning);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  position: relative;
  z-index: 1;
}

.warning-card svg {
  flex-shrink: 0;
  margin-top: 1px;
}

/* === V51: CTA Rail (V49.2 bottom rail pattern) === */
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
