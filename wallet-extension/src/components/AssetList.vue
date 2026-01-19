<script setup lang="ts">
/**
 * AssetList - V80: Static display-only asset rows
 *
 * No click affordance - assets are display-only.
 * Manage tokens via dedicated "Manage" action.
 */
import AssetRow from './AssetRow.vue'

export interface AssetRowModel {
  id: string
  symbol: string
  name?: string
  balanceText: string
  fiatText?: string
  iconColor?: string
}

defineProps<{
  items: AssetRowModel[]
}>()
</script>

<template>
  <div class="asset-list">
    <AssetRow
      v-for="item in items"
      :key="item.id"
      :symbol="item.symbol"
      :name="item.name"
      :balance-text="item.balanceText"
      :fiat-text="item.fiatText"
      :icon-color="item.iconColor"
    />

    <!-- Empty state -->
    <div v-if="items.length === 0" class="asset-list-empty">
      <p>No assets found</p>
    </div>
  </div>
</template>

<style scoped>
.asset-list {
  display: flex;
  flex-direction: column;
  /* No gap - dividers handled by parent ListGroup */
}

.asset-list-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-2xl) var(--space-lg);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}

.asset-list-empty p {
  margin: 0;
}
</style>
