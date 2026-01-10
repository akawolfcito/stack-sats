<script setup lang="ts">
defineProps<{
  primaryText: string;
  primaryDisabled?: boolean;
  secondaryText?: string;
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
    <button
      v-if="secondaryText"
      class="cta-btn cta-btn-secondary"
      @click="emit('secondary')"
    >
      {{ secondaryText }}
    </button>

    <!-- Primary button -->
    <button
      class="cta-btn cta-btn-primary"
      :disabled="primaryDisabled"
      @click="emit('primary')"
    >
      <span>{{ primaryText }}</span>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </button>
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

.cta-btn {
  width: 100%;
  height: var(--control-h);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  border: none;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-base);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.cta-btn-primary {
  background: var(--color-accent-primary);
  color: #0a0a0a;
  box-shadow: 0 0 20px rgba(232, 248, 89, 0.25);
}

.cta-btn-primary:hover:not(:disabled) {
  box-shadow: 0 0 35px rgba(232, 248, 89, 0.4);
}

.cta-btn-primary:active:not(:disabled) {
  transform: scale(0.98);
}

.cta-btn-primary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cta-btn-primary svg {
  transition: transform 0.2s ease;
}

.cta-btn-primary:hover:not(:disabled) svg {
  transform: translateX(4px);
}

.cta-btn-secondary {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
  font-weight: 500;
}

.cta-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}
</style>
