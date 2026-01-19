<script setup lang="ts">
/**
 * AssetRow - Unified asset row using ListRow as base
 *
 * V80: Static display-only (no chevron, no click affordance)
 *
 * Extends ListRow with:
 * - Consistent icon with gradient backgrounds
 * - Balance display (value + fiat)
 */
import ListRow from './list/ListRow.vue';

defineProps<{
  symbol: string
  name?: string
  balanceText: string
  fiatText?: string
  iconColor?: string
}>()
</script>

<template>
  <ListRow
    :label="symbol"
    :subtitle="name"
    :value="balanceText"
    :value-subtitle="fiatText"
    :icon-color="iconColor"
    static
  >
    <template #icon>
      <slot name="icon">
        <span class="asset-icon-text">{{ symbol.charAt(0) }}</span>
      </slot>
    </template>
  </ListRow>
</template>

<style scoped>
/* V30: Asset icon text - premium styling */
.asset-icon-text {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-secondary); /* V30: Slightly muted for subtlety */
  text-transform: uppercase;
  letter-spacing: 0.03em; /* V30: Wider for readability */
  opacity: 0.9;
}
</style>
