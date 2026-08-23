<script setup lang="ts">
import TokenRow from "./TokenRow.vue";

export interface TokenItem {
  contractId: string;
  symbol: string;
  name: string;
  color: string;
  enabled: boolean;
  isLocked?: boolean;
  isCustom?: boolean;
}

defineProps<{
  items: TokenItem[];
  loading?: boolean;
  emptyText?: string;
}>();

const emit = defineEmits<{
  toggle: [contractId: string, enabled: boolean];
}>();

function handleToggle(contractId: string, enabled: boolean) {
  emit("toggle", contractId, enabled);
}
</script>

<template>
  <!-- Loading State -->
  <div v-if="loading" class="loading-state">
    <div class="spinner"></div>
    <span>Loading tokens...</span>
  </div>

  <!-- Empty State -->
  <div v-else-if="items.length === 0" class="empty-state">
    <span class="empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg></span>
    <span class="empty-text">{{ emptyText || "No tokens found" }}</span>
  </div>

  <!-- Token List -->
  <div v-else class="token-list">
    <TokenRow
      v-for="item in items"
      :key="item.contractId"
      :symbol="item.symbol"
      :name="item.name"
      :color="item.color"
      :enabled="item.enabled"
      :isLocked="item.isLocked"
      :isCustom="item.isCustom"
      @toggle="(enabled) => handleToggle(item.contractId, enabled)"
    />
  </div>
</template>

<style scoped>
.token-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-2xl) var(--space-lg);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-bg-card);
  border-top-color: var(--color-text-muted); /* v18: neutral */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-2xl) var(--space-lg);
  text-align: center;
}

.empty-icon {
  font-size: 32px;
  opacity: 0.5;
}

.empty-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
