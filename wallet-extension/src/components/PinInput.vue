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
  <div class="flex flex-col items-center gap-4 w-full">
    <label class="text-sm font-medium text-text-secondary uppercase tracking-wider">
      {{ modeLabels[mode] }}
    </label>

    <!-- Visual dots indicator -->
    <div class="flex gap-3 justify-center">
      <span
        v-for="(_, index) in PIN_LENGTH"
        :key="'dot-' + index"
        class="w-4 h-4 rounded-full bg-bg-card border-2 border-border-default transition-all duration-150"
        :class="{
          'bg-primary border-primary shadow-[0_0_12px_rgba(232,248,89,0.6)]': digits[index] !== '' && !error,
          'border-error': error,
          'bg-error border-error': error && digits[index] !== '',
          'animate-shake': error
        }"
      ></span>
    </div>

    <!-- Hidden inputs for actual entry -->
    <div class="flex gap-3 justify-center relative -mt-8 h-8">
      <input
        v-for="(_, index) in PIN_LENGTH"
        :key="index"
        :ref="(el) => setInputRef(el as HTMLInputElement, index)"
        type="password"
        inputmode="numeric"
        maxlength="1"
        :value="digits[index]"
        :disabled="disabled"
        class="w-8 h-8 opacity-0 bg-transparent border-none text-center text-base"
        @input="handleInput(index, $event)"
        @keydown="handleKeydown(index, $event)"
        @paste="handlePaste"
        @focus="($event.target as HTMLInputElement).select()"
        autocomplete="off"
      />
    </div>

    <p v-if="error" class="text-error text-sm m-0">{{ error }}</p>

    <p class="text-text-muted text-xs m-0 text-center">
      <template v-if="mode === 'create'">
        Choose a 6-digit PIN to protect your wallet
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
