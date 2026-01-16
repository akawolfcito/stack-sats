<script setup lang="ts">
/**
 * PinInput - V52.3 No Layout Shift
 *
 * V52.3 Changes:
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
    @keydown="handleKeydown"
    @focus="isFocused = true"
    @blur="isFocused = false"
  >
    <!-- Top Section: Label + Dots + Error -->
    <div class="pin-top">
      <!-- Label (V46: can be hidden when modal provides context) -->
      <div class="pin-label" :class="{ 'sr-only': hideLabel }">
        <p>{{ modeLabels[mode] }}</p>
      </div>

      <!-- PIN Dots -->
      <div class="pin-dots">
        <div
          v-for="(digit, index) in PIN_LENGTH"
          :key="index"
          class="pin-dot"
          :class="{
            'pin-dot--filled': digits[index] !== '',
            'pin-dot--active': isFocused && index === currentIndex && !error && !disabled,
            'pin-dot--error': error,
            'animate-shake': error
          }"
        ></div>
      </div>

      <!-- V52.3: Error Slot - Fixed height, no layout shift -->
      <!-- Always rendered with constant height; error visibility via opacity/transform -->
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

    <!-- Bottom Section: Slot + Keypad -->
    <div class="pin-bottom">
      <!-- Slot for Forgot PIN link -->
      <slot name="above-keypad"></slot>

      <!-- Numeric Keypad - V52.3: ROI target for position guard test -->
      <div class="keypad" data-roi="pin-keypad">
        <template v-for="(row, rowIndex) in keypadRows" :key="rowIndex">
          <button
            v-for="key in row"
            :key="key"
            class="keypad-btn"
            :class="{
              'keypad-btn--action': key === 'biometric' || key === 'backspace',
              'keypad-btn--biometric': key === 'biometric',
              'invisible': key === 'biometric' && !showBiometric
            }"
            :disabled="disabled"
            @mousedown.prevent
            @click="handleKeyPress(key)"
          >
            <!-- Biometric Icon (Face ID style) -->
            <template v-if="key === 'biometric'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M7 3H5a2 2 0 0 0-2 2v2"/>
                <path d="M17 3h2a2 2 0 0 1 2 2v2"/>
                <path d="M7 21H5a2 2 0 0 1-2-2v-2"/>
                <path d="M17 21h2a2 2 0 0 0 2-2v-2"/>
                <circle cx="9" cy="9" r="1"/>
                <circle cx="15" cy="9" r="1"/>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"/>
              </svg>
            </template>

            <!-- Backspace Icon (simple arrow) -->
            <template v-else-if="key === 'backspace'">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
/* Container - Full height flex layout */
.pin-input-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  outline: none;
}

/* Top Section - Grows to push keypad down */
.pin-top {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-md);
  padding: 0 var(--card-pad-x);
}

/* Bottom Section - Fixed at bottom */
.pin-bottom {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0 var(--card-pad-x) var(--section-gap);
  gap: var(--space-md);
}

/* Label */
.pin-label {
  text-align: center;
}

.pin-label p {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.15em;
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

/* PIN Dots Container */
.pin-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  height: var(--icon-btn-size);
}

/* PIN Dots */
.pin-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  transition: all 0.2s ease;
}

.pin-dot--filled {
  background: var(--color-text-primary); /* v19: neutral white */
  box-shadow: 0 0 8px rgba(255, 255, 255, 0.3); /* v19: neutral glow */
}

.pin-dot--error {
  background: rgba(239, 68, 68, 0.3);
}

.pin-dot--error.pin-dot--filled {
  background: var(--color-error);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
}

/* Active cursor (blinking) - v19: neutral */
.pin-dot--active {
  background: rgba(255, 255, 255, 0.25);
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    background: rgba(255, 255, 255, 0.3);
    box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
  }
  50% {
    background: rgba(255, 255, 255, 0.12);
    box-shadow: 0 0 3px rgba(255, 255, 255, 0.15);
  }
}

/* V52.3: Error Slot - Fixed height, no layout shift */
.error-slot {
  /* Fixed height reservation - prevents layout shift */
  min-height: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Hidden by default via opacity/transform (no reflow) */
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity 0.2s ease, transform 0.2s ease;
  /* Prevent interaction when hidden */
  pointer-events: none;
}

.error-slot--visible {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

/* Error Message text inside slot */
.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin: 0;
  text-align: center;
  white-space: nowrap;
}

/* Shake animation */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
  20%, 40%, 60%, 80% { transform: translateX(4px); }
}

.animate-shake {
  animation: shake 0.5s ease-in-out;
}

/* V45: Keypad - Minimalist style with token-based states */
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-xs) var(--space-lg);
  width: 100%;
  max-width: 280px;
}

.keypad-btn {
  width: calc(var(--icon-btn-size) * 1.8);
  height: var(--control-h);
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  font-size: var(--font-size-2xl);
  font-weight: 300;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all var(--transition-fast);
  -webkit-tap-highlight-color: transparent;
}

/* V45: Using surface tokens for consistent interaction states */
.keypad-btn:hover:not(:disabled) {
  background: var(--surface-hover);
}

.keypad-btn:active:not(:disabled) {
  transform: scale(0.92);
  background: var(--surface-pressed);
}

.keypad-btn:disabled {
  opacity: var(--state-disabled-opacity);
  cursor: not-allowed;
}

/* V46: Action buttons (biometric/backspace) - ensure icons always visible */
.keypad-btn--action {
  color: var(--color-text-secondary);
}

.keypad-btn--action:hover:not(:disabled) {
  color: var(--color-text-primary);
}

/* V46: Fix compact icon visibility - explicit size + no shrink */
.keypad-btn--action svg {
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  flex-shrink: 0;
}

.keypad-btn--biometric {
  color: var(--color-text-secondary);
}

/* V46: Biometric icon - explicit size + no shrink */
.keypad-btn--biometric svg {
  width: 28px;
  height: 28px;
  min-width: 28px;
  min-height: 28px;
  flex-shrink: 0;
}
</style>
