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
/**
 * V79: Fixed scroll layout system
 *
 * Root cause of scroll issues: `height: 100%` doesn't work reliably
 * when parent is a flex child with `flex: 1` (no explicit height).
 *
 * Fix: Use `flex: 1` + `min-height: 0` instead of `height: 100%`.
 * This allows the shell to fill available space AND shrink to enable
 * scroll in the content area.
 */

/* V79: Shell - fills parent via flex, enables child scroll */
.screen-shell {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0; /* V79: Critical - allows flex item to shrink below content */
  background: var(--screen-bg-base);
  position: relative;
  overflow: hidden; /* V79: Contain scroll to .screen-content--scroll */
}

/* Header - sticky at top, never scrolls */
.screen-header {
  flex: 0 0 auto;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--screen-bg-base);
}

/* Content - fills remaining space */
.screen-content {
  flex: 1 1 auto;
  min-height: 0; /* V79: Allows content to scroll instead of expand */
  display: flex;
  flex-direction: column;
}

/* Content with scroll - THE scroll container */
.screen-content--scroll {
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch; /* V79: Smooth iOS scroll */
  padding-bottom: var(--section-gap);
}

.screen-content--padded {
  padding-left: var(--space-lg);
  padding-right: var(--space-lg);
}

/* Footer - sticky at bottom, never scrolls */
.screen-footer {
  flex: 0 0 auto;
  position: sticky;
  bottom: 0;
  z-index: 10;
  background: var(--screen-bg-base);
}
</style>
