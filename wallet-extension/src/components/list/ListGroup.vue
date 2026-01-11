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
  background: transparent; /* No card background - cleaner (v15) */
  border-radius: 0;
  border: none; /* Remove outer border - pro look */
  overflow: visible;
}

.list-group--danger .list-group-items {
  background: rgba(239, 68, 68, 0.03);
  border-radius: var(--radius-control);
  padding: var(--space-xs);
}

/* Inset dividers - V30: iOS-level precision */
.list-group-items > :deep(*:not(:last-child)) {
  position: relative;
}

.list-group-items > :deep(*:not(:last-child))::after {
  content: '';
  position: absolute;
  bottom: 0;
  /* V30: Inset aligned to content start, not icon */
  left: calc(var(--card-pad-x) + var(--icon-btn-size) + var(--space-sm));
  right: 0; /* V30: Full bleed right for cleaner look */
  height: 1px;
  background: linear-gradient(
    90deg,
    var(--color-border) 0%,
    transparent 100%
  ); /* V30: Fade-out divider */
  opacity: 0.5; /* V30: More subtle */
}

.list-group--danger .list-group-items > :deep(*:not(:last-child))::after {
  background: rgba(239, 68, 68, 0.2);
}
</style>
