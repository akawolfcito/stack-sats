<script setup lang="ts">
/**
 * RecoveryPhraseDisplay - V54.5 Premium Toast Update
 *
 * Shared component for displaying recovery phrase in both:
 * - StartView (onboarding / first wallet)
 * - AddWalletView (settings / add wallet)
 *
 * V54.5 Changes:
 * - Premium Toast component (backdrop blur, elevated surface)
 * - Positioned to never overlap CTA
 * - Smooth fade + translate animation
 *
 * V54.2 Zero-Shift Layout (preserved):
 * - ZERO layout shift across states (hidden → revealed → hidden)
 * - Caption slot reserves fixed height even when invisible
 * - Bottom Back button REMOVED (header back exists in parent)
 * - Primary CTA is full-width for cleaner layout
 * - Modal aligned to app visual system
 *
 * Features:
 * - Default blur for security
 * - Reveal/Hide toggle via hero overlay (primary) or text button (secondary)
 * - Copy disabled until revealed (security-by-design)
 * - Copy with confirmation dialog
 * - "Copied" toast notification
 * - Responsive grid for side panel support
 * - No truncation/ellipsis on words
 * - No line-wrap on words
 *
 * Props:
 * - mnemonic: The recovery phrase string
 */
import { ref, computed } from 'vue';
import { Button, Toast } from '@/components/ui';
import { secureLog } from '@/utils/security/logger';

const props = defineProps<{
  mnemonic: string;
}>();

// V54.2: Simplified CTA - single primary button
const PRIMARY_CTA_LABEL = 'I saved it securely';

const emit = defineEmits<{
  continue: [];
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

// V54.5: Confirm copy and show toast (Toast handles auto-hide)
async function confirmCopy() {
  showCopyConfirm.value = false;
  try {
    await navigator.clipboard.writeText(props.mnemonic);
    copyToastVisible.value = true;
  } catch {
    secureLog('Clipboard copy failed');
  }
}

// V54.5: Hide toast handler
function hideToast() {
  copyToastVisible.value = false;
}

// Cancel copy
function cancelCopy() {
  showCopyConfirm.value = false;
}

// Handle continue
function handleContinue() {
  emit('continue');
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

    <!-- V54.2: Action Panel - stable height across states (zero layout shift) -->
    <div class="action-panel" data-roi="mnemonic-actions">
      <div class="action-panel__buttons">
        <button
          class="action-btn action-btn--primary"
          :class="{ 'action-btn--active': isRevealed }"
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
          :class="{ 'action-btn--disabled': !isRevealed }"
          :disabled="!isRevealed"
          data-roi="copy-btn"
          @click="isRevealed ? handleCopyClick() : undefined"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
      </div>
      <!-- V54.2: Caption - always rendered, visibility controlled via CSS (zero shift) -->
      <p
        class="action-panel__caption"
        :class="{ 'action-panel__caption--hidden': isRevealed }"
        aria-live="polite"
      >
        Reveal to enable Copy
      </p>
    </div>

    <!-- V54.1: Phrase Area - hero section with clickable reveal overlay -->
    <div class="phrase-hero" data-roi="phrase-hero">
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
      <!-- V54.1: Clickable reveal overlay - primary reveal affordance -->
      <button
        v-if="!isRevealed"
        type="button"
        class="phrase-veil"
        data-roi="phrase-veil-btn"
        aria-label="Reveal recovery phrase"
        @click="toggleReveal"
      >
        <span class="phrase-veil__label">Click to reveal</span>
      </button>
    </div>

    <!-- V54.2: CTA Rail - Single primary button (header back exists in parent) -->
    <div class="cta-rail" data-roi="recovery-phrase-cta">
      <Button
        variant="primary"
        size="lg"
        full-width
        data-roi="cta-primary"
        @click="handleContinue"
      >
        {{ PRIMARY_CTA_LABEL }}
      </Button>
    </div>

    <!-- V53.8: Copy Confirmation Dialog - premium modal -->
    <div v-if="showCopyConfirm" class="copy-confirm-overlay" data-roi="copy-confirm-dialog">
      <div class="copy-confirm-dialog">
        <!-- Header: icon + title baseline aligned -->
        <div class="copy-confirm-header">
          <svg class="copy-confirm-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <h3 class="copy-confirm-title">Copy to Clipboard?</h3>
        </div>
        <!-- Body -->
        <p class="copy-confirm-text">
          Your clipboard may be readable by other apps on this device. Copy only if you trust it.
        </p>
        <!-- Actions rail -->
        <div class="copy-confirm-actions">
          <Button variant="secondary" @click="cancelCopy">Cancel</Button>
          <Button variant="primary" @click="confirmCopy">Copy</Button>
        </div>
      </div>
    </div>

    <!-- V54.5: Premium Toast Component -->
    <Toast
      :visible="copyToastVisible"
      message="Copied to clipboard"
      icon="check"
      :duration="1800"
      @hide="hideToast"
    />
  </div>
</template>

<style scoped>
/* V53.4: Main container - robust height handling */
.recovery-phrase-display {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  flex: 1;
  min-height: 0; /* Allow flex shrinking in short viewports */
}

/* V54.0: Warning Box - compact, reduced vertical weight */
.warning-box {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: var(--color-warning-muted);
  border: 1px solid rgba(234, 179, 8, 0.15);
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.warning-icon {
  flex-shrink: 0;
  color: var(--color-warning);
  display: flex;
  align-items: center;
}

.warning-icon svg {
  width: 16px;
  height: 16px;
}

.warning-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.warning-text strong {
  color: var(--color-warning);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
}

.warning-text p {
  color: var(--color-text-muted);
  font-size: var(--font-size-2xs);
  margin: 0;
  line-height: 1.4;
}

/* V53.8: Ghost Action Rail - subtle grouping, buttons are hero */
.action-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-sm) 0;
  flex-shrink: 0;
  /* Ghost: no background, no border - just logical grouping */
}

.action-panel__buttons {
  display: flex;
  justify-content: center;
  gap: var(--space-md);
}

/* V54.2: Caption - fixed height slot for zero layout shift */
.action-panel__caption {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin: 0;
  text-align: center;
  line-height: 1.5;
  /* V54.2: Reserve height even when invisible */
  min-height: 1.5em;
  transition: opacity var(--transition-fast), visibility var(--transition-fast);
}

/* V54.2: Hidden state - invisible but reserves space (zero shift) */
.action-panel__caption--hidden {
  visibility: hidden;
  opacity: 0;
  pointer-events: none;
}

/* V54.1: Action buttons - secondary text-button style (downgraded prominence) */
.action-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  line-height: 1;
  overflow: visible;
}

/* V54.1: Prevent icon clipping in buttons */
.action-btn svg {
  display: block;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

/* V54.1: Reveal button - subtle, not competing with hero overlay */
.action-btn--primary {
  color: var(--color-text-muted);
}

/* V54.1: Hover - subtle background highlight */
.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

/* V54.1: Pressed */
.action-btn:active:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
}

/* V54.1: Focus-visible - keyboard accessibility */
.action-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-accent-primary);
}

/* V54.1: Active state - accent color when revealed */
.action-btn--active {
  color: var(--color-accent-primary);
}

/* V54.1: Disabled state for copy button */
.action-btn--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

/* V54.0: Phrase Hero - elevated surface, visual prominence */
.phrase-hero {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-radius: var(--radius-card);
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
}

/* V54.0: Mnemonic Grid - hero content */
.mnemonic-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
  gap: 6px;
  padding: var(--space-md);
  transition: filter var(--transition-normal);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
}

/* Hidden/blurred state */
.mnemonic-grid--hidden {
  filter: blur(6px);
  user-select: none;
  pointer-events: none;
}

/* V54.1: Clickable Reveal Overlay - primary reveal affordance */
.phrase-veil {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(2px);
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.phrase-veil:hover {
  background: rgba(0, 0, 0, 0.35);
}

.phrase-veil:active {
  background: rgba(0, 0, 0, 0.5);
}

.phrase-veil:focus-visible {
  outline: none;
  box-shadow:
    inset 0 0 0 2px var(--color-accent-primary);
}

.phrase-veil__label {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  padding: var(--space-sm) var(--space-md);
  background: rgba(0, 0, 0, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-chip);
  transition: all var(--transition-fast);
}

.phrase-veil:hover .phrase-veil__label {
  background: rgba(0, 0, 0, 0.8);
  border-color: rgba(255, 255, 255, 0.25);
  transform: scale(1.02);
}

.phrase-veil:active .phrase-veil__label {
  transform: scale(0.98);
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

/* V54.2: CTA Rail - single full-width button (header back exists) */
.cta-rail {
  display: flex;
  margin-top: auto;
  flex-shrink: 0; /* Never shrink - CTA must always be visible */
  padding-bottom: env(safe-area-inset-bottom, 0); /* Mobile/extension safe area */
}

/* V54.2: Copy Confirmation Dialog - aligned to app visual system */
.copy-confirm-overlay {
  position: fixed;
  inset: 0;
  /* V54.2: Backdrop matches existing overlays (phrase-veil style) */
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  /* V54.2: Responsive safe padding for extension viewport */
  padding: var(--space-md);
  animation: modal-fade-in 0.15s ease-out;
}

@keyframes modal-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.copy-confirm-dialog {
  /* V54.2: Match phrase-hero surface style */
  background: rgba(255, 255, 255, 0.03);
  /* V54.2: Border matches phrase-hero border */
  border: 1px solid rgba(255, 255, 255, 0.08);
  /* V54.2: Radius matches card/hero radius */
  border-radius: var(--radius-card);
  padding: var(--space-lg);
  /* V54.2: Responsive width for extension viewports */
  width: min(320px, calc(100vw - var(--space-xl)));
  max-width: 100%;
  box-shadow: var(--shadow-elev-3);
  animation: modal-scale-in 0.15s ease-out;
}

@keyframes modal-scale-in {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

/* V54.2: Header row - consistent with app typography */
.copy-confirm-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-sm);
}

.copy-confirm-icon {
  color: var(--color-warning);
  flex-shrink: 0;
}

.copy-confirm-title {
  color: var(--color-text-primary);
  /* V54.2: Match warning-text strong styling */
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  margin: 0;
}

/* V54.2: Body text - matches app body style */
.copy-confirm-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  margin: 0 0 var(--space-md);
}

/* V54.2: Actions rail - consistent button styling */
.copy-confirm-actions {
  display: flex;
  gap: var(--space-sm);
}

.copy-confirm-actions :deep(.btn) {
  flex: 1;
}

/* V54.5: Toast styles moved to reusable Toast component */
</style>
