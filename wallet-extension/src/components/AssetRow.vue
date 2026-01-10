<script setup lang="ts">
defineProps<{
  symbol: string
  name?: string
  balanceText: string
  fiatText?: string
  iconColor?: string
}>()

const emit = defineEmits<{
  (e: 'click'): void
}>()
</script>

<template>
  <button class="asset-row" @click="emit('click')">
    <!-- Icon slot or default -->
    <div class="asset-icon" :style="iconColor ? { background: iconColor } : {}">
      <slot name="icon">
        <span class="asset-icon-text">{{ symbol.charAt(0) }}</span>
      </slot>
    </div>

    <!-- Asset info -->
    <div class="asset-info">
      <span class="asset-symbol">{{ symbol }}</span>
      <span v-if="name" class="asset-name">{{ name }}</span>
    </div>

    <!-- Balance -->
    <div class="asset-balance">
      <span class="balance-primary">{{ balanceText }}</span>
      <span v-if="fiatText" class="balance-fiat">{{ fiatText }}</span>
    </div>

    <!-- Chevron -->
    <div class="asset-chevron">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  </button>
</template>

<style scoped>
.asset-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  padding: var(--card-pad-y) var(--card-pad-x);
  background: transparent;
  border: none;
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: background 0.15s ease;
  text-align: left;
}

.asset-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.asset-row:active {
  background: rgba(255, 255, 255, 0.08);
}

.asset-icon {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  min-width: var(--icon-btn-size);
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(215, 248, 46, 0.2), rgba(153, 225, 142, 0.1));
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
}

.asset-icon-text {
  font-size: 16px;
  font-weight: 700;
}

.asset-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.asset-symbol {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.asset-name {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.asset-balance {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.balance-primary {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
}

.balance-fiat {
  font-size: 12px;
  color: var(--color-text-muted);
}

.asset-chevron {
  color: var(--color-text-muted);
  opacity: 0.5;
}

.asset-row:hover .asset-chevron {
  opacity: 1;
}
</style>
