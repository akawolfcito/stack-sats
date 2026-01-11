<script setup lang="ts">
/**
 * AssetRow - Unified asset row using ListRow as base
 *
 * Extends ListRow with:
 * - Consistent icon with gradient backgrounds
 * - Balance display (value + fiat)
 * - Chevron navigation indicator
 */
import ListRow from './list/ListRow.vue';

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
  <ListRow
    :label="symbol"
    :subtitle="name"
    :value="balanceText"
    :value-subtitle="fiatText"
    :icon-color="iconColor"
    chevron
    @click="emit('click')"
  >
    <template #icon>
      <slot name="icon">
        <span class="asset-icon-text">{{ symbol.charAt(0) }}</span>
      </slot>
    </template>
  </ListRow>
</template>

<style scoped>
/* V27: Asset icon text styling */
.asset-icon-text {
  font-size: var(--font-size-xs); /* Token-based */
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
</style>
