<script setup lang="ts">
/**
 * StartView - V53 Entry Flow Premium Parity
 *
 * Wallet onboarding flow: create/import → mnemonic → PIN setup
 * Uses ScreenShell + AppHeader for consistent scaffold.
 *
 * V53 Changes:
 * - Migrated to ScreenShell + AppHeader pattern
 * - Ambient glow properly clipped (no overflow)
 * - data-roi targets for e2e testing
 * - Premium typography and surfaces
 */
import { onBeforeMount, ref, nextTick, computed } from "vue";
import { randomSeedPhrase } from "@stacks/wallet-sdk";
import { useRouter } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import PinInput from "@/components/PinInput.vue";
import ImportMnemonicModal from "@/components/ImportMnemonicModal.vue";
import { Button } from "@/components/ui";
import { encryptWithPIN, isValidPIN } from "@/utils/security";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";

const router = useRouter();

// Steps: 'start' -> 'mnemonic' -> 'pin-create' -> 'pin-confirm' -> done
type Step = "start" | "mnemonic" | "pin-create" | "pin-confirm";
const currentStep = ref<Step>("start");

// V53: Dynamic header config based on step
const headerConfig = computed(() => {
  switch (currentStep.value) {
    case "start":
      return { title: "", left: "none" as const, showHeader: false };
    case "mnemonic":
      return { title: "Recovery Phrase", left: "back" as const, showHeader: true };
    case "pin-create":
      return { title: "Create PIN", left: "back" as const, showHeader: true };
    case "pin-confirm":
      return { title: "Confirm PIN", left: "back" as const, showHeader: true };
    default:
      return { title: "", left: "none" as const, showHeader: false };
  }
});

const mnemonic = ref("");
const pin = ref("");
const pinConfirm = ref("");
const pinError = ref("");
const isLoading = ref(false);
const importError = ref("");
const showImportModal = ref(false);

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

// Generate random mnemonic seed phrase
const handleGenerateSecret = () => {
  const seedPhrase = randomSeedPhrase();
  secureLog("Mnemonic generated");
  mnemonic.value = seedPhrase;
  currentStep.value = "mnemonic";
};

// Open import modal
const handleImportMnemonic = () => {
  importError.value = "";
  showImportModal.value = true;
};

// Handle confirmed import from modal
const handleImportConfirm = (seedPhrase: string) => {
  showImportModal.value = false;
  secureLog("Mnemonic imported");
  mnemonic.value = seedPhrase;
  currentStep.value = "mnemonic";
};

// Proceed to PIN creation
const handleContinueToPin = () => {
  currentStep.value = "pin-create";
  nextTick(() => {
    pinInputRef.value?.focus();
  });
};

// Handle PIN creation
const handlePinCreate = (enteredPin: string) => {
  if (!isValidPIN(enteredPin)) {
    pinError.value = "PIN must be 6 digits";
    return;
  }

  pin.value = enteredPin;
  pinError.value = "";
  currentStep.value = "pin-confirm";
  nextTick(() => {
    pinInputRef.value?.clear();
    pinInputRef.value?.focus();
  });
};

// Handle PIN confirmation
const handlePinConfirm = async (enteredPin: string) => {
  if (enteredPin !== pin.value) {
    pinError.value = "PINs do not match";
    pinConfirm.value = "";
    return;
  }

  pinError.value = "";
  isLoading.value = true;

  try {
    // Encrypt mnemonic with PIN
    const encryptedData = await encryptWithPIN(mnemonic.value, pin.value);

    // Save encrypted wallet
    await sessionManager.saveEncryptedWalletAsync(encryptedData);

    // Unlock session
    await sessionManager.unlock(pin.value);

    secureLog("Wallet created and encrypted");

    // Clear sensitive data from memory
    mnemonic.value = "";
    pin.value = "";
    pinConfirm.value = "";

    // Navigate to user page
    router.push({ path: "/user" });
  } catch (error) {
    pinError.value = "Failed to create wallet";
    secureLog("Wallet creation failed", error);
  } finally {
    isLoading.value = false;
  }
};

// Go back to previous step
const handleBack = () => {
  pinError.value = "";

  switch (currentStep.value) {
    case "mnemonic":
      mnemonic.value = "";
      currentStep.value = "start";
      break;
    case "pin-create":
      pin.value = "";
      currentStep.value = "mnemonic";
      break;
    case "pin-confirm":
      pinConfirm.value = "";
      currentStep.value = "pin-create";
      nextTick(() => {
        pinInputRef.value?.clear();
        pinInputRef.value?.focus();
      });
      break;
  }
};

// V53.1: Font autoscale for long mnemonic words (no ellipsis, no line-wrap)
// Tiers: normal (<=8), long (9-10), xlong (>=11)
function getWordSizeClass(word: string): string {
  const len = word.length;
  if (len >= 11) return 'word-text--xlong';  // xlong: 11+ chars
  if (len >= 9) return 'word-text--long';    // long: 9-10 chars
  return '';                                  // normal: <=8 chars
}

onBeforeMount(() => {
  // Check if user already has a wallet
  if (sessionManager.hasWallet) {
    router.push({ path: "/unlock" });
  }
});
</script>

<template>
  <ScreenShell :padded="false">
    <!-- V53: Header only shown on steps after 'start' -->
    <template v-if="headerConfig.showHeader" #header>
      <AppHeader
        :title="headerConfig.title"
        :left="headerConfig.left"
        @left-click="handleBack"
      />
    </template>

    <div class="start-view" data-roi="start-view-root">
      <!-- V53: Ambient glow wrapper - clips oversized glow -->
      <div class="ambient-wrapper">
        <div class="ambient-glow"></div>
      </div>

      <!-- Step 1: Start (Hero landing) -->
      <div v-if="currentStep === 'start'" class="start-content" data-roi="start-hero">
        <!-- Logo -->
        <div class="logo-container">
          <div class="logo-glow"></div>
          <div class="logo-box">
            <img src="/denvault-i.png" alt="DenVault" class="logo-image" />
          </div>
        </div>

        <!-- Text -->
        <div class="text-section">
          <h1 class="title">Set Up Your Wallet</h1>
          <p class="subtitle">
            Securely store your Stacks (STX) and Bitcoin (BTC).
          </p>
        </div>

        <!-- Actions -->
        <div class="actions" data-roi="start-cta-rail">
          <Button
            variant="primary"
            size="lg"
            full-width
            data-roi="start-primary-cta"
            @click="handleGenerateSecret"
          >
            Create New Wallet
          </Button>

          <Button
            variant="secondary"
            size="lg"
            full-width
            data-roi="start-secondary-cta"
            @click="handleImportMnemonic"
          >
            Import Existing Wallet
          </Button>

          <!-- V53: Error with reserved slot (no layout shift) -->
          <div class="error-slot" aria-live="polite">
            <p v-if="importError" class="error-text">{{ importError }}</p>
          </div>

          <!-- Security Badge -->
          <div class="security-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>END-TO-END ENCRYPTED</span>
          </div>
        </div>
      </div>

      <!-- Step 2: Show Mnemonic -->
      <div v-else-if="currentStep === 'mnemonic'" class="mnemonic-content" data-roi="mnemonic-step">
        <!-- Warning -->
        <div class="warning-box">
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

        <!-- V53: Mnemonic Grid - V43 card pattern -->
        <!-- V54: Font autoscale for long words (no ellipsis truncation) -->
        <div class="mnemonic-grid" data-roi="mnemonic-grid">
          <div
            v-for="(word, index) in mnemonic.split(' ')"
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

        <!-- Continue Button -->
        <div class="cta-wrapper">
          <Button variant="primary" size="lg" full-width @click="handleContinueToPin">
            I saved it securely
          </Button>
        </div>
      </div>

      <!-- Step 3 & 4: PIN -->
      <div v-else class="pin-content" data-roi="pin-step">
        <PinInput
          ref="pinInputRef"
          :mode="currentStep === 'pin-create' ? 'create' : 'confirm'"
          hide-label
          :error="pinError"
          :disabled="isLoading"
          @complete="currentStep === 'pin-create' ? handlePinCreate($event) : handlePinConfirm($event)"
        />

        <p v-if="isLoading" class="loading-text">Creating wallet...</p>
      </div>
    </div>

    <!-- Import Mnemonic Modal -->
    <ImportMnemonicModal
      :is-open="showImportModal"
      @close="showImportModal = false"
      @confirm="handleImportConfirm"
    />
  </ScreenShell>
</template>

<style scoped>
/* V53: Main container - flex within ScreenShell */
.start-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
  /* V53: NO overflow:hidden hack - use ambient-wrapper clipping */
}

/* V53: Ambient glow wrapper - clips oversized glow (same as ConfirmTxView) */
.ambient-wrapper {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

/* V53: Ambient glow - contained within wrapper */
.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 50%;
  background: var(--color-accent-primary);
  opacity: 0.05;
  filter: blur(100px);
  border-radius: 50%;
}

/* Start Content */
.start-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  gap: var(--space-xl);
  position: relative;
  z-index: 10;
}

/* Logo */
.logo-container {
  position: relative;
}

.logo-glow {
  position: absolute;
  inset: -16px;
  background: var(--color-accent-primary);
  opacity: 0.2;
  filter: blur(32px);
  border-radius: 50%;
  transition: opacity 0.5s ease;
}

.logo-container:hover .logo-glow {
  opacity: 0.4;
}

.logo-box {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 24px;
  background: linear-gradient(135deg, #2a2d15, #1a1c0d);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: var(--shadow-elev-2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-image {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  object-fit: cover;
}

/* Text Section */
.text-section {
  text-align: center;
  max-width: 320px;
}

.title {
  font-size: var(--font-size-3xl);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-sm);
}

.subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

/* Actions */
.actions {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* CTA Wrapper */
.cta-wrapper {
  margin-top: auto;
  width: 100%;
}

/* Security Badge */
.security-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  opacity: 0.5;
  color: var(--color-text-primary);
}

.security-badge span {
  font-size: var(--font-size-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* V53: Error slot - reserved height for no layout shift */
.error-slot {
  min-height: 20px; /* Reserved for error text */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Error Text */
.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

/* Mnemonic Content - V53: uses AppHeader, no extra top padding */
.mnemonic-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  gap: var(--space-lg);
  position: relative;
  z-index: 1;
}

/* V53: Warning Box - using warning tokens */
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
  align-items: center;
  justify-content: center;
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

/* V45: Mnemonic Grid - Premium word list with V43 card */
.mnemonic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: var(--space-md);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-card);
}

/* V54: Word cell - fixed height for consistency */
.mnemonic-word {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  padding: 4px var(--space-sm);
  min-height: 32px; /* V54: Fixed height for all cells */
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  min-width: 0; /* Prevent grid blowout */
}

.mnemonic-word:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* V45: Index - muted numeric badge */
.word-index {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  min-width: 14px;
  text-align: right;
  flex-shrink: 0;
}

/* V53.1: Word text - no ellipsis, no line-wrap, font autoscale */
.word-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
  /* V53.1: Single line only - no wrapping, no ellipsis */
  white-space: nowrap;
  overflow: visible;
  /* NO text-overflow: ellipsis - word must be fully readable */
}

/* V53.1: Font autoscale tiers for long words */
.word-text--long {
  font-size: var(--font-size-xs);  /* 9-10 char words */
}

.word-text--xlong {
  font-size: 10px;  /* 11+ char words - smallest readable */
}

/* V53: PIN Content - uses AppHeader, centered layout */
.pin-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  position: relative;
  z-index: 1;
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-top: var(--space-lg);
}
</style>
