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
    error.value = "Those words don't match. Check positions and try again.";
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
    <!-- V53.6: Left-aligned subtitle -->
    <p class="verify-subtitle">
      Enter the requested words to confirm you saved your recovery phrase.
    </p>

    <!-- V53.6: Input fields with consistent spacing -->
    <div class="verify-inputs">
      <div class="verify-field">
        <label class="verify-label">Word {{ word1Index + 1 }}</label>
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
        <label class="verify-label">Word {{ word2Index + 1 }}</label>
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

    <!-- V53.6: Error slot - reserved height, clean typography -->
    <div class="error-slot" aria-live="polite">
      <p v-if="error" class="error-text">{{ error }}</p>
    </div>

    <!-- V53.6: CTA Rail -->
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
/* V54.0: Main container - premium layout */
.verify-step {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  flex: 1;
  min-height: 0;
}

/* V54.0: Subtitle - compact, clear instruction */
.verify-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: left;
  margin: 0;
  line-height: 1.5;
}

/* V54.0: Input container - elevated surface for hero treatment */
.verify-inputs {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-lg);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-card);
}

.verify-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

/* V54.0: Label - compact, clear hierarchy */
.verify-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* V54.0: Input surface - premium material */
.verify-input {
  width: 100%;
  padding: var(--space-sm) var(--space-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
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
}

.verify-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-family);
}

/* V54.0: Error slot - reserved height, clean typography */
.error-slot {
  min-height: 20px;
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 0;
}

/* V54.0: CTA Rail */
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
