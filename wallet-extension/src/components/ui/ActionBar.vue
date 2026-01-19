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

defineProps<{
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
/* V42: ActionBar - Premium segmented control with clear hierarchy */
.action-bar {
  display: flex;
  gap: var(--space-md); /* V42: More breathing room between buttons */
  width: 100%;
  padding: var(--space-sm) 0; /* V42: Slightly more vertical padding */
}

.action-bar__btn {
  flex: 1;
  min-width: 0;
}

/* V42: Both buttons share unified baseline */
.action-bar :deep(.btn) {
  height: var(--control-h);
  border-radius: var(--radius-control);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.01em; /* V42: Subtle tracking for premium feel */
}

/* V42: Primary/Secondary styling via Button.vue tokens */
/* ActionBar only defines layout - no color overrides here */

/* V42: Icon sizing - precise alignment */
.action-bar :deep(.btn__content svg) {
  width: var(--control-icon-size);
  height: var(--control-icon-size);
  flex-shrink: 0;
}

/* V42: Ensure icons don't shift on hover */
.action-bar :deep(.btn__content) {
  gap: var(--control-icon-gap);
}
</style>
