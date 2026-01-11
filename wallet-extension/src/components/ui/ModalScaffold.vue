<script setup lang="ts">
/**
 * ModalScaffold - Centered confirmation/alert modal
 *
 * Pattern from Settings (UserMenu) - captures the "pro" fabric:
 * - Centered icon (64px) with semantic color
 * - Centered title + description
 * - Action buttons (stacked)
 * - Backdrop with blur
 * - Scale transition
 *
 * Use this for: confirmations, warnings, PIN prompts, alerts
 * Use Sheet.vue for: bottom sheets, complex content modals
 */
import { onMounted, onUnmounted, watch } from 'vue';

export type ModalVariant = 'default' | 'warning' | 'danger' | 'success';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    title?: string;
    variant?: ModalVariant;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
  }>(),
  {
    variant: 'default',
    closeOnOverlay: true,
    closeOnEscape: true,
  }
);

const emit = defineEmits<{
  close: [];
}>();

// Handle overlay click
function handleOverlayClick(e: MouseEvent) {
  if (props.closeOnOverlay && e.target === e.currentTarget) {
    emit('close');
  }
}

// Handle escape key
function handleEscapeKey(e: KeyboardEvent) {
  if (props.closeOnEscape && e.key === 'Escape' && props.isOpen) {
    emit('close');
  }
}

// Keyboard event listener
onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey);
});

// Lock body scroll when open
watch(
  () => props.isOpen,
  (isOpen) => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }
);
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="modal-overlay"
        @click="handleOverlayClick"
      >
        <div class="modal-card" :class="`modal-card--${variant}`">
          <!-- Icon Slot -->
          <div
            v-if="$slots.icon"
            class="modal-icon"
            :class="`modal-icon--${variant}`"
          >
            <slot name="icon" />
          </div>

          <!-- Title -->
          <h3 v-if="title" class="modal-title">{{ title }}</h3>

          <!-- Default slot for description/content -->
          <div class="modal-content">
            <slot />
          </div>

          <!-- Actions slot -->
          <div v-if="$slots.actions" class="modal-actions">
            <slot name="actions" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Overlay */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-lg);
}

/* Card */
.modal-card {
  width: 100%;
  max-width: 340px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-xl) var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-md);
}

/* Icon */
.modal-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  margin-bottom: var(--space-xs);
}

.modal-icon--warning {
  background: rgba(251, 191, 36, 0.1);
  color: var(--color-warning);
}

.modal-icon--danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.modal-icon--success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

/* Title */
.modal-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

/* Content */
.modal-content {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.modal-content p {
  margin: 0;
}

.modal-content strong {
  color: var(--color-text-primary);
}

/* Actions */
.modal-actions {
  width: 100%;
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-sm);
}

.modal-actions :deep(.btn) {
  flex: 1;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.95);
}
</style>
