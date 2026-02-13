<script setup lang="ts">
import { computed } from 'vue';

/**
 * TextField variant type
 * @deprecated 'neumorphic' variant is deprecated - use 'default' for new implementations
 */
export type TextFieldVariant = 'default' | 'neumorphic';

const props = withDefaults(
  defineProps<{
    modelValue: string | number;
    placeholder?: string;
    type?: 'text' | 'number' | 'password';
    variant?: TextFieldVariant;
    mono?: boolean;
    uppercase?: boolean;
    error?: string;
    disabled?: boolean;
    readonly?: boolean;
    maxlength?: number;
    min?: number;
    max?: number;
  }>(),
  {
    type: 'text',
    variant: 'default',
    mono: false,
    uppercase: false,
    disabled: false,
    readonly: false,
  }
);

const emit = defineEmits<{
  'update:modelValue': [value: string | number];
  blur: [e: FocusEvent];
  focus: [e: FocusEvent];
}>();

// Computed classes for wrapper
const wrapperClasses = computed(() => [
  'textfield',
  `textfield--${props.variant}`,
  {
    'textfield--error': !!props.error,
    'textfield--disabled': props.disabled,
  },
]);

// Computed classes for input
const inputClasses = computed(() => [
  'textfield__input',
  {
    'textfield__input--mono': props.mono,
    'textfield__input--uppercase': props.uppercase,
  },
]);

// Handle input events
function handleInput(e: Event) {
  const target = e.target as HTMLInputElement;
  const value = props.type === 'number' ? Number(target.value) : target.value;
  emit('update:modelValue', value);
}

// Slots
const slots = defineSlots<{
  prefix?: () => unknown;
  suffix?: () => unknown;
}>();

const hasPrefix = computed(() => !!slots.prefix);
const hasSuffix = computed(() => !!slots.suffix);
</script>

<template>
  <div :class="wrapperClasses">
    <!-- Prefix slot -->
    <span v-if="hasPrefix" class="textfield__prefix">
      <slot name="prefix" />
    </span>

    <!-- Input -->
    <input
      :class="inputClasses"
      :type="type"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :maxlength="maxlength"
      :min="min"
      :max="max"
      @input="handleInput"
      @blur="emit('blur', $event)"
      @focus="emit('focus', $event)"
    />

    <!-- Suffix slot -->
    <span v-if="hasSuffix" class="textfield__suffix">
      <slot name="suffix" />
    </span>
  </div>
</template>

<style scoped>
/* Base wrapper styles */
.textfield {
  position: relative;
  display: flex;
  align-items: center;
  width: 100%;
  transition: all var(--transition-fast);
}

/* V49.4: Prefix/Suffix containers - improved vertical alignment */
.textfield__prefix,
.textfield__suffix {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  /* V49.4: Ensure consistent height with input for baseline alignment */
  height: var(--control-h);
}

.textfield__prefix {
  padding-left: var(--space-md);
}

.textfield__suffix {
  padding-right: var(--space-sm);
}

/* Base input styles - using density-aware padding */
.textfield__input {
  flex: 1;
  height: var(--control-h);
  padding: 0 var(--control-pad-x);
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-family: var(--font-family);
  outline: none;
  transition: all var(--transition-fast);
}

/* V49.4: Placeholder hierarchy - clearly subordinate to input text */
.textfield__input::placeholder {
  color: var(--textfield-placeholder);
  font-weight: var(--font-weight-normal);
}

.textfield__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Input modifiers */
.textfield__input--mono {
  font-family: var(--font-mono);
}

.textfield__input--uppercase {
  text-transform: uppercase;
}

/* Adjust padding when slots are present */
.textfield:has(.textfield__prefix) .textfield__input {
  padding-left: var(--space-sm);
}

.textfield:has(.textfield__suffix) .textfield__input {
  padding-right: var(--space-sm);
}

/* === Variant: Default - V49.4 Premium Material === */
.textfield--default {
  /* V49.4: Subtle fill - doesn't compete with content */
  background: var(--textfield-bg);
  border: 1px solid var(--textfield-border);
  border-radius: var(--radius-control);
}

/* V49.4: Hover state - subtle border lift */
.textfield--default:hover:not(:focus-within):not(.textfield--disabled) {
  border-color: var(--textfield-border-hover);
}

/* V49.4: Focus - subtle ring, premium fintech feel (no neon) */
.textfield--default:focus-within {
  border-color: var(--textfield-focus-border);
  box-shadow: var(--textfield-focus-shadow);
}

.textfield--default.textfield--error {
  border-color: var(--color-error);
  box-shadow: 0 0 0 1px var(--color-error-muted);
}

/* === Variant: Neumorphic (DEPRECATED - V26) ===
 * This variant is deprecated and will be removed in a future version.
 * Use 'default' variant instead for new implementations.
 * Kept for backward compatibility with SendView.
 */
.textfield--neumorphic {
  background: var(--color-bg-elevated);
  border: none;
  border-radius: var(--radius-lg);
  box-shadow:
    inset 2px 2px 5px rgba(0, 0, 0, 0.4),
    inset -1px -1px 1px rgba(255, 255, 255, 0.05);
}

.textfield--neumorphic:focus-within {
  box-shadow:
    inset 2px 2px 5px rgba(0, 0, 0, 0.4),
    inset -1px -1px 1px rgba(255, 255, 255, 0.05),
    0 0 0 1px var(--color-accent-primary-muted);
}

.textfield--neumorphic.textfield--error {
  box-shadow:
    inset 2px 2px 5px rgba(0, 0, 0, 0.4),
    inset -1px -1px 1px rgba(255, 255, 255, 0.05),
    0 0 0 1px var(--color-error-muted);
}

.textfield--neumorphic .textfield__input::placeholder {
  color: var(--color-text-muted);
}

/* === Disabled state === */
.textfield--disabled {
  opacity: 0.5;
  pointer-events: none;
}
</style>
