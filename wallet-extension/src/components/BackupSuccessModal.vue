<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import { Button } from "@/components/ui";

const props = defineProps<{
  show: boolean;
  message?: string;
  subtitle?: string;
  autoDismiss?: boolean;
  dismissDelay?: number;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Animation state
const isVisible = ref(false);
const isAnimating = ref(false);

// Watch for show changes
watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      // Small delay for animation
      requestAnimationFrame(() => {
        isVisible.value = true;
        isAnimating.value = true;
      });

      // Auto dismiss if enabled
      if (props.autoDismiss !== false) {
        const delay = props.dismissDelay || 3000;
        setTimeout(() => {
          handleClose();
        }, delay);
      }
    } else {
      isVisible.value = false;
    }
  },
  { immediate: true }
);

function handleClose() {
  isAnimating.value = false;
  // Wait for exit animation
  setTimeout(() => {
    isVisible.value = false;
    emit("close");
  }, 300);
}
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="show && isVisible"
        class="toast-container"
        @click="handleClose"
      >
        <div
          class="toast"
          :class="{ 'toast-enter': isAnimating }"
          @click.stop
        >
          <!-- Success Icon -->
          <div class="toast-icon">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M9 12L11 14L15 10"
                stroke="#FFFFFF"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                stroke="#FFFFFF"
                stroke-width="2"
              />
            </svg>
          </div>

          <!-- Content -->
          <div class="toast-content">
            <p class="toast-title">{{ message || "Backup JSON Exported" }}</p>
            <p class="toast-subtitle">
              {{ subtitle || "Your wallet is backed up securely." }}
            </p>
          </div>

          <!-- Close Button -->
          <Button variant="icon" class="toast-close" @click="handleClose">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6L6 18M6 6L18 18" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </Button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  justify-content: center;
  padding: var(--space-lg);
  padding-top: var(--space-xl);
  pointer-events: none;
}

.toast {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid rgba(34, 197, 94, 0.2); /* v18: success */
  border-radius: var(--radius-pill);
  padding: var(--space-md);
  padding-right: var(--space-lg);
  box-shadow:
    0 4px 20px rgba(0, 0, 0, 0.3),
    0 0 30px rgba(34, 197, 94, 0.15); /* v18: success */
  pointer-events: auto;
  max-width: 90%;
  transform: translateY(0);
  opacity: 1;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-enter {
  animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}

@keyframes slideIn {
  0% {
    transform: translateY(-100%);
    opacity: 0;
  }
  100% {
    transform: translateY(0);
    opacity: 1;
  }
}

/* Vue Transition */
.toast-enter-active {
  animation: slideIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.toast-leave-active {
  animation: slideOut 0.3s ease-in forwards;
}

@keyframes slideOut {
  0% {
    transform: translateY(0);
    opacity: 1;
  }
  100% {
    transform: translateY(-100%);
    opacity: 0;
  }
}

/* Icon */
.toast-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(34, 197, 94, 0.15); /* v18: success */
  border-radius: 50%;
  flex-shrink: 0;
}

.toast-icon svg {
  width: 24px;
  height: 24px;
  color: var(--color-success); /* v18: success */
}

/* Content */
.toast-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.toast-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Close Button */
.toast-close :deep(.btn) {
  width: 28px;
  height: 28px;
  opacity: 0.5;
  color: var(--color-text-muted);
}

.toast-close :deep(.btn:hover) {
  opacity: 1;
  background: var(--color-bg-primary);
}
</style>
