<script setup lang="ts">
/**
 * InlineAction - Compact inline action button
 *
 * For MAX/PASTE/COPY style actions inside inputs or rows.
 * Uses consistent sizing with:
 * - Compact padding
 * - --radius-chip for rounded look
 * - Subtle border, no glow
 */
const props = withDefaults(
  defineProps<{
    /** Button label text */
    label: string;
    /** Visual variant */
    variant?: 'default' | 'accent' | 'ghost';
    /** Disabled state */
    disabled?: boolean;
    /** Loading state */
    loading?: boolean;
  }>(),
  {
    variant: 'default',
    disabled: false,
    loading: false,
  }
);

defineEmits<{
  click: [e: MouseEvent];
}>();
</script>

<template>
  <button
    class="inline-action"
    :class="[
      `inline-action--${variant}`,
      { 'inline-action--disabled': disabled, 'inline-action--loading': loading }
    ]"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <span v-if="loading" class="inline-action__spinner" />
    <span v-else class="inline-action__label">{{ label }}</span>
  </button>
</template>

<style scoped>
.inline-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-xs) var(--space-sm);
  min-width: 48px;
  height: 28px;
  background: var(--surface-2);
  border: var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  cursor: pointer;
  transition: all var(--transition-fast);
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.inline-action:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border);
}

.inline-action:active:not(:disabled) {
  transform: scale(0.96);
  background: var(--surface-pressed);
}

.inline-action:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

/* Variant: Accent (primary action like MAX) */
.inline-action--accent {
  background: var(--color-accent-primary);
  border: none;
  color: #0a0a0a;
}

.inline-action--accent:hover:not(:disabled) {
  background: var(--color-accent-primary-hover);
  color: #0a0a0a;
}

/* Variant: Ghost (subtle) */
.inline-action--ghost {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
}

.inline-action--ghost:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--color-accent-primary);
}

/* States */
.inline-action--disabled {
  opacity: var(--state-disabled-opacity);
  cursor: not-allowed;
}

.inline-action--loading {
  pointer-events: none;
}

.inline-action__label {
  line-height: 1;
}

.inline-action__spinner {
  width: 12px;
  height: 12px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
