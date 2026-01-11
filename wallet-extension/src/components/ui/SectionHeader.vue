<script setup lang="ts">
/**
 * SectionHeader - Unified section header component
 *
 * Provides consistent section header with:
 * - Title left-aligned
 * - Actions right-aligned (buttons, icon buttons)
 * - Uses Button variants for actions
 */
defineProps<{
  /** Section title text */
  title: string;
  /** Optional subtitle text */
  subtitle?: string;
}>();
</script>

<template>
  <header class="section-header">
    <div class="section-header__left">
      <h3 class="section-header__title">{{ title }}</h3>
      <span v-if="subtitle" class="section-header__subtitle">{{ subtitle }}</span>
    </div>
    <div v-if="$slots.actions" class="section-header__actions">
      <slot name="actions" />
    </div>
  </header>
</template>

<style scoped>
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: 0 var(--space-xs);
  min-height: var(--row-h);
}

.section-header__left {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  min-width: 0;
}

.section-header__title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium); /* 500 for section labels */
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--color-text-muted);
  margin: 0;
}

.section-header__subtitle {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal); /* 400 for body text */
  color: var(--color-text-muted);
}

.section-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Compact actions styling */
.section-header__actions :deep(.btn--ghost) {
  padding: var(--space-xs) var(--space-sm);
  height: auto;
  font-size: var(--font-size-xs);
}

.section-header__actions :deep(.btn--icon) {
  width: calc(var(--icon-btn-size) - 4px);
  height: calc(var(--icon-btn-size) - 4px);
}
</style>
