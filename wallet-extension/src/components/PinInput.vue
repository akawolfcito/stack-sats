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

    <!-- Numeric Keypad -->
    <div class="keypad">
      <template v-for="(row, rowIndex) in keypadRows" :key="rowIndex">
        <button
          v-for="key in row"
          :key="key"
          class="keypad-btn"
          :class="{
            'keypad-btn--number': key !== 'biometric' && key !== 'backspace',
            'keypad-btn--action': key === 'biometric' || key === 'backspace',
            'keypad-btn--biometric': key === 'biometric',
            'invisible': key === 'biometric' && !showBiometric
          }"
          :disabled="disabled"
          @mousedown.prevent
          @click="handleKeyPress(key)"
        >
          <!-- Biometric Icon -->
          <template v-if="key === 'biometric'">
            <svg class="w-8 h-8" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.5">
              <path d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04A12.054 12.054 0 0 1 4 11V7a8 8 0 0 1 16 0v4a12.01 12.01 0 0 1-.553 3.618M10.042 21.39A12.054 12.054 0 0 1 12 11m0 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/>
            </svg>
          </template>

          <!-- Backspace Icon -->
          <template v-else-if="key === 'backspace'">
            <svg class="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
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
</template>

<style scoped>
/* Container */
.pin-input-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 0 16px;
  gap: 12px;
  outline: none;
}

/* Label */
.pin-label {
  text-align: center;
}

.pin-label p {
  font-size: 12px;
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
  background: var(--color-bg-primary);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 2px 2px 4px rgba(0, 0, 0, 0.5),
    inset -1px -1px 2px rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.pin-dot--filled {
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 10px rgba(232, 248, 89, 0.6);
}

.pin-dot--error {
  border-color: var(--color-error);
}

.pin-dot--error.pin-dot--filled {
  background: var(--color-error);
  box-shadow: 0 0 10px rgba(239, 68, 68, 0.6);
}

/* Active cursor (blinking) */
.pin-dot--active {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 6px rgba(232, 248, 89, 0.4);
  animation: blink 1s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% {
    border-color: var(--color-accent-primary);
    box-shadow: 0 0 6px rgba(232, 248, 89, 0.4);
  }
  50% {
    border-color: rgba(232, 248, 89, 0.3);
    box-shadow: 0 0 3px rgba(232, 248, 89, 0.2);
  }
}

/* Error Message */
.error-message {
  color: var(--color-error);
  font-size: 13px;
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

/* Keypad */
.keypad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px 12px;
  width: 100%;
  max-width: 220px;
  margin-top: 4px;
}

.keypad-btn {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 300;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  cursor: pointer;
  transition: all 0.15s ease;
  -webkit-tap-highlight-color: transparent;
}

.keypad-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
}

.keypad-btn:active:not(:disabled) {
  transform: scale(0.95);
  background: rgba(232, 248, 89, 0.1);
}

.keypad-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.keypad-btn--action {
  width: 60px;
  height: 60px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: none;
  color: var(--color-text-muted);
}

.keypad-btn--action:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  color: var(--color-text-primary);
}

.keypad-btn--action svg {
  width: 22px;
  height: 22px;
}

.keypad-btn--biometric {
  color: var(--color-accent-primary);
}

.keypad-btn--biometric:hover:not(:disabled) {
  color: var(--color-accent-primary);
}
</style>
