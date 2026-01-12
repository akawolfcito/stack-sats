<script setup lang="ts">
/**
 * ActionBar - Unified action button bar component
 *
 * Provides consistent side-by-side action buttons with:
 * - Same height (var(--control-h))
 * - Same radius (var(--radius-control))
 * - Primary/Secondary/Danger variants
 */
import { Button } from '@/components/ui';

export interface ActionItem {
  /** Unique key for the action */
  key: string;
  /** Button label text */
  label: string;
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'danger';
  /** Icon slot name (optional) */
  icon?: string;
  /** Disabled state */
  disabled?: boolean;
}

const props = defineProps<{
  /** Array of action items to render */
  items: ActionItem[];
}>();

const emit = defineEmits<{
  action: [key: string];
}>();

function handleAction(key: string) {
  emit('action', key);
}
</script>

<template>
  <div class="action-bar">
    <Button
      v-for="item in items"
      :key="item.key"
      :variant="item.variant || 'secondary'"
      :disabled="item.disabled"
      class="action-bar__btn"
      @click="handleAction(item.key)"
    >
      <!-- Named slot for icon -->
      <slot :name="`icon-${item.key}`" />
      <span>{{ item.label }}</span>
    </Button>
  </div>
</template>

<style scoped>
/* ActionBar - V28 Gold: Symmetrical controls, fintech-grade */
.action-bar {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--space-xs) 0;
}

.action-bar__btn {
  flex: 1;
  min-width: 0;
}

/* Both buttons share same baseline: height, radius, alignment */
.action-bar :deep(.btn) {
  height: var(--control-h);
  border-radius: var(--radius-control);
  font-weight: var(--font-weight-semibold);
}

/* V41: Primary/Secondary styling fully delegated to Button.vue via tokens */
/* ActionBar only defines layout - no color overrides here */

/* Icon sizing - consistent across both buttons */
.action-bar :deep(.btn__content svg) {
  width: var(--control-icon-size);
  height: var(--control-icon-size);
}
</style>
