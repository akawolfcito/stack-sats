<script setup lang="ts">
/**
 * ImportRecoveryPhraseView - V76 Dedicated Page
 *
 * Converted from ImportMnemonicModal to full page with:
 * - ScreenShell + AppHeader layout
 * - Exit guard: confirms if text entered and user navigates away
 * - Same UI components and validation logic
 *
 * Navigation:
 * - From: /add-wallet (Import Existing Wallet button)
 * - Success: returns to /add-wallet with mnemonic in route state
 * - Cancel: returns to /add-wallet
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useRouter, onBeforeRouteLeave } from 'vue-router';
import ScreenShell from '@/components/layout/ScreenShell.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import StickyCTA from '@/components/layout/StickyCTA.vue';

const router = useRouter();

const inputValue = ref('');
const error = ref('');
const textareaRef = ref<HTMLTextAreaElement | null>(null);

// Track if user has entered any text (for exit guard)
const hasUnsavedInput = computed(() => inputValue.value.trim().length > 0);

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

// Handle confirm - navigate back with mnemonic
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

  // Navigate back to add-wallet with mnemonic in state
  router.push({
    path: '/add-wallet',
    state: { importedMnemonic: seedPhrase }
  });
}

// Handle cancel - go back
function handleCancel() {
  // Clear for security before navigation
  inputValue.value = '';
  error.value = '';
  router.back();
}

// Handle back button
function handleBack() {
  // Let the route guard handle the confirmation
  router.back();
}

// V76: Exit guard - confirm if unsaved input
onBeforeRouteLeave((_to, _from) => {
  if (hasUnsavedInput.value) {
    const answer = window.confirm(
      'You have entered a recovery phrase. Are you sure you want to leave? Your input will be lost.'
    );
    if (!answer) return false;
  }
  // Clear sensitive data on leave
  inputValue.value = '';
  error.value = '';
  return true;
});

// Focus textarea on mount
onMounted(() => {
  textareaRef.value?.focus();
});

// Clear sensitive data on unmount
onBeforeUnmount(() => {
  inputValue.value = '';
  error.value = '';
});
</script>

<template>
  <ScreenShell :padded="false" data-roi="import-recovery-screen">
    <template #header>
      <AppHeader
        title="Import Recovery Phrase"
        left="back"
        @left-click="handleBack"
      />
    </template>

    <div class="import-content" data-roi="import-content">
      <!-- Security Notice -->
      <div class="security-notice">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="16" x2="12" y2="12"/>
          <line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
        <span>Never share your recovery phrase. Anyone with it can access your funds.</span>
      </div>

      <!-- Input Area - textarea with separate trailing action row -->
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
        <!-- Paste action row -->
        <div class="input-actions">
          <button class="paste-btn" type="button" data-roi="import-mnemonic-paste" @click="handlePaste">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Paste from clipboard
          </button>
        </div>
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

      <!-- Error with reserved slot -->
      <div class="error-slot" aria-live="polite">
        <p v-if="error" class="error-message">{{ error }}</p>
      </div>
    </div>

    <template #footer>
      <div class="footer-cta">
        <StickyCTA
          primary-text="Import Wallet"
          secondary-text="Cancel"
          :primary-disabled="!canSubmit"
          roi-prefix="import"
          @primary="handleConfirm"
          @secondary="handleCancel"
        />
      </div>
    </template>
  </ScreenShell>
</template>

<style scoped>
/* V76: Import page content */
.import-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  padding: var(--space-lg);
  padding-bottom: var(--space-md);
}

/* Security Notice - minimal, just text with icon */
.security-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--space-sm);
  padding: var(--space-sm) 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

.security-notice svg {
  flex-shrink: 0;
  margin-top: 1px;
  color: var(--color-warning);
}

/* Input Area - flex column with separate action row */
.input-area {
  display: flex;
  flex-direction: column;
  background: transparent;
  border: 1px solid var(--panel-divider);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.phrase-input {
  width: 100%;
  min-height: 88px;
  padding: var(--space-md);
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

/* Focus ring on container */
.input-area:focus-within {
  border-color: rgba(255, 255, 255, 0.16);
}

.phrase-input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-family);
}

/* Input actions row - trailing actions below textarea */
.input-actions {
  display: flex;
  justify-content: flex-end;
  padding: var(--space-xs) var(--space-sm);
  border-top: 1px solid var(--panel-divider);
  background: transparent;
}

/* Paste Button - inline trailing action, 40px touch target */
.paste-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-height: 40px;
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-row);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast),
    transform var(--transition-fast);
}

.paste-btn:hover {
  background: var(--surface-hover);
  color: var(--color-text-primary);
}

/* Tactile feedback */
.paste-btn:active {
  background: var(--surface-pressed);
  transform: scale(0.985);
}

.paste-btn svg {
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.paste-btn:hover svg {
  opacity: 1;
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

/* Word Preview Grid */
.word-preview {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
}

/* Word chip */
.word-chip {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: var(--surface-hover);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-2xs);
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

/* Error slot - reserved height for no layout shift */
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

/* Footer CTA wrapper */
.footer-cta {
  padding: var(--space-md) var(--space-lg);
  background: var(--screen-bg-base);
  border-top: 1px solid var(--panel-divider);
}
</style>
