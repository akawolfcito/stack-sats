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
  gap: var(--control-icon-gap); /* Tighter icon/text spacing */
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
  gap: var(--control-icon-gap); /* Tighter icon/text spacing */
}

/* Standardize icon sizing within buttons */
.btn__content :deep(svg) {
  width: var(--control-icon-size);
  height: var(--control-icon-size);
  flex-shrink: 0;
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

/* === Variant: Primary - V43.1 Material Depth === */
.btn--primary {
  background: var(--btn-primary-gradient), var(--btn-primary-bg);
  color: var(--btn-primary-text);
  border: 1px solid var(--btn-primary-border);
  box-shadow: var(--btn-primary-shadow);
}

.btn--primary:hover:not(:disabled) {
  background: var(--btn-primary-gradient), var(--btn-primary-bg-hover);
  border-color: var(--btn-primary-border-hover);
  box-shadow: var(--btn-primary-shadow-hover);
}

/* V43.1: Pressed state uses inset shadow for "material pressed" feel */
.btn--primary:active:not(:disabled) {
  background: var(--btn-primary-bg-active);
  transform: translateY(1px);
  box-shadow: var(--btn-primary-shadow-active);
}

/* === Variant: Secondary (Ghost/Quiet) - V34 tokens === */
.btn--secondary {
  background: var(--btn-secondary-bg);
  border: 1px solid var(--btn-secondary-border);
  color: var(--btn-secondary-text);
  font-weight: var(--font-weight-medium);
  box-shadow: none;
}

.btn--secondary:hover:not(:disabled) {
  background: var(--btn-secondary-bg-hover);
  border-color: var(--btn-secondary-border-hover);
  color: var(--btn-secondary-text-hover);
}

.btn--secondary:active:not(:disabled) {
  transform: translateY(1px);
  background: var(--btn-secondary-bg-active);
  border-color: var(--btn-secondary-border-active);
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
  background: transparent;
  border: none;
  border-radius: var(--radius-chip);
  color: var(--color-text-secondary);
}

.btn--icon:hover:not(:disabled) {
  background: var(--surface-hover);
  color: var(--color-text-primary);
}

.btn--icon:active:not(:disabled) {
  background: var(--surface-pressed);
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
