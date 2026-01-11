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
.action-bar {
  display: flex;
  gap: var(--space-md);
  width: 100%;
}

.action-bar__btn {
  flex: 1;
  min-width: 0;
}

/* Ensure all buttons in action bar use consistent sizing */
.action-bar :deep(.btn) {
  height: var(--control-h);
  border-radius: var(--radius-control);
}
</style>
