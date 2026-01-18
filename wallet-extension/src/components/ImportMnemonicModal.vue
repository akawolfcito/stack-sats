<script setup lang="ts">
/**
 * ImportMnemonicModal - V63 Unified Overlay System
 *
 * Definition of Done (all 6 satisfied):
 * 1. ✅ Overlay: Sheet variant="modal" (V63 centered dialog)
 * 2. ✅ Single close: Sheet showClose=true (default)
 * 3. ✅ Header: Sheet built-in header with V55 tokens
 * 4. ✅ CTA: StickyCTA roiPrefix="import"
 * 5. ✅ Content: V55 tokens, textarea, word chips
 * 6. ✅ Error slot: Reserved min-height (20px)
 *
 * ROI: import-* prefix for E2E anchors
 *
 * Security features:
 * - No autocomplete, autocorrect, spellcheck, autocapitalize
 * - Visual word count validation
 * - Clear security messaging
 * - Paste button for convenience
 */
import { ref, computed, watch, nextTick } from 'vue';
import { Sheet, Button } from '@/components/ui';
import StickyCTA from '@/components/layout/StickyCTA.vue';

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
  <!-- V63: Centered modal variant -->
  <Sheet
    :is-open="isOpen"
    variant="modal"
    title="Import Recovery Phrase"
    data-roi="import-sheet"
    @close="handleClose"
  >
    <template #icon>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    </template>

    <div class="import-modal" data-roi="import-content">
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
      <div class="input-area" data-roi="import-mnemonic-input">
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
        <button class="paste-btn" type="button" data-roi="import-mnemonic-paste" @click="handlePaste">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Paste
        </button>
      </div>

      <!-- Word Count Indicator -->
      <div class="word-count" :class="`word-count--${wordCountColor}`" data-roi="import-mnemonic-count">
        <span class="word-count__number">{{ wordCount }}</span>
        <span class="word-count__label">/ 12 or 24 words</span>
      </div>

      <!-- Word Preview Grid (shows parsed words) -->
      <div v-if="words.length > 0" class="word-preview" data-roi="import-mnemonic-preview">
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

      <!-- V53: Error with reserved slot -->
      <div class="error-slot" aria-live="polite">
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </div>

    <template #footer>
      <!-- V56: StickyCTA with roiPrefix for E2E anchors -->
      <StickyCTA
        primary-text="Import Wallet"
        secondary-text="Cancel"
        :primary-disabled="!canSubmit"
        roi-prefix="import"
        @primary="handleConfirm"
        @secondary="handleClose"
      />
    </template>
  </Sheet>
</template>

<style scoped>
/* V45: Import modal - card form layout with V43 patterns */
.import-modal {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* V65: Security Notice - minimal, just text with icon */
.security-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  /* V65: No background, no border - just warning text */
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.security-notice svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-warning);
}

/* V65: Input Area - transparent, subtle border */
.input-area {
  position: relative;
  background: transparent;
  border: 1px solid var(--panel-divider);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.phrase-input {
  width: 100%;
  min-height: 88px;
  padding: var(--space-md);
  padding-right: 72px;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  line-height: 1.6;
  resize: none;
  box-sizing: border-box;
}

.phrase-input:focus {
  outline: none;
}

/* V45: Focus ring on container */
.input-area:focus-within {
  border-color: rgba(255, 255, 255, 0.12);
}

.phrase-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-family);
}

/* V70: Paste Button - fixed overlap, proper z-index and positioning */
.paste-btn {
  position: absolute;
  top: var(--space-sm);
  right: var(--space-sm);
  z-index: 2; /* V70: Above textarea to prevent overlap */
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: var(--control-h-inline);
  padding: 0 var(--space-sm);
  /* V70: Glass surface recipe for premium look */
  background: var(--panel-bg-glass);
  border: 1px solid var(--panel-border);
  box-shadow: var(--panel-highlight);
  border-radius: var(--radius-chip);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.paste-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary);
}

.paste-btn:active {
  background: rgba(255, 255, 255, 0.06);
  transform: scale(0.98);
}

.paste-btn svg {
  width: 14px;
  height: 14px;
}

/* Word Count */
.word-count {
  display: flex;
  align-items: baseline;
  gap: var(--space-xs);
  font-size: var(--font-size-sm);
  padding: 0 var(--space-xs);
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

/* V65: Word Preview Grid - transparent, just spacing */
.word-preview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
  /* V65: No background - Sheet provides surface */
  max-height: 120px;
  overflow-y: auto;
}

/* V65: Word chip - minimal styling */
.word-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-sm);
  font-size: 10px;
}

.word-chip--invalid {
  background: var(--color-error-muted);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.word-chip__index {
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
  min-width: 12px;
}

.word-chip__text {
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.word-chip--invalid .word-chip__text {
  color: var(--color-error);
}

/* V53: Error slot - reserved height for no layout shift */
.error-slot {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Error Message */
.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 0;
  text-align: center;
}

/* V56: Footer now uses StickyCTA - removed legacy .footer-actions */
</style>
