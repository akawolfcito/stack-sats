<script setup lang="ts">
/**
 * AssetRow - Unified asset row using ListRow as base
 *
 * V82: Clickable rows with chevron, navigates to Asset Detail
 * V81: Added availability status badge for non-implemented assets
 *
 * Extends ListRow with:
 * - Consistent icon with gradient backgrounds
 * - Balance display (value + fiat)
 * - Status badge for unavailable assets
 * - Click navigation to asset detail
 */
import ListRow from './list/ListRow.vue';

defineProps<{
  symbol: string
  name?: string
  balanceText: string
  fiatText?: string
  iconColor?: string
  /** V81: Whether the asset is currently available/implemented (default: true) */
  available?: boolean
}>()

const emit = defineEmits<{
  click: []
}>()

function handleClick() {
  emit('click')
}
</script>

<template>
  <ListRow
    :label="symbol"
    :value="balanceText"
    :value-subtitle="fiatText"
    :icon-color="iconColor"
    chevron
    @click="handleClick"
  >
    <template #icon>
      <slot name="icon">
        <span class="asset-icon-text">{{ symbol.charAt(0) }}</span>
      </slot>
    </template>

    <!-- V81: Custom content with optional status badge -->
    <template #content>
      <span class="asset-label">{{ symbol }}</span>
      <span v-if="name" class="asset-subtitle">{{ name }}</span>
      <span v-if="available === false" class="asset-status-badge">Not available</span>
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

/* V81: Content structure - matches ListRow defaults */
.asset-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.asset-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* V81: Status badge - minimal pill for unavailable assets */
.asset-status-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 999px;
  margin-top: 2px;
  opacity: 0.8;
}
</style>
