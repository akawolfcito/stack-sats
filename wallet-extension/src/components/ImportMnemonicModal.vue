<script setup lang="ts">
/**
 * ImportMnemonicModal - Secure in-app seed phrase import
 *
 * Replaces native prompt() with a premium, secure experience.
 * Uses Sheet component for consistent modal behavior.
 *
 * Security features:
 * - No autocomplete, autocorrect, spellcheck, autocapitalize
 * - Visual word count validation
 * - Clear security messaging
 * - Paste button for convenience
 */
import { ref, computed, watch, nextTick } from 'vue';
import { Sheet, Button } from '@/components/ui';

const props = defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [seedPhrase: string];
}>();

const inputValue = ref('');
const error = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Parse words from input
const words = computed(() => {
  const trimmed = inputValue.value.trim().toLowerCase();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).filter(Boolean);
});

// Word count for visual feedback
const wordCount = computed(() => words.value.length);

// Validation state
const isValidWordCount = computed(() => {
  return wordCount.value === 12 || wordCount.value === 24;
});

const isValidFormat = computed(() => {
  if (words.value.length === 0) return true;
  return words.value.every((word) => /^[a-z]+$/.test(word));
});

const canSubmit = computed(() => {
  return isValidWordCount.value && isValidFormat.value;
});

// Word count color
const wordCountColor = computed(() => {
  if (wordCount.value === 0) return 'muted';
  if (wordCount.value === 12 || wordCount.value === 24) return 'success';
  if (wordCount.value > 24) return 'error';
  return 'warning';
});

// Handle paste from clipboard
async function handlePaste() {
  try {
    const text = await navigator.clipboard.readText();
    inputValue.value = text.trim().toLowerCase();
    error.value = '';
  } catch {
    error.value = 'Failed to read clipboard';
  }
}

// Handle confirm
function handleConfirm() {
  error.value = '';

  if (!isValidWordCount.value) {
    error.value = 'Recovery phrase must be 12 or 24 words';
    return;
  }

  if (!isValidFormat.value) {
    error.value = 'Invalid phrase format. Use lowercase letters only.';
    return;
  }

  const seedPhrase = words.value.join(' ');
  emit('confirm', seedPhrase);
}

// Handle close
function handleClose() {
  inputValue.value = '';
  error.value = '';
  emit('close');
}

// Focus textarea when modal opens
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    nextTick(() => {
      textareaRef.value?.focus();
    });
  } else {
    // Clear on close for security
    inputValue.value = '';
    error.value = '';
  }
});
</script>

<template>
  <Sheet
    :is-open="isOpen"
    variant="bottom"
    title="Import Recovery Phrase"
    @close="handleClose"
  >
    <template #icon>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </template>

    <div class="import-modal">
      <!-- Security Notice -->
      <div class="security-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>Never share your recovery phrase. Anyone with it can access your funds.</span>
      </div>

      <!-- Input Area -->
      <div class="input-area">
        <textarea
          ref="textareaRef"
          v-model="inputValue"
          class="phrase-input"
          placeholder="Enter your 12 or 24 word recovery phrase..."
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          rows="4"
        />

        <!-- Paste Button -->
        <button class="paste-btn" type="button" @click="handlePaste">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Paste
        </button>
      </div>

      <!-- Word Count Indicator -->
      <div class="word-count" :class="`word-count--${wordCountColor}`">
        <span class="word-count__number">{{ wordCount }}</span>
        <span class="word-count__label">/ 12 or 24 words</span>
      </div>

      <!-- Word Preview Grid (shows parsed words) -->
      <div v-if="words.length > 0" class="word-preview">
        <div
          v-for="(word, index) in words.slice(0, 24)"
          :key="index"
          class="word-chip"
          :class="{ 'word-chip--invalid': !/^[a-z]+$/.test(word) }"
        >
          <span class="word-chip__index">{{ index + 1 }}</span>
          <span class="word-chip__text">{{ word }}</span>
        </div>
      </div>

      <!-- Error Message -->
      <p v-if="error" class="error-message">{{ error }}</p>
    </div>

    <template #footer>
      <div class="footer-actions">
        <Button variant="secondary" @click="handleClose">
          Cancel
        </Button>
        <Button
          variant="primary"
          :disabled="!canSubmit"
          @click="handleConfirm"
        >
          Import Wallet
        </Button>
      </div>
    </template>
  </Sheet>
</template>

<style scoped>
.import-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

/* Security Notice */
.security-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-md);
  background: rgba(251, 191, 36, 0.1);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-xs);
  color: var(--color-warning);
  line-height: 1.5;
}

.security-notice svg {
  flex-shrink: 0;
  margin-top: 1px;
}

/* Input Area */
.input-area {
  position: relative;
}

.phrase-input {
  width: 100%;
  min-height: 100px;
  padding: var(--space-lg);
  padding-right: 80px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  resize: none;
  box-sizing: border-box;
}

.phrase-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
}

.phrase-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-family);
}

/* Paste Button */
.paste-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--surface-hover);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.paste-btn:hover {
  background: var(--surface-pressed);
  color: var(--color-text-primary);
}

/* Word Count */
.word-count {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
}

.word-count__number {
  font-weight: var(--font-weight-bold);
  font-family: var(--font-mono);
}

.word-count__label {
  color: var(--color-text-muted);
}

.word-count--muted .word-count__number {
  color: var(--color-text-muted);
}

.word-count--warning .word-count__number {
  color: var(--color-warning);
}

.word-count--success .word-count__number {
  color: var(--color-success);
}

.word-count--error .word-count__number {
  color: var(--color-error);
}

/* Word Preview Grid */
.word-preview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-xs);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  max-height: 140px;
  overflow-y: auto;
}

.word-chip {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--surface-hover);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-2xs);
}

.word-chip--invalid {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.word-chip__index {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  min-width: 14px;
}

.word-chip__text {
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-chip--invalid .word-chip__text {
  color: var(--color-error);
}

/* Error Message */
.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 0;
  text-align: center;
}

/* Footer Actions */
.footer-actions {
  display: flex;
  gap: var(--space-md);
}

.footer-actions :deep(.btn) {
  flex: 1;
}
</style>
