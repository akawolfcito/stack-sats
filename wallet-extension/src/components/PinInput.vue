<script setup lang="ts">
/**
 * PinInput - V54.7 PIN Premium Rebalance
 *
 * Streamlined PIN input aligned with Recovery/Verify visual system.
 *
 * V54.7 Changes:
 * - Removed oversized panel wrapper - dots capsule is the only premium surface
 * - Ghost-premium keypad (minimal fill, hover brighten, active scale)
 * - Reduced visual weight for extension viewport
 * - Compact layout with consistent spacing
 * - prefers-reduced-motion safe animations preserved
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
  hideLabel?: boolean;
  helperText?: string;
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

  const index = currentIndex.value;
  if (index < PIN_LENGTH) {
    digits.value[index] = key;
    const fullPin = digits.value.join("");
    emit("change", fullPin);

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
  const container = document.querySelector(".pin-input-container");
  if (container instanceof HTMLElement) {
    container.focus();
  }
};

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
    <!-- V54.7: Dots section - the only premium surface -->
    <div class="pin-dots-section" data-roi="pin-dots-section">
      <!-- V54.7: Label - compact, uppercase -->
      <div class="pin-label" :class="{ 'sr-only': hideLabel }">
        <p>{{ modeLabels[mode] }}</p>
      </div>

      <!-- V54.7: PIN Dots Capsule - the primary premium surface -->
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

      <!-- V54.7: Helper text - subtle, below dots -->
      <p v-if="helperText && !error" class="pin-helper" data-roi="pin-helper">
        {{ helperText }}
      </p>

      <!-- Error Slot - Fixed height, no layout shift -->
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

    <!-- V54.7: Keypad Section - ghost-premium -->
    <div class="pin-keypad-section">
      <!-- Slot for custom content above keypad (Forgot PIN, etc.) -->
      <slot name="above-keypad"></slot>

      <!-- V54.7: Ghost-Premium Keypad -->
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
            <!-- Biometric Icon -->
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
                <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
                <line x1="18" y1="9" x2="12" y2="15"/>
                <line x1="12" y1="9" x2="18" y2="15"/>
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
/* V54.7: Container - flex column, full height */
.pin-input-container {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  gap: var(--space-sm);
  outline: none;
}

/* V54.7: Dots section - replaces oversized panel */
.pin-dots-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
}

/* V54.7: Label - compact uppercase */
.pin-label {
  text-align: center;
}

.pin-label p {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin: 0;
}

/* Screen reader only */
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

/* V54.7: PIN Dots Rail - the primary premium surface */
.pin-dots-rail {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  /* Glass capsule - matches Recovery/Verify tokens */
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-pill);
}

/* V54.7: PIN Dots - premium states */
.pin-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  /* Empty state */
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.15s ease;
}

/* Filled state */
.pin-dot--filled {
  background: var(--color-text-primary);
  border-color: transparent;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.3);
}

/* Error state */
.pin-dot--error {
  border-color: var(--color-error);
  background: rgba(239, 68, 68, 0.2);
  animation: error-pulse 0.4s ease;
}

.pin-dot--error.pin-dot--filled {
  background: var(--color-error);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}

/* Active cursor */
.pin-dot--active {
  background: rgba(255, 255, 255, 0.25);
  border-color: rgba(255, 255, 255, 0.2);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    background: rgba(255, 255, 255, 0.25);
    box-shadow: 0 0 4px rgba(255, 255, 255, 0.2);
  }
  50% {
    background: rgba(255, 255, 255, 0.1);
    box-shadow: none;
  }
}

@keyframes error-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.08); }
}

/* prefers-reduced-motion */
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

/* V54.7: Helper text */
.pin-helper {
  color: var(--color-text-muted);
  font-size: var(--font-size-2xs);
  margin: 0;
  text-align: center;
  line-height: 1.4;
}

/* Error Slot - Fixed height */
.error-slot {
  min-height: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
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

/* V54.7: Keypad Section */
.pin-keypad-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: var(--space-sm);
}

/* V54.7: Ghost-Premium Keypad */
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  width: 100%;
  max-width: 220px;
}

/* V54.7: Ghost-Premium Button */
.keypad-btn {
  /* Consistent hit area - min 44px for accessibility */
  width: 64px;
  height: 48px;
  min-width: 44px;
  min-height: 44px;
  /* Ghost: minimal fill */
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-md);
  /* Layout */
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  /* Typography */
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-normal);
  letter-spacing: 0.01em;
  color: var(--color-text-primary);
  /* Interaction */
  cursor: pointer;
  transition: all 0.12s ease;
  -webkit-tap-highlight-color: transparent;
}

/* Hover: brighten */
.keypad-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.1);
}

/* Active: scale down */
.keypad-btn:active:not(:disabled) {
  transform: scale(0.96);
  background: rgba(255, 255, 255, 0.04);
}

/* Focus-visible: accent ring */
.keypad-btn:focus-visible {
  outline: none;
  box-shadow: inset 0 0 0 2px var(--color-accent-primary);
}

/* Disabled */
.keypad-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

/* V54.7: Action buttons (biometric/backspace) */
.keypad-btn--action {
  color: var(--color-text-secondary);
  border-color: transparent;
}

.keypad-btn--action:hover:not(:disabled) {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.05);
}

/* Icon sizing */
.keypad-btn--action svg {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
}

.keypad-btn--biometric {
  color: var(--color-text-secondary);
}

.keypad-btn--biometric svg {
  width: 22px;
  height: 22px;
}

/* Utility: invisible but maintains grid space */
.invisible {
  visibility: hidden;
}
</style>
