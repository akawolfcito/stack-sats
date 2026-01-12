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

/* === V28: Primary (Send) - Lime fill, clean and confident === */
.action-bar :deep(.btn--primary) {
  background: var(--color-accent-primary);
  color: #0a0a0a;
  border: none;
  box-shadow: none; /* Clean at rest */
}

.action-bar :deep(.btn--primary:hover:not(:disabled)) {
  background: var(--color-accent-primary-hover);
  box-shadow: 0 2px 8px rgba(232, 248, 89, 0.25); /* Subtle lift */
}

.action-bar :deep(.btn--primary:active:not(:disabled)) {
  transform: translateY(1px);
  box-shadow: none;
}

/* === V31: Secondary (Receive) - Premium but quiet (ghost-ish) === */
.action-bar :deep(.btn--secondary) {
  background: transparent; /* V31: Ghost at rest */
  border: 1px solid rgba(255, 255, 255, 0.06); /* V31: Nearly invisible border */
  color: var(--color-text-secondary); /* V31: Muted text, not primary */
}

.action-bar :deep(.btn--secondary:hover:not(:disabled)) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary); /* V31: Full contrast on hover */
}

.action-bar :deep(.btn--secondary:active:not(:disabled)) {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.08);
  transform: translateY(1px);
}

/* Icon sizing - consistent across both buttons */
.action-bar :deep(.btn__content svg) {
  width: var(--control-icon-size);
  height: var(--control-icon-size);
}
</style>
