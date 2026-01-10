<script setup lang="ts">
import { computed, onMounted, onUnmounted, watch } from 'vue';

export type SheetVariant = 'bottom' | 'center' | 'dropdown';

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    variant?: SheetVariant;
    title?: string;
    showClose?: boolean;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
  }>(),
  {
    variant: 'bottom',
    showClose: true,
    closeOnOverlay: true,
    closeOnEscape: true,
  }
);

const emit = defineEmits<{
  close: [];
}>();

// Computed classes
const overlayClasses = computed(() => [
  'sheet-overlay',
  `sheet-overlay--${props.variant}`,
]);

const containerClasses = computed(() => [
  'sheet-container',
  `sheet-container--${props.variant}`,
]);

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

// Slots
const slots = defineSlots<{
  icon?: () => unknown;
  header?: () => unknown;
  default?: () => unknown;
  footer?: () => unknown;
}>();

const hasIcon = computed(() => !!slots.icon);
const hasCustomHeader = computed(() => !!slots.header);
const hasFooter = computed(() => !!slots.footer);
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div
        v-if="isOpen"
        :class="overlayClasses"
        @click="handleOverlayClick"
      >
        <div :class="containerClasses">
          <!-- Default Header (can be overridden with #header slot) -->
          <header v-if="!hasCustomHeader && (title || showClose)" class="sheet-header">
            <div class="sheet-header__left">
              <span v-if="hasIcon" class="sheet-header__icon">
                <slot name="icon" />
              </span>
              <h2 v-if="title" class="sheet-header__title">{{ title }}</h2>
            </div>
            <button
              v-if="showClose"
              class="sheet-header__close"
              aria-label="Close"
              @click="emit('close')"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </header>

          <!-- Custom Header Slot -->
          <slot v-else name="header" />

          <!-- Content -->
          <div class="sheet-content">
            <slot />
          </div>

          <!-- Footer (sticky) -->
          <footer v-if="hasFooter" class="sheet-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* === Overlay === */
.sheet-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 100;
}

/* Bottom sheet: align to bottom */
.sheet-overlay--bottom {
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

/* Center modal: center in viewport */
.sheet-overlay--center {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-md);
}

/* Dropdown: no overlay styling (transparent) */
.sheet-overlay--dropdown {
  background: transparent;
  backdrop-filter: none;
  pointer-events: none;
}

.sheet-overlay--dropdown .sheet-container {
  pointer-events: auto;
}

/* === Container === */
.sheet-container {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  overflow: hidden;
}

/* Bottom sheet container */
.sheet-container--bottom {
  width: 100%;
  max-height: 90vh;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  border-bottom: none;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
}

/* Center modal container */
.sheet-container--center {
  width: 100%;
  max-width: 360px;
  max-height: 90vh;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
}

/* Dropdown container */
.sheet-container--dropdown {
  position: absolute;
  width: 280px;
  max-height: 400px;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
}

/* === Header === */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--card-pad-y) var(--card-pad-x);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sheet-header__left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.sheet-header__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  border-radius: 50%;
  background: var(--color-accent-primary-muted);
  color: var(--color-accent-primary);
}

.sheet-header__title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.sheet-header__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  background: transparent;
  border: none;
  border-radius: 50%;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.sheet-header__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}

/* === Content === */
.sheet-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--card-pad-y) var(--card-pad-x);
}

/* === Footer === */
.sheet-footer {
  padding: var(--card-pad-y) var(--card-pad-x);
  border-top: 1px solid var(--color-border);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* === Transitions === */
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity var(--transition-base);
}

.sheet-enter-active .sheet-container,
.sheet-leave-active .sheet-container {
  transition: transform var(--transition-base);
}

.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}

/* Bottom sheet slides up */
.sheet-overlay--bottom .sheet-enter-from .sheet-container,
.sheet-overlay--bottom .sheet-leave-to .sheet-container,
.sheet-enter-from .sheet-container--bottom,
.sheet-leave-to .sheet-container--bottom {
  transform: translateY(100%);
}

/* Center modal scales */
.sheet-overlay--center .sheet-enter-from .sheet-container,
.sheet-overlay--center .sheet-leave-to .sheet-container,
.sheet-enter-from .sheet-container--center,
.sheet-leave-to .sheet-container--center {
  transform: scale(0.95);
}

/* Dropdown fades and slides */
.sheet-overlay--dropdown .sheet-enter-from .sheet-container,
.sheet-overlay--dropdown .sheet-leave-to .sheet-container,
.sheet-enter-from .sheet-container--dropdown,
.sheet-leave-to .sheet-container--dropdown {
  transform: translateY(-8px);
  opacity: 0;
}
</style>
