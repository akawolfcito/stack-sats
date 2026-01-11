<script setup lang="ts">
defineProps<{
  /** Section title displayed above the list */
  title?: string;
  /** Visual variant */
  variant?: 'default' | 'danger';
}>();
</script>

<template>
  <section class="list-group" :class="{ 'list-group--danger': variant === 'danger' }">
    <div v-if="title || $slots.headerAction" class="list-group-header">
      <h3 v-if="title" class="list-group-title">{{ title }}</h3>
      <slot name="headerAction" />
    </div>
    <div class="list-group-items">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.list-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.list-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-xs);
}

.list-group-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium); /* 500 for section labels */
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  margin: 0;
}

.list-group--danger .list-group-title {
  color: var(--color-error);
}

.list-group-items {
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border-radius: var(--radius-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

.list-group--danger .list-group-items {
  border-color: rgba(239, 68, 68, 0.3);
  background: rgba(239, 68, 68, 0.05);
}

/* Child rows get dividers */
.list-group-items > :deep(*:not(:last-child)) {
  border-bottom: 1px solid var(--color-border);
}

.list-group--danger .list-group-items > :deep(*:not(:last-child)) {
  border-bottom-color: rgba(239, 68, 68, 0.2);
}
</style>
