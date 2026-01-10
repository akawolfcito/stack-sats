<script setup lang="ts">
import { computed } from 'vue';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon';
export type ButtonSize = 'sm' | 'md' | 'lg';

const props = withDefaults(
  defineProps<{
    variant?: ButtonVariant;
    size?: ButtonSize;
    fullWidth?: boolean;
    pill?: boolean;
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    variant: 'primary',
    size: 'md',
    fullWidth: false,
    pill: false,
    disabled: false,
    loading: false,
  }
);

defineEmits<{
  click: [e: MouseEvent];
}>();

const classes = computed(() => [
  'btn',
  `btn--${props.variant}`,
  `btn--${props.size}`,
  {
    'btn--full-width': props.fullWidth,
    'btn--pill': props.pill,
    'btn--loading': props.loading,
  },
]);
</script>

<template>
  <button
    :class="classes"
    :disabled="disabled || loading"
    @click="$emit('click', $event)"
  >
    <!-- Loading spinner -->
    <span v-if="loading" class="btn__spinner">
      <svg class="btn__spinner-svg" viewBox="0 0 24 24" fill="none">
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-dasharray="32"
          stroke-dashoffset="32"
        />
      </svg>
    </span>

    <!-- Content -->
    <span v-else class="btn__content">
      <slot />
    </span>
  </button>
</template>

<style scoped>
/* Base button styles */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  border: none;
  font-family: var(--font-family);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  transition: all var(--transition-base);
  white-space: nowrap;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.btn:disabled {
  opacity: var(--state-disabled-opacity);
  cursor: not-allowed;
  box-shadow: none;
}

.btn:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.btn__content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

/* Size variants - using density-aware padding tokens */
.btn--sm {
  height: var(--row-h);
  padding: var(--control-pad-y) var(--row-pad-x);
  font-size: var(--font-size-sm);
}

.btn--md {
  height: var(--control-h);
  padding: var(--control-pad-y) var(--control-pad-x);
  font-size: var(--font-size-base);
}

.btn--lg {
  height: var(--control-h);
  padding: var(--control-pad-y) calc(var(--control-pad-x) * 1.5);
  font-size: var(--font-size-lg);
}

/* Radius variants */
.btn--pill {
  border-radius: var(--radius-pill);
}

.btn:not(.btn--pill) {
  border-radius: var(--radius-control);
}

/* Full width */
.btn--full-width {
  width: 100%;
}

/* === Variant: Primary === */
.btn--primary {
  background: var(--color-accent-primary);
  color: #0a0a0a;
  box-shadow: var(--shadow-elev-0);
}

.btn--primary:hover:not(:disabled) {
  background: var(--color-accent-primary-hover);
  box-shadow: var(--shadow-elev-1);
}

.btn--primary:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: var(--shadow-elev-0);
}

/* === Variant: Secondary === */
.btn--secondary {
  /* Pro surface + subtle border, no shadow */
  background: var(--surface-2);
  border: var(--border-subtle);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
  box-shadow: var(--shadow-elev-0);
}

.btn--secondary:hover:not(:disabled) {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border);
}

.btn--secondary:active:not(:disabled) {
  transform: translateY(1px);
  background: var(--surface-pressed);
}

/* === Variant: Ghost === */
.btn--ghost {
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-weight: var(--font-weight-medium);
}

.btn--ghost:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--color-text-primary);
}

.btn--ghost:active:not(:disabled) {
  background: var(--surface-pressed);
  transform: translateY(1px);
}

/* === Variant: Danger === */
.btn--danger {
  background: var(--color-error);
  color: #ffffff;
  box-shadow: var(--shadow-elev-0);
}

.btn--danger:hover:not(:disabled) {
  box-shadow: var(--shadow-elev-1);
}

.btn--danger:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: var(--shadow-elev-0);
}

/* === Variant: Icon === */
.btn--icon {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  padding: 0;
  background: var(--surface-hover);
  border: none;
  border-radius: var(--radius-control);
  color: var(--color-text-primary);
}

.btn--icon:hover:not(:disabled) {
  background: var(--surface-pressed);
}

.btn--icon:active:not(:disabled) {
  transform: scale(0.95);
}

/* Icon variant ignores size - always uses icon-btn-size */
.btn--icon.btn--sm,
.btn--icon.btn--md,
.btn--icon.btn--lg {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  padding: 0;
}

/* === Loading State === */
.btn--loading {
  pointer-events: none;
}

.btn__spinner {
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn__spinner-svg {
  width: 20px;
  height: 20px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
