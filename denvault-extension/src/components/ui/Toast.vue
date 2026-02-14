<script setup lang="ts">
/**
 * Toast - V54.5 Premium Toast Component
 *
 * Minimal, accessible toast notification for transient feedback.
 * Designed for extension viewports with premium visual cohesion.
 *
 * Features:
 * - Backdrop blur + elevated surface (matches modal/phrase-hero)
 * - Smooth fade + translate animation
 * - Bottom-center positioning with safe padding
 * - Auto-dismiss with configurable duration
 * - Never covers primary CTA (uses safe offset)
 * - Accessible (aria-live polite)
 *
 * Props:
 * - visible: Boolean to control visibility
 * - message: Toast message text
 * - icon: Optional icon type ('check' | 'info' | 'warning')
 * - duration: Auto-hide duration in ms (default 2000)
 *
 * Emits:
 * - hide: When toast should be hidden
 */
import { watch, onUnmounted } from 'vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  message: string;
  icon?: 'check' | 'info' | 'warning';
  duration?: number;
}>(), {
  icon: 'check',
  duration: 2000
});

const emit = defineEmits<{
  hide: [];
}>();

// Auto-hide timer
let hideTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleHide() {
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    emit('hide');
  }, props.duration);
}

// Watch visibility to schedule auto-hide
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    scheduleHide();
  } else if (hideTimer) {
    clearTimeout(hideTimer);
    hideTimer = null;
  }
}, { immediate: true });

// Cleanup on unmount
onUnmounted(() => {
  if (hideTimer) clearTimeout(hideTimer);
});
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="visible"
        class="toast"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-roi="toast"
      >
        <!-- Icon -->
        <svg
          v-if="icon === 'check'"
          class="toast__icon toast__icon--check"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        <svg
          v-else-if="icon === 'info'"
          class="toast__icon toast__icon--info"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <svg
          v-else-if="icon === 'warning'"
          class="toast__icon toast__icon--warning"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>

        <!-- Message -->
        <span class="toast__message">{{ message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* V54.5: Toast container - premium elevated surface */
.toast {
  position: fixed;
  /* Bottom-center with safe offset to avoid CTA overlap */
  bottom: calc(var(--space-xl) + 56px); /* 56px = approx CTA height + padding */
  left: 50%;
  transform: translateX(-50%);

  /* Layout */
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);

  /* V54.5: Premium surface - matches phrase-hero/modal style */
  background: rgba(30, 30, 30, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-chip);
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.3),
    0 0 1px rgba(255, 255, 255, 0.1);

  /* Typography */
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);

  /* Stacking */
  z-index: 200;

  /* Prevent text selection */
  user-select: none;
}

/* V54.5: Icon styles */
.toast__icon {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
}

.toast__icon--check {
  color: var(--color-success);
}

.toast__icon--info {
  color: var(--color-accent-primary);
}

.toast__icon--warning {
  color: var(--color-warning);
}

/* V54.5: Message */
.toast__message {
  white-space: nowrap;
}

/* V54.5: Premium motion - fade + subtle translate */
.toast-enter-active {
  transition:
    opacity 0.2s ease-out,
    transform 0.2s ease-out;
}

.toast-leave-active {
  transition:
    opacity 0.15s ease-in,
    transform 0.15s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-4px);
}
</style>
