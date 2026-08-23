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
    <span class="inline-error__icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
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
