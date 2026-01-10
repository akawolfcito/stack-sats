<script setup lang="ts">
defineProps<{
  /** Error message to display */
  message: string;
  /** Optional icon (defaults to warning) */
  icon?: string;
}>();
</script>

<template>
  <div v-if="message" class="inline-error">
    <span class="inline-error__icon">{{ icon || '⚠' }}</span>
    <span class="inline-error__message">{{ message }}</span>
  </div>
</template>

<style scoped>
.inline-error {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: var(--color-error-muted);
  border: 1px solid rgba(255, 107, 107, 0.3);
  border-radius: var(--radius-lg);
}

.inline-error__icon {
  flex-shrink: 0;
  font-size: var(--font-size-base);
}

.inline-error__message {
  font-size: var(--font-size-sm);
  color: var(--color-error);
  line-height: 1.4;
}
</style>
