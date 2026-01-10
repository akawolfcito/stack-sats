<script setup lang="ts">
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

const emit = defineEmits<{
  (e: 'item-click', item: AssetRowModel): void
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
      @click="emit('item-click', item)"
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
