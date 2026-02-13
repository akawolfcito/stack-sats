<script setup lang="ts">
/**
 * StickyCTA - V55.2 Update
 *
 * V55.2 Changes:
 * - Added data-roi attributes for E2E contract testing
 * - Optional roiPrefix for screen-specific targeting (e.g., "confirm" → "confirm-cta-primary")
 * - Default: "sticky-cta-primary" / "sticky-cta-secondary"
 */
import { computed } from "vue";
import { Button } from "@/components/ui";

const props = defineProps<{
  primaryText: string;
  primaryDisabled?: boolean;
  secondaryText?: string;
  showArrow?: boolean;
  /** Optional prefix for data-roi (e.g., "confirm" → "confirm-cta-primary") */
  roiPrefix?: string;
}>();

const emit = defineEmits<{
  primary: [];
  secondary: [];
}>();

// Compute data-roi values with optional prefix
const roiPrimary = computed(() =>
  props.roiPrefix ? `${props.roiPrefix}-cta-primary` : "sticky-cta-primary"
);
const roiSecondary = computed(() =>
  props.roiPrefix ? `${props.roiPrefix}-cta-secondary` : "sticky-cta-secondary"
);
</script>

<template>
  <div class="sticky-cta">
    <!-- Slot for extra content (e.g., fee row) -->
    <slot />

    <!-- Secondary button (optional) -->
    <Button
      v-if="secondaryText"
      variant="secondary"
      full-width
      :data-roi="roiSecondary"
      @click="emit('secondary')"
    >
      {{ secondaryText }}
    </Button>

    <!-- Primary button -->
    <Button
      variant="primary"
      full-width
      :disabled="primaryDisabled"
      :data-roi="roiPrimary"
      @click="emit('primary')"
    >
      <span>{{ primaryText }}</span>
      <svg v-if="showArrow !== false" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="cta-arrow">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </Button>
  </div>
</template>

<style scoped>
.sticky-cta {
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-md) var(--space-lg) var(--space-lg);
  padding-top: var(--space-md);
  background: linear-gradient(
    to top,
    var(--color-bg-primary) 70%,
    rgba(10, 10, 10, 0.95) 85%,
    transparent
  );
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  /* Safe area padding for mobile */
  padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom));
}

/* Arrow animation on hover */
.cta-arrow {
  transition: transform var(--transition-fast);
}

.sticky-cta :deep(.btn--primary:hover:not(:disabled)) .cta-arrow {
  transform: translateX(4px);
}
</style>
