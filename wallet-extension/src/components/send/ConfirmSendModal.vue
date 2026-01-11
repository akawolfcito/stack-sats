<script setup lang="ts">
import { computed } from "vue";
import { Sheet, Button } from "@/components/ui";

const props = defineProps<{
  isOpen: boolean;
  networkLabel: string;
  fromLabel?: string;
  fromAddressShort: string;
  toAddress: string;
  toAddressShort: string;
  amountText: string;
  feeText?: string;
  totalText?: string;
  memo?: string;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const isTestOrDev = computed(() => {
  const label = props.networkLabel.toLowerCase();
  return label.includes("test") || label.includes("dev");
});

function handleCopyTo() {
  navigator.clipboard.writeText(props.toAddress);
}

function handleClose() {
  emit("close");
}

function handleConfirm() {
  emit("confirm");
}
</script>

<template>
  <Sheet
    :is-open="isOpen"
    variant="center"
    title="Confirm Transaction"
    @close="handleClose"
  >
    <!-- Network Banner -->
    <div class="network-banner" :class="{ 'network-warning': isTestOrDev }">
      <span class="network-dot" :class="{ 'dot-warning': isTestOrDev }" />
      <span class="network-text">{{ networkLabel }}</span>
    </div>

    <!-- Summary -->
    <div class="summary">
      <!-- From -->
      <div class="summary-row">
        <span class="summary-label">From</span>
        <div class="summary-value">
          <span v-if="fromLabel" class="value-label">{{ fromLabel }}</span>
          <span class="value-address">{{ fromAddressShort }}</span>
        </div>
      </div>

      <!-- To -->
      <div class="summary-row">
        <span class="summary-label">To</span>
        <div class="summary-value summary-value-copyable">
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
        <span class="summary-label">Amount</span>
        <span class="summary-value value-amount">{{ amountText }}</span>
      </div>

      <!-- Fee -->
      <div v-if="feeText" class="summary-row">
        <span class="summary-label">Network Fee</span>
        <span class="summary-value">{{ feeText }}</span>
      </div>

      <!-- Total -->
      <div v-if="totalText" class="summary-row summary-row-total">
        <span class="summary-label">Total</span>
        <span class="summary-value value-total">{{ totalText }}</span>
      </div>

      <!-- Memo -->
      <div v-if="memo" class="summary-row">
        <span class="summary-label">Memo</span>
        <span class="summary-value value-memo">{{ memo }}</span>
      </div>
    </div>

    <!-- Warning -->
    <div class="warning-banner">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      </svg>
      <span>Double-check the address and network. Transactions are irreversible.</span>
    </div>

    <template #footer>
      <div class="modal-actions">
        <Button variant="secondary" full-width @click="handleClose">
          Cancel
        </Button>
        <Button variant="primary" full-width @click="handleConfirm">
          Confirm & Send
        </Button>
      </div>
    </template>
  </Sheet>
</template>

<style scoped>
/* Network Banner */
.network-banner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: rgba(34, 197, 94, 0.1);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.network-banner.network-warning {
  background: rgba(251, 191, 36, 0.15);
}

.network-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success, #22c55e);
}

.network-dot.dot-warning {
  background: #fbbf24;
}

.network-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  text-transform: capitalize;
}

/* Summary */
.summary {
  padding: var(--space-sm) var(--space-lg) var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-xs) 0;
}

.summary-row-total {
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  padding-top: var(--space-sm);
  margin-top: var(--space-xs);
}

.summary-label {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.5);
  flex-shrink: 0;
}

.summary-value {
  font-size: 13px;
  color: var(--color-text-primary);
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.summary-value-copyable {
  flex-direction: row;
  align-items: center;
  gap: var(--space-xs);
}

.value-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.value-address {
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  letter-spacing: 0.02em;
}

.value-amount {
  font-weight: 600;
  color: var(--color-text-primary); /* v18: neutral */
}

.value-total {
  font-weight: 700;
  font-size: 14px;
}

.value-memo {
  max-width: 180px;
  word-break: break-word;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.4);
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary); /* v18: neutral */
}

/* Warning Banner */
.warning-banner {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  margin: 0 var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.2);
  border-radius: 10px;
  color: rgba(251, 191, 36, 0.9);
  font-size: 11px;
  line-height: 1.4;
}

.warning-banner svg {
  flex-shrink: 0;
  margin-top: 1px;
}

/* Actions */
.modal-actions {
  display: flex;
  gap: var(--space-sm);
}
</style>
