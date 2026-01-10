<script setup lang="ts">
import { ref, watch, computed } from "vue";

const props = defineProps<{
  mode: "create" | "confirm" | "unlock";
  error?: string;
  disabled?: boolean;
  showBiometric?: boolean;
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
      <!-- Label -->
      <div class="pin-label">
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

      <!-- Error Message -->
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>

    <!-- Bottom Section: Slot + Keypad -->
    <div class="pin-bottom">
      <!-- Slot for Forgot PIN link -->
      <slot name="above-keypad"></slot>

      <!-- Numeric Keypad -->
      <div class="keypad">
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

/* PIN Dots Container */
.pin-dots {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  height: 40px;
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
  background: var(--color-accent-primary);
  box-shadow: 0 0 10px rgba(232, 248, 89, 0.6);
}

.pin-dot--error {
  background: rgba(239, 68, 68, 0.3);
}

.pin-dot--error.pin-dot--filled {
  background: var(--color-error);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
}

/* Active cursor (blinking) */
.pin-dot--active {
  background: rgba(232, 248, 89, 0.3);
  box-shadow: 0 0 6px rgba(232, 248, 89, 0.4);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    background: rgba(232, 248, 89, 0.4);
    box-shadow: 0 0 6px rgba(232, 248, 89, 0.4);
  }
  50% {
    background: rgba(232, 248, 89, 0.15);
    box-shadow: 0 0 3px rgba(232, 248, 89, 0.2);
  }
}

/* Error Message */
.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  font-weight: 500;
  margin: 0;
  min-height: 20px;
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

/* Keypad - Minimalist style */
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px 16px;
  width: 100%;
  max-width: 280px;
}

.keypad-btn {
  width: 72px;
  height: 56px;
  border-radius: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  justify-self: center;
  font-size: 28px;
  font-weight: 300;
  color: var(--color-text-primary);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.keypad-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
}

.keypad-btn:active:not(:disabled) {
  transform: scale(0.92);
  background: rgba(255, 255, 255, 0.08);
}

.keypad-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.keypad-btn--action {
  color: var(--color-text-secondary);
}

.keypad-btn--action:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.keypad-btn--action svg {
  width: 24px;
  height: 24px;
}

.keypad-btn--biometric {
  color: var(--color-text-secondary);
}

.keypad-btn--biometric svg {
  width: 28px;
  height: 28px;
}
</style>
