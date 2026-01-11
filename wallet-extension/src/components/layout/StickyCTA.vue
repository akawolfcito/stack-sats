<script setup lang="ts">
import { Button } from "@/components/ui";

defineProps<{
  primaryText: string;
  primaryDisabled?: boolean;
  secondaryText?: string;
  showArrow?: boolean;
}>();

const emit = defineEmits<{
  primary: [];
  secondary: [];
}>();
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
      @click="emit('secondary')"
    >
      {{ secondaryText }}
    </Button>

    <!-- Primary button -->
    <Button
      variant="primary"
      full-width
      :disabled="primaryDisabled"
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
