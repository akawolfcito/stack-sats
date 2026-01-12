<script setup lang="ts">
/**
 * ConfirmTxView - V51.4 Fullscreen Confirm Transaction
 *
 * Design rule: Fullscreen for security-critical/irreversible steps
 * (Verify PIN, Confirm Tx, Delete Wallet confirm)
 *
 * V51.4 Fixes:
 * - 3-column grid: label (72px) | value (1fr) | action slot (32px)
 * - Tap-to-copy on TO address (no icon, cleaner premium feel)
 * - Unified From/To address display (same truncation, font, style)
 * - Zero horizontal overflow via proper grid containment
 * - "Copied" toast feedback
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

// Copy feedback state
const copied = ref(false);
let copyTimeout: ReturnType<typeof setTimeout> | null = null;

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

// V51.4: Tap-to-copy with feedback
function handleCopyTo() {
  navigator.clipboard.writeText(toAddress.value);
  copied.value = true;

  if (copyTimeout) clearTimeout(copyTimeout);
  copyTimeout = setTimeout(() => {
    copied.value = false;
  }, 2000);
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

    <div class="confirm-tx-view" data-roi="confirm-view-root">
      <!-- Ambient Glow (V51: same as VerifyPinView) -->
      <div class="ambient-glow"></div>

      <!-- V51: Network Chip (pill style) -->
      <div class="confirm-header" data-roi="confirm-header">
        <span class="network-chip" :class="{ 'network-chip--warning': isTestOrDev }">
          <span class="network-dot" />
          <span class="network-label">{{ networkLabel }}</span>
        </span>
      </div>

      <!-- V51.4: Summary Card - 3-column grid for stable alignment -->
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
            <span class="row-action" />
          </div>

          <!-- To (tap-to-copy) -->
          <div class="summary-row" data-roi="confirm-to-row">
            <span class="row-label">To</span>
            <button
              class="row-value row-value--copyable"
              :class="{ 'row-value--copied': copied }"
              title="Tap to copy address"
              @click="handleCopyTo"
            >
              <span class="value-address">{{ toAddressShort }}</span>
              <span v-if="copied" class="copy-feedback">Copied</span>
            </button>
            <span class="row-action" />
          </div>
        </div>

        <!-- Divider between blocks -->
        <div class="block-divider" />

        <!-- Block 2: Financials (Amount/Fee/Memo) -->
        <div class="summary-block">
          <!-- Amount -->
          <div class="summary-row">
            <span class="row-label">Amount</span>
            <span class="row-value row-value--amount">{{ amountText }}</span>
            <span class="row-action" />
          </div>

          <!-- Fee -->
          <div v-if="feeText" class="summary-row">
            <span class="row-label">Fee</span>
            <span class="row-value row-value--fee">{{ feeText }}</span>
            <span class="row-action" />
          </div>

          <!-- Memo -->
          <div v-if="memo" class="summary-row">
            <span class="row-label">Memo</span>
            <span class="row-value row-value--memo">{{ memo }}</span>
            <span class="row-action" />
          </div>
        </div>

        <!-- Total (always separated, hero treatment) -->
        <div v-if="totalText" class="total-divider" />
        <div v-if="totalText" class="summary-row summary-row--total">
          <span class="row-label row-label--total">Total</span>
          <span class="row-value row-value--total">{{ totalText }}</span>
          <span class="row-action" />
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
/* V51.4: Fullscreen confirm view layout - zero overflow */
.confirm-tx-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 0 var(--space-lg);
  padding-bottom: 120px;
  overflow-y: auto;
  box-sizing: border-box;
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

/* === V51.4: Summary Card - 3-column grid === */
.summary-card {
  padding: var(--space-md);
  background: var(--surface-hover);
  border: 1px solid var(--textfield-border);
  border-radius: var(--radius-control);
  position: relative;
  z-index: 1;
  box-sizing: border-box;
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

/* V51.4: Summary rows - 3-column CSS Grid for perfect alignment */
.summary-row {
  display: grid;
  grid-template-columns: 72px 1fr 32px;
  column-gap: var(--space-sm);
  align-items: center;
  min-height: 32px;
  padding: 4px 0;
}

.summary-row--total {
  padding-top: 0;
}

/* V51.4: Row labels - left column */
.row-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.row-label--total {
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

/* V51.4: Row values - center column, right-aligned */
.row-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  text-align: right;
  justify-self: end;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* V51.4: Action placeholder - right column (32px fixed) */
.row-action {
  width: 32px;
  flex-shrink: 0;
}

/* V51.4: Copyable address - tap target */
.row-value--copyable {
  background: transparent;
  border: none;
  padding: var(--space-xs) var(--space-sm);
  margin: calc(-1 * var(--space-xs)) calc(-1 * var(--space-sm));
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background 0.15s ease;
  position: relative;
}

.row-value--copyable:hover {
  background: var(--surface-hover);
}

.row-value--copyable:active {
  background: var(--surface-pressed);
}

/* V51.4: Copy feedback */
.row-value--copied {
  background: var(--color-success-muted);
}

.copy-feedback {
  position: absolute;
  right: 100%;
  margin-right: var(--space-xs);
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-success);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

/* V51.1: Account name - secondary */
.value-name {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

/* V51.4: Addresses - unified mono style for From/To parity */
.value-address {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
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

/* V51.1: Memo - compact, allows wrap */
.row-value--memo {
  max-width: 160px;
  word-break: break-word;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
  white-space: normal;
  text-overflow: unset;
  overflow: visible;
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

/* === V51.4: CTA Rail - proper containment === */
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
  box-sizing: border-box;
}
</style>
