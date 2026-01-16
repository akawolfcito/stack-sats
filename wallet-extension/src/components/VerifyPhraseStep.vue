<script setup lang="ts">
/**
 * VerifyPhraseStep - V54.3 Premium Verification Component
 *
 * 2-word verification step to confirm user saved their recovery phrase.
 * Used by both StartView and AddWalletView.
 *
 * V54.3 Premium Pass:
 * - Extension-first layout (no wasted vertical space)
 * - Single full-width CTA (header back exists in parent)
 * - Disabled CTA until both inputs filled
 * - Keyboard flow: Enter moves focus, submits on second
 * - Reserved error slot (no layout shift)
 * - Premium visual cohesion with RecoveryPhraseDisplay
 *
 * Props:
 * - mnemonic: The recovery phrase to verify against
 * - word1Index: Index of first word to verify (0-based)
 * - word2Index: Index of second word to verify (0-based)
 */
import { ref, computed, onMounted } from 'vue';
import { Button } from '@/components/ui';

const props = defineProps<{
  mnemonic: string;
  word1Index: number;
  word2Index: number;
}>();

const emit = defineEmits<{
  verified: [];
}>();

const word1Input = ref('');
const word2Input = ref('');
const error = ref('');
const isVerifying = ref(false);

// V54.3: Input refs for keyboard navigation
const input1Ref = ref<HTMLInputElement | null>(null);
const input2Ref = ref<HTMLInputElement | null>(null);

// Get expected words
const words = computed(() => props.mnemonic.split(' '));
const expectedWord1 = computed(() => words.value[props.word1Index]?.toLowerCase() || '');
const expectedWord2 = computed(() => words.value[props.word2Index]?.toLowerCase() || '');

// V54.3: CTA disabled until both inputs filled (trimmed)
const canVerify = computed(() => {
  return word1Input.value.trim().length > 0 && word2Input.value.trim().length > 0 && !isVerifying.value;
});

// V54.3: Autofocus first input on mount
onMounted(() => {
  input1Ref.value?.focus();
});

// V54.3: Keyboard handler for first input (Enter → focus second)
function handleInput1Keydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    event.preventDefault();
    input2Ref.value?.focus();
  }
}

// V54.3: Keyboard handler for second input (Enter → verify)
function handleInput2Keydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && canVerify.value) {
    event.preventDefault();
    handleVerify();
  }
}

// Handle verification
function handleVerify() {
  if (!canVerify.value) return;

  const input1 = word1Input.value.trim().toLowerCase();
  const input2 = word2Input.value.trim().toLowerCase();

  if (input1 !== expectedWord1.value || input2 !== expectedWord2.value) {
    error.value = "Words don't match. Check your positions and try again.";
    return;
  }

  error.value = '';
  isVerifying.value = true;
  emit('verified');
}
</script>

<template>
  <div class="verify-step" data-roi="verify-phrase-step">
    <!-- V54.3: Step indicator + compact subtitle -->
    <div class="verify-header">
      <span class="step-indicator">Final step</span>
      <p class="verify-subtitle">
        Enter words #{{ word1Index + 1 }} and #{{ word2Index + 1 }} to continue.
      </p>
    </div>

    <!-- V54.3: Input card - premium surface, compact spacing -->
    <div class="verify-card" data-roi="verify-inputs-card">
      <div class="verify-field">
        <label class="verify-label" :for="`word-${word1Index + 1}`">Word #{{ word1Index + 1 }}</label>
        <input
          :id="`word-${word1Index + 1}`"
          ref="input1Ref"
          v-model="word1Input"
          type="text"
          class="verify-input"
          :placeholder="`Type word #${word1Index + 1}`"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-roi="verify-word-1-input"
          @keydown="handleInput1Keydown"
        />
      </div>

      <div class="verify-field">
        <label class="verify-label" :for="`word-${word2Index + 1}`">Word #{{ word2Index + 1 }}</label>
        <input
          :id="`word-${word2Index + 1}`"
          ref="input2Ref"
          v-model="word2Input"
          type="text"
          class="verify-input"
          :placeholder="`Type word #${word2Index + 1}`"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-roi="verify-word-2-input"
          @keydown="handleInput2Keydown"
        />
      </div>

      <!-- V54.3: Helper text inside card -->
      <p class="verify-helper">
        Use your saved recovery phrase to find these words.
      </p>
    </div>

    <!-- V54.3: Error slot - reserved height, system tokens -->
    <div class="error-slot" aria-live="polite">
      <p v-if="error" class="error-text" data-roi="verify-error">{{ error }}</p>
    </div>

    <!-- V54.3: CTA Rail - single full-width button (header back exists) -->
    <div class="cta-rail" data-roi="verify-phrase-cta">
      <Button
        variant="primary"
        size="lg"
        full-width
        :disabled="!canVerify"
        data-roi="verify-cta-primary"
        @click="handleVerify"
      >
        Verify & Continue
      </Button>
    </div>
  </div>
</template>

<style scoped>
/* V54.3: Main container - extension-first compact layout */
.verify-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  flex: 1;
  min-height: 0;
}

/* V54.3: Header section - step indicator + subtitle */
.verify-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* V54.3: Step indicator - subtle context */
.step-indicator {
  color: var(--color-text-muted);
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* V54.3: Subtitle - 1-line, clear instruction */
.verify-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: left;
  margin: 0;
  line-height: 1.4;
}

/* V54.3: Input card - cohesive with RecoveryPhraseDisplay hero */
.verify-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-md);
  /* Match phrase-hero surface */
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-card);
}

.verify-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

/* V54.3: Label - sentence case, clean hierarchy */
.verify-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

/* V54.3: Input surface - premium material, compact */
.verify-input {
  width: 100%;
  height: 40px;
  padding: 0 var(--space-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
  transition: all var(--transition-fast);
}

.verify-input:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
}

.verify-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  background: rgba(255, 255, 255, 0.05);
}

.verify-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
}

/* V54.3: Helper text - subtle guidance inside card */
.verify-helper {
  color: var(--color-text-muted);
  font-size: var(--font-size-2xs);
  margin: 0;
  line-height: 1.4;
  padding-top: var(--space-xs);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* V54.3: Error slot - reserved height, system tokens */
.error-slot {
  min-height: 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-xs);
  margin: 0;
  line-height: 1.4;
}

/* V54.3: CTA Rail - single full-width button */
.cta-rail {
  display: flex;
  margin-top: auto;
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);
}
</style>
