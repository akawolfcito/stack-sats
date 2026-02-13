<script setup lang="ts">
defineProps<{
  /** Field label text */
  label: string;
  /** Optional hint text below input */
  hint?: string;
  /** Error message to display */
  error?: string;
  /** Whether field is required */
  required?: boolean;
}>();
</script>

<template>
  <div class="form-field" :class="{ 'form-field--error': error }">
    <label v-if="label" class="form-field__label">
      {{ label }}
      <span v-if="required" class="form-field__required">*</span>
    </label>
    <slot />
    <p v-if="hint && !error" class="form-field__hint">{{ hint }}</p>
    <p v-if="error" class="form-field__error">{{ error }}</p>
  </div>
</template>

<style scoped>
.form-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.form-field__label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  margin-left: var(--space-xs);
}

.form-field__required {
  color: var(--color-error);
  margin-left: 2px;
}

.form-field__hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0 0 0 var(--space-xs);
}

.form-field__error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin: 0 0 0 var(--space-xs);
}

/* Error state - add red border to slotted inputs */
.form-field--error :slotted(input),
.form-field--error :slotted(textarea),
.form-field--error :slotted(select) {
  border-color: var(--color-error);
}
</style>
