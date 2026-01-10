<script setup lang="ts">
defineProps<{
  /** Enable scrolling in content area (default: true) */
  scroll?: boolean;
  /** Additional class for content wrapper */
  contentClass?: string;
  /** Apply standard horizontal padding to content (default: true) */
  padded?: boolean;
}>();
</script>

<template>
  <div class="screen-shell">
    <!-- Header Slot (sticky) -->
    <header v-if="$slots.header" class="screen-header">
      <slot name="header" />
    </header>

    <!-- Main Content -->
    <main
      class="screen-content"
      :class="[
        contentClass,
        {
          'screen-content--scroll': scroll !== false,
          'screen-content--padded': padded !== false,
        },
      ]"
    >
      <slot />
    </main>

    <!-- Footer Slot (sticky bottom, for CTAs) -->
    <footer v-if="$slots.footer" class="screen-footer">
      <slot name="footer" />
    </footer>
  </div>
</template>

<style scoped>
.screen-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
  position: relative;
  /* Note: overflow NOT hidden here to allow proper scroll in child */
}

/* Header */
.screen-header {
  flex-shrink: 0;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-bg-primary);
}

/* Content */
.screen-content {
  flex: 1;
  min-height: 0;
}

.screen-content--scroll {
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: var(--space-lg); /* Safe-area for popup bottom */
}

.screen-content--padded {
  padding-left: var(--space-lg);
  padding-right: var(--space-lg);
}

/* Footer */
.screen-footer {
  flex-shrink: 0;
  position: sticky;
  bottom: 0;
  z-index: 10;
}
</style>
