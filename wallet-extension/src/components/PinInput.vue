<script setup lang="ts">
import { ref, watch, nextTick } from "vue";

const props = defineProps<{
  mode: "create" | "confirm" | "unlock";
  error?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "complete", pin: string): void;
  (e: "change", pin: string): void;
}>();

const PIN_LENGTH = 6;
const inputs = ref<HTMLInputElement[]>([]);
const digits = ref<string[]>(Array(PIN_LENGTH).fill(""));

const setInputRef = (el: HTMLInputElement | null, index: number) => {
  if (el) {
    inputs.value[index] = el;
  }
};

const focusInput = (index: number) => {
  if (index >= 0 && index < PIN_LENGTH) {
    nextTick(() => {
      inputs.value[index]?.focus();
      inputs.value[index]?.select();
    });
  }
};

const handleInput = (index: number, event: Event) => {
  const target = event.target as HTMLInputElement;
  const value = target.value;

  // Only allow digits
  if (!/^\d*$/.test(value)) {
    target.value = digits.value[index];
    return;
  }

  // Take only the last digit if multiple were pasted/typed
  const digit = value.slice(-1);
  digits.value[index] = digit;

  const fullPin = digits.value.join("");
  emit("change", fullPin);

  // Move to next input if digit entered
  if (digit && index < PIN_LENGTH - 1) {
    focusInput(index + 1);
  }

  // Emit complete when all digits are filled
  if (fullPin.length === PIN_LENGTH && !fullPin.includes("")) {
    emit("complete", fullPin);
  }
};

const handleKeydown = (index: number, event: KeyboardEvent) => {
  if (event.key === "Backspace") {
    if (!digits.value[index] && index > 0) {
      // Move to previous input if current is empty
      focusInput(index - 1);
      event.preventDefault();
    } else {
      // Clear current digit
      digits.value[index] = "";
      emit("change", digits.value.join(""));
    }
  } else if (event.key === "ArrowLeft" && index > 0) {
    focusInput(index - 1);
    event.preventDefault();
  } else if (event.key === "ArrowRight" && index < PIN_LENGTH - 1) {
    focusInput(index + 1);
    event.preventDefault();
  }
};

const handlePaste = (event: ClipboardEvent) => {
  event.preventDefault();
  const pastedData = event.clipboardData?.getData("text") || "";
  const pastedDigits = pastedData.replace(/\D/g, "").slice(0, PIN_LENGTH);

  for (let i = 0; i < PIN_LENGTH; i++) {
    digits.value[i] = pastedDigits[i] || "";
  }

  const fullPin = digits.value.join("");
  emit("change", fullPin);

  if (fullPin.length === PIN_LENGTH) {
    emit("complete", fullPin);
  } else {
    focusInput(pastedDigits.length);
  }
};

const clear = () => {
  digits.value = Array(PIN_LENGTH).fill("");
  emit("change", "");
  focusInput(0);
};

// Watch for error to clear and refocus
watch(
  () => props.error,
  (newError) => {
    if (newError) {
      clear();
    }
  }
);

// Focus first input on mount
const focus = () => {
  focusInput(0);
};

defineExpose({ clear, focus });

const modeLabels = {
  create: "Create your PIN",
  confirm: "Confirm your PIN",
  unlock: "Enter your PIN",
};
</script>

<template>
  <div class="pin-input-container">
    <label class="pin-label">{{ modeLabels[mode] }}</label>

    <div class="pin-inputs">
      <input
        v-for="(_, index) in PIN_LENGTH"
        :key="index"
        :ref="(el) => setInputRef(el as HTMLInputElement, index)"
        type="password"
        inputmode="numeric"
        maxlength="1"
        :value="digits[index]"
        :disabled="disabled"
        :class="{ 'pin-digit': true, 'has-error': error }"
        @input="handleInput(index, $event)"
        @keydown="handleKeydown(index, $event)"
        @paste="handlePaste"
        @focus="($event.target as HTMLInputElement).select()"
        autocomplete="off"
      />
    </div>

    <p v-if="error" class="pin-error">{{ error }}</p>

    <p class="pin-hint">
      <template v-if="mode === 'create'">
        Choose a 6-digit PIN to secure your wallet
      </template>
      <template v-else-if="mode === 'confirm'">
        Re-enter your PIN to confirm
      </template>
      <template v-else>
        Enter your 6-digit PIN to unlock
      </template>
    </p>
  </div>
</template>

<style scoped>
.pin-input-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.pin-label {
  font-size: 1rem;
  font-weight: 600;
  color: #fff;
}

.pin-inputs {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.pin-digit {
  width: 40px;
  height: 48px;
  text-align: center;
  font-size: 1.5rem;
  font-weight: bold;
  border: 2px solid #444;
  border-radius: 8px;
  background: #1a1a1a;
  color: #fff;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.pin-digit:focus {
  outline: none;
  border-color: #646cff;
  box-shadow: 0 0 0 3px rgba(100, 108, 255, 0.3);
}

.pin-digit.has-error {
  border-color: #ff4444;
  animation: shake 0.3s ease-in-out;
}

.pin-digit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.pin-error {
  color: #ff4444;
  font-size: 0.875rem;
  margin: 0;
}

.pin-hint {
  color: #888;
  font-size: 0.75rem;
  margin: 0;
  text-align: center;
}

@keyframes shake {
  0%,
  100% {
    transform: translateX(0);
  }
  25% {
    transform: translateX(-4px);
  }
  75% {
    transform: translateX(4px);
  }
}
</style>
