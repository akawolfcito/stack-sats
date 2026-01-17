<script setup lang="ts">
/**
 * PinInput - V54.6 Premium Cohesion Pass
 *
 * Premium PIN input component aligned with Recovery/Verify visual system.
 *
 * V54.6 Changes:
 * - Premium panel surface (glass effect, subtle border)
 * - Dots in capsule/rail with upgraded states
 * - Keypad with system identity styling
 * - Helper text slot inside panel
 * - prefers-reduced-motion safe animations
 *
 * V52.3 Changes (preserved):
 * - Fixed error slot with constant min-height (no layout shift)
 * - Error show/hide via opacity + transform (no reflow)
 * - aria-live="polite" for accessibility
 * - ROI target for E2E keypad position guard
 */
import { ref, watch, computed } from "vue";

const props = defineProps<{
  mode: "create" | "confirm" | "unlock";
  error?: string;
  disabled?: boolean;
  showBiometric?: boolean;
  hideLabel?: boolean; // V46: Hide label when used in modal with its own title
  helperText?: string; // V54.6: Optional helper text below dots
}>();

const emit = defineEmits<{
  (e: "complete", pin: string): void;
  (e: "change", pin: string): void;
  (e: "biometric"): void;
}>();

const PIN_LENGTH = 6;
const digits = ref<string[]>(Array(PIN_LENGTH).fill(""));
const isFocused = ref(false);

// Keypad layout
const keypadRows = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["biometric", "0", "backspace"],
];

const currentIndex = computed(() => {
  const firstEmpty = digits.value.findIndex((d) => d === "");
  return firstEmpty === -1 ? PIN_LENGTH : firstEmpty;
});

const handleKeyPress = (key: string) => {
  if (props.disabled) return;

  if (key === "backspace") {
    handleBackspace();
    return;
  }

  if (key === "biometric") {
    emit("biometric");
    return;
  }

  // Add digit if there's room
  const index = currentIndex.value;
  if (index < PIN_LENGTH) {
    digits.value[index] = key;

    const fullPin = digits.value.join("");
    emit("change", fullPin);

    // Check if complete
    if (index === PIN_LENGTH - 1) {
      emit("complete", fullPin);
    }
  }
};

const handleBackspace = () => {
  const index = currentIndex.value;
  if (index > 0) {
    digits.value[index - 1] = "";
    emit("change", digits.value.join(""));
  }
};

// Handle physical keyboard input
const handleKeydown = (event: KeyboardEvent) => {
  if (props.disabled) return;

  if (event.key >= "0" && event.key <= "9") {
    handleKeyPress(event.key);
  } else if (event.key === "Backspace") {
    handleBackspace();
  }
};

const clear = () => {
  digits.value = Array(PIN_LENGTH).fill("");
  emit("change", "");
};

const focus = () => {
  // Focus the container for keyboard events
  const container = document.querySelector(".pin-input-container");
  if (container instanceof HTMLElement) {
    container.focus();
  }
};

// Watch for error to clear
watch(
  () => props.error,
  (newError) => {
    if (newError) {
      clear();
    }
  }
);

defineExpose({ clear, focus });

const modeLabels = {
  create: "Create PIN",
  confirm: "Confirm PIN",
  unlock: "Enter PIN",
};
</script>

<template>
  <div
    class="pin-input-container"
    tabindex="0"
    data-roi="pin-input"
    @keydown="handleKeydown"
    @focus="isFocused = true"
    @blur="isFocused = false"
  >
    <!-- V54.6: Premium PIN Panel - cohesive with Recovery/Verify -->
    <div class="pin-panel" data-roi="pin-panel">
      <!-- Label (V46: can be hidden when modal provides context) -->
      <div class="pin-label" :class="{ 'sr-only': hideLabel }">
        <p>{{ modeLabels[mode] }}</p>
      </div>

      <!-- V54.6: PIN Dots in capsule/rail -->
      <div class="pin-dots-rail" data-roi="pin-dots-rail">
        <div
          v-for="(digit, index) in PIN_LENGTH"
          :key="index"
          class="pin-dot"
          :class="{
            'pin-dot--filled': digits[index] !== '',
            'pin-dot--active': isFocused && index === currentIndex && !error && !disabled,
            'pin-dot--error': error
          }"
        ></div>
      </div>

      <!-- V54.6: Helper text - subtle guidance inside panel -->
      <p v-if="helperText && !error" class="pin-helper" data-roi="pin-helper">
        {{ helperText }}
      </p>

      <!-- V52.3: Error Slot - Fixed height, no layout shift -->
      <div
        class="error-slot"
        :class="{ 'error-slot--visible': !!error }"
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-roi="pin-error-slot"
      >
        <p class="error-message">{{ error || '&nbsp;' }}</p>
      </div>
    </div>

    <!-- V54.6: Keypad Section - premium styling -->
    <div class="pin-keypad-section">
      <!-- Slot for Forgot PIN link -->
      <slot name="above-keypad"></slot>

      <!-- Numeric Keypad -->
      <div class="keypad" data-roi="pin-keypad">
        <template v-for="(row, rowIndex) in keypadRows" :key="rowIndex">
          <button
            v-for="key in row"
            :key="key"
            type="button"
            class="keypad-btn"
            :class="{
              'keypad-btn--action': key === 'biometric' || key === 'backspace',
              'keypad-btn--biometric': key === 'biometric',
              'invisible': key === 'biometric' && !showBiometric
            }"
            :disabled="disabled"
            :aria-label="key === 'backspace' ? 'Delete' : key === 'biometric' ? 'Use biometric' : `Digit ${key}`"
            @mousedown.prevent
            @click="handleKeyPress(key)"
          >
            <!-- Biometric Icon (Face ID style) -->
            <template v-if="key === 'biometric'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
                <path d="M7 3H5a2 2 0 0 0-2 2v2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <path d="M17 21h2a2 2 0 0 0 2-2v-2"/>
                <circle cx="9" cy="9" r="1"/>
                <circle cx="15" cy="9" r="1"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              </svg>
            </template>

            <!-- Backspace Icon -->
            <template v-else-if="key === 'backspace'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </template>

            <!-- Number -->
            <template v-else>
              {{ key }}
            </template>
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* V54.6: Container - Full height flex layout */
.pin-input-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  gap: var(--space-md);
  outline: none;
}

/* V54.6: Premium PIN Panel - cohesive with Recovery/Verify surfaces */
.pin-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-lg) var(--space-md);
  /* Glass surface - matches phrase-hero/verify-card */
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-card);
}

/* Label */
.pin-label {
  text-align: center;
}

.pin-label p {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

/* V46: Screen reader only - hide visually but keep accessible */
.pin-label.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* V54.6: PIN Dots Rail - capsule container */
.pin-dots-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-lg);
  /* Subtle capsule border */
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-pill);
}

/* V54.6: PIN Dots - premium states */
.pin-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  /* Empty state: muted */
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.15s ease;
}

/* Filled state: solid/bright */
.pin-dot--filled {
  background: var(--color-text-primary);
  border-color: transparent;
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
}

/* Error state: warning ring */
.pin-dot--error {
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.2);
  animation: error-pulse 0.5s ease;
}

.pin-dot--error.pin-dot--filled {
  background: var(--color-error);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.5);
}

/* Active cursor (blinking) */
.pin-dot--active {
  background: rgba(255, 255, 255, 0.35);
  border-color: rgba(255, 255, 255, 0.3);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    background: rgba(255, 255, 255, 0.35);
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
  }
  50% {
    background: rgba(255, 255, 255, 0.15);
    box-shadow: none;
  }
}

/* V54.6: Error pulse animation */
@keyframes error-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.1); }
}

/* V54.6: prefers-reduced-motion - disable animations */
@media (prefers-reduced-motion: reduce) {
  .pin-dot--active,
  .pin-dot--error {
    animation: none;
  }
  .pin-dot,
  .keypad-btn {
    transition: none;
  }
}

/* V54.6: Helper text - subtle guidance */
.pin-helper {
  color: var(--color-text-muted);
  font-size: var(--font-size-2xs);
  margin: 0;
  text-align: center;
  line-height: 1.4;
}

/* V52.3: Error Slot - Fixed height, no layout shift */
.error-slot {
  min-height: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Hidden by default via opacity/transform (no reflow) */
  opacity: 0;
  transform: translateY(-2px);
  transition: opacity 0.15s ease, transform 0.15s ease;
  pointer-events: none;
}

.error-slot--visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.error-message {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  margin: 0;
  text-align: center;
  white-space: nowrap;
}

/* V54.6: Keypad Section */
.pin-keypad-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-sm);
  padding-top: var(--space-sm);
}

/* V54.6: Keypad - premium grid with consistent hit targets */
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-xs);
  width: 100%;
  max-width: 240px;
}

/* V54.6: Keypad button - premium surface + consistent sizing */
.keypad-btn {
  /* Fixed hit area - min 44px for accessibility */
  width: 56px;
  height: 48px;
  min-width: 44px;
  min-height: 44px;
  /* Premium surface */
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-md);
  /* Layout */
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  /* Typography - aligned to system */
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-normal);
  letter-spacing: 0.02em;
  color: var(--color-text-primary);
  /* Interaction */
  cursor: pointer;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

/* Hover state - matches app controls */
.keypad-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

/* Active/pressed state */
.keypad-btn:active:not(:disabled) {
  transform: scale(0.95);
  background: rgba(255, 255, 255, 0.06);
}

/* Focus-visible for keyboard nav */
.keypad-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}

/* Disabled state */
.keypad-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* V54.6: Action buttons (biometric/backspace) - same size as number keys */
.keypad-btn--action {
  color: var(--color-text-secondary);
  background: transparent;
  border-color: transparent;
}

.keypad-btn--action:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.08);
}

/* Icon sizing - consistent 22px */
.keypad-btn--action svg {
  width: 22px;
  height: 22px;
  min-width: 22px;
  min-height: 22px;
  flex-shrink: 0;
}

.keypad-btn--biometric {
  color: var(--color-text-secondary);
}

.keypad-btn--biometric svg {
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  flex-shrink: 0;
}

/* Utility: invisible but maintains grid space */
.invisible {
  visibility: hidden;
}
</style>
