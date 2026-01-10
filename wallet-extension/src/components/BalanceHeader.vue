<script setup lang="ts">
defineProps<{
  amountText: string
  symbol: string
  usdText?: string
  isHidden?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-hidden'): void
  (e: 'refresh'): void
}>()
</script>

<template>
  <div class="balance-header">
    <div class="balance-main">
      <span class="balance-amount" :class="{ 'balance-hidden': isHidden }">
        {{ isHidden ? '••••••' : amountText }}
      </span>
      <span class="balance-symbol">{{ symbol }}</span>
      <button class="balance-action" @click="emit('toggle-hidden')" :title="isHidden ? 'Show balance' : 'Hide balance'">
        <svg v-if="isHidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </button>
      <button class="balance-action" @click="emit('refresh')" title="Refresh balance">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </button>
    </div>
    <div v-if="usdText && !isHidden" class="balance-usd">
      {{ usdText }}
    </div>
  </div>
</template>

<style scoped>
.balance-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 16px;
}

.balance-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.balance-amount {
  font-size: 28px;
  font-weight: 700;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

/* Compact size for popup mode */
.mode-popup .balance-amount {
  font-size: 24px;
}

.balance-hidden {
  letter-spacing: 0.1em;
}

.balance-symbol {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.mode-popup .balance-symbol {
  font-size: 14px;
}

.balance-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.balance-action:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.05);
}

.balance-usd {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-muted);
  padding: 4px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.mode-popup .balance-usd {
  font-size: 12px;
  padding: 3px 10px;
}
</style>
