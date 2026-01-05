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
  const allFilled = digits.value.every((d) => d !== "");
  if (fullPin.length === PIN_LENGTH && allFilled) {
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

    <!-- Visual dots indicator -->
    <div class="pin-dots">
      <span
        v-for="(_, index) in PIN_LENGTH"
        :key="'dot-' + index"
        class="pin-dot"
        :class="{ filled: digits[index] !== '', error: error }"
      ></span>
    </div>

    <!-- Hidden inputs for actual entry -->
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
        class="pin-digit-hidden"
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
        Elige un PIN de 6 digitos para proteger tu wallet
      </template>
      <template v-else-if="mode === 'confirm'">
        Re-ingresa tu PIN para confirmar
      </template>
      <template v-else>
        Ingresa tu PIN de 6 digitos para desbloquear
      </template>
    </p>
  </div>
</template>

<style scoped>
.pin-input-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
  width: 100%;
}

.pin-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 1px;
}

/* Visual PIN Dots */
.pin-dots {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
}

.pin-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-bg-card);
  border: 2px solid var(--color-border);
  transition: all var(--transition-fast);
}

.pin-dot.filled {
  background: var(--color-accent-primary);
  border-color: var(--color-accent-primary);
}

.pin-dot.error {
  border-color: var(--color-error);
  animation: shake 0.3s ease-in-out;
}

.pin-dot.error.filled {
  background: var(--color-error);
}

/* Hidden inputs positioned over dots */
.pin-inputs {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
  position: relative;
  margin-top: -32px;
  height: 32px;
}

.pin-digit-hidden {
  width: 32px;
  height: 32px;
  opacity: 0;
  background: transparent;
  border: none;
  text-align: center;
  font-size: 1rem;
}

.pin-error {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 0;
}

.pin-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
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
