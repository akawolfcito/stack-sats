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
/* ActionBar - V29: Premium control group with clear hierarchy */
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

/* Ensure all buttons in action bar use consistent sizing */
.action-bar :deep(.btn) {
  height: var(--control-h);
  border-radius: var(--radius-control);
}

/* === V29: Primary button - Premium lime with inner glow === */
.action-bar :deep(.btn--primary) {
  background: var(--color-accent-primary);
  color: #0a0a0a;
  font-weight: var(--font-weight-bold);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.15); /* V29: Inner highlight */
}

.action-bar :deep(.btn--primary:hover:not(:disabled)) {
  background: var(--color-accent-primary-hover);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.2),
    0 2px 8px rgba(232, 248, 89, 0.2); /* V29: Subtle outer glow */
}

.action-bar :deep(.btn--primary:active:not(:disabled)) {
  transform: translateY(1px);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1); /* V29: Pressed inset */
}

/* === V29: Secondary button - True ghost, never competes === */
.action-bar :deep(.btn--secondary) {
  background: transparent;
  border: none; /* V29: No border - true ghost */
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.action-bar :deep(.btn--secondary:hover:not(:disabled)) {
  background: var(--surface-hover);
  color: var(--color-text-primary);
  border: none;
}

.action-bar :deep(.btn--secondary:active:not(:disabled)) {
  background: var(--surface-pressed);
  transform: translateY(1px);
}

/* Icon sizing in ActionBar buttons */
.action-bar :deep(.btn__content svg) {
  width: var(--control-icon-size);
  height: var(--control-icon-size);
}
</style>
