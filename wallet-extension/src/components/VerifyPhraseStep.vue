<script setup lang="ts">
/**
 * VerifyPhraseStep - V53.2 Shared Verification Component
 *
 * 2-word verification step to confirm user saved their recovery phrase.
 * Used by both StartView and AddWalletView.
 *
 * Props:
 * - mnemonic: The recovery phrase to verify against
 * - word1Index: Index of first word to verify (0-based)
 * - word2Index: Index of second word to verify (0-based)
 */
import { ref, computed } from 'vue';
import { Button } from '@/components/ui';

const props = defineProps<{
  mnemonic: string;
  word1Index: number;
  word2Index: number;
}>();

const emit = defineEmits<{
  verified: [];
  back: [];
}>();

const word1Input = ref('');
const word2Input = ref('');
const error = ref('');

// Get expected words
const words = computed(() => props.mnemonic.split(' '));
const expectedWord1 = computed(() => words.value[props.word1Index]?.toLowerCase() || '');
const expectedWord2 = computed(() => words.value[props.word2Index]?.toLowerCase() || '');

// Handle verification
function handleVerify() {
  const input1 = word1Input.value.trim().toLowerCase();
  const input2 = word2Input.value.trim().toLowerCase();

  if (input1 !== expectedWord1.value || input2 !== expectedWord2.value) {
    error.value = "Words don't match. Please check and try again.";
    return;
  }

  error.value = '';
  emit('verified');
}

// Handle back
function handleBack() {
  word1Input.value = '';
  word2Input.value = '';
  error.value = '';
  emit('back');
}
</script>

<template>
  <div class="verify-step" data-roi="verify-phrase-step">
    <!-- V53.5: Left-aligned subtitle for consistency with field labels -->
    <p class="verify-subtitle">
      Confirm you saved your recovery phrase by entering the requested words.
    </p>

    <!-- V53.5: Input fields with premium surface treatment -->
    <div class="verify-inputs">
      <div class="verify-field">
        <label class="verify-label">Word #{{ word1Index + 1 }}</label>
        <input
          v-model="word1Input"
          type="text"
          class="verify-input"
          placeholder="Enter word"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-roi="verify-word-1-input"
        />
      </div>

      <div class="verify-field">
        <label class="verify-label">Word #{{ word2Index + 1 }}</label>
        <input
          v-model="word2Input"
          type="text"
          class="verify-input"
          placeholder="Enter word"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          data-roi="verify-word-2-input"
        />
      </div>
    </div>

    <!-- V53.5: Premium error slot with reserved height -->
    <div class="error-slot" aria-live="polite">
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>

    <!-- V53.5: CTA Rail - matches RecoveryPhraseDisplay pattern -->
    <div class="cta-rail" data-roi="verify-phrase-cta">
      <Button variant="secondary" size="lg" class="cta-rail__back" @click="handleBack">
        Back
      </Button>
      <Button variant="primary" size="lg" class="cta-rail__primary" @click="handleVerify">
        Verify & Continue
      </Button>
    </div>
  </div>
</template>

<style scoped>
/* V53.5: Main container with flex layout */
.verify-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  flex: 1;
  min-height: 0; /* Allow flex shrinking */
}

/* V53.5: Left-aligned subtitle for consistency */
.verify-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: left;
  margin: 0;
  line-height: 1.5;
}

/* V53.5: Input container with reduced gap */
.verify-inputs {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  flex: 1;
  min-height: 0;
}

.verify-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* V53.5: Label with better contrast */
.verify-label {
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* V53.5: Premium input surface */
.verify-input {
  width: 100%;
  padding: var(--space-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.03);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
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
  box-shadow: 0 0 0 2px rgba(var(--color-accent-primary-rgb, 163, 230, 53), 0.15);
}

.verify-input::placeholder {
  color: rgba(255, 255, 255, 0.35);
  font-family: var(--font-family);
}

/* V53.5: Premium error slot with reserved height */
.error-slot {
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-shrink: 0;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* V53.5: Error text with icon-like prefix */
.error-text::before {
  content: '!';
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--color-error);
  color: var(--color-bg-base);
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

/* V53.5: CTA Rail - matches RecoveryPhraseDisplay pattern */
.cta-rail {
  display: flex;
  gap: var(--space-md);
  margin-top: auto;
  flex-shrink: 0;
  padding-bottom: env(safe-area-inset-bottom, 0);
}

.cta-rail__back {
  flex: 1;
  min-width: 0;
}

.cta-rail__primary {
  flex: 2;
  min-width: 0;
}
</style>
