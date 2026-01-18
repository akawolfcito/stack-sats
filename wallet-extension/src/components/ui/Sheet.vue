<script setup lang="ts">
/**
 * Sheet - V63 Unified Overlay System
 *
 * Variants:
 * - dropdown: Anchored popover (AccountSwitcher, NetworkChip)
 *   - Positioned relative to trigger, no teleport
 *   - Close on: outside click, ESC, selection
 *   - No close button (showClose ignored)
 *
 * - modal: Centered dialog (Receive, confirmations)
 *   - Teleported to body, centered in viewport
 *   - Close on: ESC, overlay click (optional)
 *   - Header close button via showClose prop
 *
 * One Material Recipe: All variants use --panel-* tokens (V62)
 * One Scroll Model: Container NEVER scrolls, only .sheet-body scrolls
 * One Close Model: Defined per variant type
 */
import { computed, onMounted, onUnmounted, watch, ref, nextTick } from 'vue';

export type SheetVariant = 'dropdown' | 'modal';

// V63: Anchoring config for dropdown variant
export interface AnchorConfig {
  offsetY?: number;
  align?: 'left' | 'right';
  viewportPadding?: number;
}

const props = withDefaults(
  defineProps<{
    isOpen: boolean;
    variant?: SheetVariant;
    title?: string;
    showClose?: boolean;
    closeOnOverlay?: boolean;
    closeOnEscape?: boolean;
    /** V63: Anchor config for dropdown positioning */
    anchor?: AnchorConfig;
  }>(),
  {
    variant: 'modal',
    showClose: true,
    closeOnOverlay: true,
    closeOnEscape: true,
  }
);

const emit = defineEmits<{
  close: [];
}>();

// V63: Dropdown positioning state
const dropdownStyle = ref<Record<string, string>>({});
const containerRef = ref<HTMLElement | null>(null);

// V63: Determine if dropdown should render without teleport
const isDropdown = computed(() => props.variant === 'dropdown');

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

// V63: Calculate dropdown position relative to trigger
function calculateDropdownPosition() {
  if (!isDropdown.value || !containerRef.value) return;

  const container = containerRef.value;
  const wrapper = container.closest('.sheet-dropdown-anchor');
  if (!wrapper) return;

  const trigger = wrapper.previousElementSibling as HTMLElement;
  if (!trigger) return;

  const triggerRect = trigger.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const padding = props.anchor?.viewportPadding ?? 8;
  const offsetY = props.anchor?.offsetY ?? 8;

  // Calculate initial position (below trigger, aligned left)
  let top = offsetY;
  let left = 0;

  // Check for right overflow - align right edge to trigger right
  const wouldOverflowRight = triggerRect.left + containerRect.width > viewportWidth - padding;
  if (wouldOverflowRight) {
    left = triggerRect.width - containerRect.width;
  }

  // Clamp left to viewport
  const absoluteLeft = triggerRect.left + left;
  if (absoluteLeft < padding) {
    left = padding - triggerRect.left;
  }

  // Calculate max height (viewport - top position - padding)
  const absoluteTop = triggerRect.bottom + offsetY;
  const maxHeight = viewportHeight - absoluteTop - padding;

  dropdownStyle.value = {
    top: `${top}px`,
    left: `${left}px`,
    maxHeight: `${Math.max(200, maxHeight)}px`,
  };
}

// Keyboard event listener
onMounted(() => {
  document.addEventListener('keydown', handleEscapeKey);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleEscapeKey);
});

// V63: Recalculate dropdown position when opened
watch(
  () => props.isOpen,
  async (isOpen) => {
    if (isOpen) {
      // V63: Only lock body scroll for modal (not dropdown)
      if (!isDropdown.value) {
        document.body.style.overflow = 'hidden';
      }
      // Calculate dropdown position after render
      if (isDropdown.value) {
        await nextTick();
        calculateDropdownPosition();
      }
    } else {
      if (!isDropdown.value) {
        document.body.style.overflow = '';
      }
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
  <!-- V63: Dropdown variant - no teleport, anchored to trigger -->
  <template v-if="isDropdown">
    <Transition name="sheet-dropdown">
      <div
        v-if="isOpen"
        class="sheet-dropdown-anchor"
      >
        <!-- V63: Transparent overlay for outside click detection -->
        <div class="sheet-overlay sheet-overlay--dropdown" @click="handleOverlayClick" />

        <!-- V63: Anchored container -->
        <div
          ref="containerRef"
          :class="containerClasses"
          :style="dropdownStyle"
        >
          <!-- V70: Dropdown header (title required per Visual System Lock) -->
          <header v-if="!hasCustomHeader && title" class="sheet-header sheet-header--dropdown">
            <h3 class="sheet-header__title sheet-header__title--dropdown">{{ title }}</h3>
          </header>
          <slot v-else name="header" />

          <!-- V63: Body - ONLY element that scrolls -->
          <div class="sheet-body">
            <slot />
          </div>

          <!-- Footer (sticky) -->
          <footer v-if="hasFooter" class="sheet-footer">
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </template>

  <!-- V63: Modal variant - teleported, centered -->
  <template v-else>
    <Teleport to="body">
      <Transition name="sheet-modal">
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

            <!-- V63: Body - ONLY element that scrolls -->
            <div class="sheet-body">
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
</template>

<style scoped>
/**
 * V63 Unified Overlay System Styles
 *
 * One Material Recipe: --panel-* tokens (V62)
 * One Scroll Model: Container overflow:hidden, .sheet-body overflow:auto
 */

/* === V67: Scrim Layer (Home-parity overlay separation) === */
/* Unified scrim for ALL Sheet variants - dims background, captures outside clicks */
.sheet-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  /* V67: Consistent scrim background */
  background: var(--scrim-bg);
  /* V67: Subtle blur (optional, degrades gracefully) */
  backdrop-filter: blur(var(--scrim-blur));
  -webkit-backdrop-filter: blur(var(--scrim-blur));
  /* V67: Smooth transition */
  transition: opacity var(--scrim-transition) ease-out;
  pointer-events: auto;
}

/* V67: Modal overlay - centered layout */
.sheet-overlay--modal {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
}

/* V67: Dropdown overlay - inherits scrim, explicit pointer-events for contract */
.sheet-overlay--dropdown {
  /* V56.2: Explicit pointer-events for outside click detection */
  pointer-events: auto;
}

/* === V63: Dropdown Anchor Wrapper === */
.sheet-dropdown-anchor {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
}

/* === Container - V63 Unified Material Recipe === */
.sheet-container {
  position: relative;
  display: flex;
  flex-direction: column;
  /* V63: Container NEVER scrolls */
  overflow: hidden;
  /* V62: Glass surface recipe */
  background: var(--panel-bg-glass);
  backdrop-filter: blur(var(--panel-blur)) saturate(var(--panel-saturate));
  -webkit-backdrop-filter: blur(var(--panel-blur)) saturate(var(--panel-saturate));
  border: 1px solid var(--panel-border);
  box-shadow: var(--panel-shadow-elevated), var(--panel-highlight);
}

/* V65: Modal container - centered, reduced border-radius */
.sheet-container--modal {
  width: clamp(320px, 92vw, 420px);
  max-height: 88vh;
  /* V65: Reduced from --radius-xl (24px) to --radius-lg (16px) */
  border-radius: var(--radius-lg);
}

/* V65: Dropdown container - anchored popover, reduced border-radius */
.sheet-container--dropdown {
  position: absolute;
  width: 280px;
  max-height: 400px;
  /* V65: Reduced from --radius-lg (16px) to --radius-md (12px) */
  border-radius: var(--radius-md);
  /* V67: Panel above scrim overlay (overlay is z-index: 100) */
  z-index: 101;
}

/* === Header === */
.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--card-pad-y) var(--card-pad-x);
  border-bottom: 1px solid var(--panel-divider);
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
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-secondary);
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

/* V70: Dropdown header variant - compact, no close button */
.sheet-header--dropdown {
  padding: var(--space-sm) var(--card-pad-x);
  justify-content: flex-start;
}

.sheet-header__title--dropdown {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* === V66: Body - ONLY element that scrolls === */
.sheet-body {
  flex: 1;
  /* V63: Only body scrolls, not container */
  overflow-y: auto;
  overflow-x: hidden;
  /* V66 G1: Use page padding for breathing room (was card-pad) */
  padding: var(--space-md) var(--page-pad-x);
}

/* V63: Hide scrollbar for cleaner look (still scrollable) */
.sheet-body::-webkit-scrollbar {
  width: 4px;
}

.sheet-body::-webkit-scrollbar-track {
  background: transparent;
}

.sheet-body::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
}

.sheet-body::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.2);
}

/* === Footer === */
.sheet-footer {
  padding: var(--card-pad-y) var(--card-pad-x);
  border-top: 1px solid var(--panel-divider);
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* === V63: Modal Transitions === */
.sheet-modal-enter-active,
.sheet-modal-leave-active {
  transition: opacity var(--transition-base);
}

.sheet-modal-enter-active .sheet-container,
.sheet-modal-leave-active .sheet-container {
  transition: transform var(--transition-base), opacity var(--transition-base);
}

.sheet-modal-enter-from,
.sheet-modal-leave-to {
  opacity: 0;
}

.sheet-modal-enter-from .sheet-container,
.sheet-modal-leave-to .sheet-container {
  transform: scale(0.95);
  opacity: 0;
}

/* === V63: Dropdown Transitions === */
.sheet-dropdown-enter-active,
.sheet-dropdown-leave-active {
  transition: opacity var(--transition-fast);
}

.sheet-dropdown-enter-active .sheet-container,
.sheet-dropdown-leave-active .sheet-container {
  transition: transform var(--transition-fast), opacity var(--transition-fast);
}

.sheet-dropdown-enter-from,
.sheet-dropdown-leave-to {
  opacity: 0;
}

.sheet-dropdown-enter-from .sheet-container,
.sheet-dropdown-leave-to .sheet-container {
  transform: translateY(-8px);
  opacity: 0;
}

/* === V65: One Surface Rule === */
/* ListGroup inside Sheet should be transparent - Sheet provides THE surface */
.sheet-body :deep(.list-group-items) {
  background: transparent;
  border: none;
  box-shadow: none;
  border-radius: 0;
}

/* V65: Dividers still visible for separation */
.sheet-body :deep(.list-group-items > *:not(:last-child)::after) {
  left: var(--card-pad-x);
  right: var(--card-pad-x);
}
</style>
