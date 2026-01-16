<script setup lang="ts">
/**
 * RecoveryPhraseDisplay - V53.2 Visual Consistency Component
 *
 * Shared component for displaying recovery phrase in both:
 * - StartView (onboarding / first wallet)
 * - AddWalletView (settings / add wallet)
 *
 * V53.2 Visual Consistency (LAYOUT ONLY):
 * - ALWAYS 2-slot bottom rail (left/right) with SAME dimensions
 * - When showBackButton=false: disabled ghost button with low opacity
 *   (NOT removed - maintains pixel-perfect layout parity)
 * - Primary CTA (right slot) has identical width/position in both flows
 * - No padding/margin differences between routes
 *
 * Features (unchanged):
 * - Default blur for security
 * - Reveal/Hide toggle (primary action)
 * - Copy with confirmation dialog (secondary action)
 * - "Copied" toast notification
 * - Responsive grid for side panel support
 * - No truncation/ellipsis on words
 * - No line-wrap on words
 *
 * Props:
 * - mnemonic: The recovery phrase string
 * - showBackButton: Whether Back button is interactive (default: false)
 */
import { ref, computed } from 'vue';
import { Button } from '@/components/ui';
import { secureLog } from '@/utils/security/logger';

// V53.2: Props for visual consistency
const props = withDefaults(defineProps<{
  mnemonic: string;
  showBackButton?: boolean;
}>(), {
  showBackButton: false,
});

// V53.2: Fixed CTA copy for visual parity between flows
const PRIMARY_CTA_LABEL = 'I saved it securely';

const emit = defineEmits<{
  continue: [];
  back: [];
}>();

// V53.1: Reveal/Hide toggle (default hidden for security)
const isRevealed = ref(false);
const showCopyConfirm = ref(false);
const copyToastVisible = ref(false);

// Parse words from mnemonic
const words = computed(() => props.mnemonic.split(' '));

// V53.1: Font autoscale for long words (no ellipsis, no line-wrap)
// Tiers: normal (<=8), long (9-10), xlong (>=11)
function getWordSizeClass(word: string): string {
  const len = word.length;
  if (len >= 11) return 'word-text--xlong';
  if (len >= 9) return 'word-text--long';
  return '';
}

// Toggle reveal state
function toggleReveal() {
  isRevealed.value = !isRevealed.value;
}

// Show copy confirmation dialog
function handleCopyClick() {
  showCopyConfirm.value = true;
}

// Confirm copy and show toast
async function confirmCopy() {
  showCopyConfirm.value = false;
  try {
    await navigator.clipboard.writeText(props.mnemonic);
    copyToastVisible.value = true;
    setTimeout(() => {
      copyToastVisible.value = false;
    }, 2000);
  } catch {
    secureLog('Clipboard copy failed');
  }
}

// Cancel copy
function cancelCopy() {
  showCopyConfirm.value = false;
}

// Handle continue
function handleContinue() {
  emit('continue');
}

// Handle back
function handleBack() {
  emit('back');
}
</script>

<template>
  <div class="recovery-phrase-display" data-roi="recovery-phrase-display">
    <!-- Warning Box -->
    <div class="warning-box" data-roi="warning-card">
      <div class="warning-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/>
          <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      </div>
      <div class="warning-text">
        <strong>Save your recovery phrase</strong>
        <p>Store it securely. Anyone with this phrase can access your wallet.</p>
      </div>
    </div>

    <!-- Action Bar: Reveal/Hide + Copy -->
    <div class="mnemonic-actions" data-roi="mnemonic-actions">
      <button
        class="action-btn action-btn--primary"
        data-roi="reveal-btn"
        @click="toggleReveal"
      >
        <svg v-if="isRevealed" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
          <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        {{ isRevealed ? 'Hide' : 'Reveal' }}
      </button>
      <button
        class="action-btn"
        data-roi="copy-btn"
        @click="handleCopyClick"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        Copy
      </button>
    </div>

    <!-- V53.2: Responsive Mnemonic Grid - blurred by default -->
    <div
      class="mnemonic-grid"
      :class="{ 'mnemonic-grid--hidden': !isRevealed }"
      data-roi="mnemonic-grid"
    >
      <div
        v-for="(word, index) in words"
        :key="index"
        class="mnemonic-word"
      >
        <span class="word-index">{{ index + 1 }}</span>
        <span
          class="word-text"
          :class="getWordSizeClass(word)"
        >{{ word }}</span>
      </div>
    </div>

    <!-- V53.2: CTA Rail - ALWAYS 2-slot for visual parity -->
    <div class="cta-rail" data-roi="recovery-phrase-cta">
      <!-- V53.2: Left slot - Back button (active OR ghost/disabled for layout parity) -->
      <Button
        variant="secondary"
        size="lg"
        class="cta-rail__back"
        :class="{ 'cta-rail__back--ghost': !showBackButton }"
        :disabled="!showBackButton"
        :tabindex="showBackButton ? 0 : -1"
        :aria-hidden="!showBackButton"
        data-roi="cta-back"
        @click="showBackButton ? handleBack() : undefined"
      >
        Back
      </Button>
      <!-- V53.2: Right slot - Primary CTA (same width/position in both flows) -->
      <Button
        variant="primary"
        size="lg"
        class="cta-rail__primary"
        data-roi="cta-primary"
        @click="handleContinue"
      >
        {{ PRIMARY_CTA_LABEL }}
      </Button>
    </div>

    <!-- Copy Confirmation Dialog -->
    <div v-if="showCopyConfirm" class="copy-confirm-overlay" data-roi="copy-confirm-dialog">
      <div class="copy-confirm-dialog">
        <div class="copy-confirm-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
        </div>
        <h3 class="copy-confirm-title">Copy Recovery Phrase?</h3>
        <p class="copy-confirm-text">
          Your clipboard may be accessible to other apps. Only copy if you're sure it's safe.
        </p>
        <div class="copy-confirm-actions">
          <Button variant="secondary" @click="cancelCopy">Cancel</Button>
          <Button variant="primary" @click="confirmCopy">Copy</Button>
        </div>
      </div>
    </div>

    <!-- Copied Toast -->
    <Transition name="toast">
      <div v-if="copyToastVisible" class="copy-toast" data-roi="copy-toast">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Copied to clipboard
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* V53.2: Main container */
.recovery-phrase-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  flex: 1;
}

/* Warning Box */
.warning-box {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-warning-muted);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: var(--radius-md);
}

.warning-icon {
  flex-shrink: 0;
  color: var(--color-warning);
  display: flex;
  align-items: flex-start;
  padding-top: 2px;
}

.warning-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.warning-text strong {
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}

.warning-text p {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0;
  line-height: 1.5;
}

/* Action Bar */
.mnemonic-actions {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
}

.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-chip);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  transition: all var(--transition-fast);
}

/* V53.2: Reveal is primary action - more prominent */
.action-btn--primary {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary);
}

.action-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary);
}

.action-btn:active {
  transform: scale(0.98);
}

/* V53.2: Responsive Mnemonic Grid */
.mnemonic-grid {
  display: grid;
  /* Responsive: auto-fit with min 90px for side panel support */
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 6px;
  padding: var(--space-md);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-card);
  transition: filter var(--transition-normal);
}

/* Hidden/blurred state */
.mnemonic-grid--hidden {
  filter: blur(8px);
  user-select: none;
  pointer-events: none;
}

/* Word cell - fixed height for consistency */
.mnemonic-word {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px var(--space-sm);
  min-height: 32px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  min-width: 0;
}

.mnemonic-word:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Word index */
.word-index {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  min-width: 14px;
  text-align: right;
  flex-shrink: 0;
}

/* V53.1: Word text - no ellipsis, no line-wrap */
.word-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
  white-space: nowrap;
  overflow: visible;
}

/* Font autoscale tiers */
.word-text--long {
  font-size: var(--font-size-xs);
}

.word-text--xlong {
  font-size: 10px;
}

/* V53.2: CTA Rail - ALWAYS 2-slot for visual parity */
.cta-rail {
  display: flex;
  gap: var(--space-md);
  margin-top: auto;
}

/* V53.2: Left slot (Back button) - flex: 1 */
.cta-rail__back {
  flex: 1;
  min-width: 0;
}

/* V53.2: Ghost state - low opacity, no interaction (pixel-perfect layout parity) */
.cta-rail__back--ghost {
  opacity: 0.15;
  pointer-events: none;
  cursor: default;
}

/* V53.2: Right slot (Primary CTA) - flex: 2 (same width in both flows) */
.cta-rail__primary {
  flex: 2;
  min-width: 0;
}

/* Copy Confirmation Dialog */
.copy-confirm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-lg);
}

.copy-confirm-dialog {
  background: var(--color-bg-card);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: var(--radius-card);
  padding: var(--space-xl);
  max-width: 320px;
  text-align: center;
  box-shadow: var(--shadow-elev-3);
}

.copy-confirm-icon {
  color: var(--color-warning);
  margin-bottom: var(--space-md);
}

.copy-confirm-title {
  color: var(--color-text-primary);
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  margin: 0 0 var(--space-sm);
}

.copy-confirm-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  margin: 0 0 var(--space-lg);
}

.copy-confirm-actions {
  display: flex;
  gap: var(--space-md);
}

.copy-confirm-actions :deep(.btn) {
  flex: 1;
}

/* Copied Toast */
.copy-toast {
  position: fixed;
  bottom: var(--space-xl);
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-success);
  color: var(--color-bg-base);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border-radius: var(--radius-chip);
  box-shadow: var(--shadow-elev-2);
  z-index: 101;
}

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(20px);
}
</style>
