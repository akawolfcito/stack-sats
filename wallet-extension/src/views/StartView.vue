<script setup lang="ts">
import { onBeforeMount, ref, nextTick } from "vue";
import { randomSeedPhrase } from "@stacks/wallet-sdk";
import { useRouter } from "vue-router";
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

onBeforeMount(() => {
  // Check if user already has a wallet
  if (sessionManager.hasWallet) {
    router.push({ path: "/unlock" });
  }
});
</script>

<template>
  <section class="start-view">
    <!-- Ambient Glow -->
    <div class="ambient-glow"></div>

    <!-- Step 1: Start -->
    <div v-if="currentStep === 'start'" class="start-content">
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
      <div class="actions">
        <!-- Primary Button -->
        <Button variant="primary" size="lg" full-width @click="handleGenerateSecret">
          Create New Wallet
        </Button>

        <!-- Secondary Button -->
        <Button variant="secondary" size="lg" full-width @click="handleImportMnemonic">
          Import Existing Wallet
        </Button>

        <p v-if="importError" class="error-text">{{ importError }}</p>

        <!-- Security Badge -->
        <div class="security-badge">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>END-TO-END ENCRYPTED</span>
        </div>
      </div>
    </div>

    <!-- Step 2: Show Mnemonic -->
    <div v-else-if="currentStep === 'mnemonic'" class="mnemonic-content">
      <!-- Header -->
      <div class="back-button-wrapper">
        <Button variant="icon" @click="handleBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Button>
      </div>

      <h2 class="step-title">Recovery Phrase</h2>

      <!-- Warning -->
      <div class="warning-box">
        <div class="warning-icon">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
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

      <!-- Mnemonic Grid -->
      <div class="mnemonic-grid">
        <div
          v-for="(word, index) in mnemonic.split(' ')"
          :key="index"
          class="mnemonic-word"
        >
          <span class="word-index">{{ index + 1 }}</span>
          <span class="word-text">{{ word }}</span>
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
    <div v-else class="pin-content">
      <!-- Header -->
      <div class="back-button-wrapper">
        <Button variant="icon" @click="handleBack">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </Button>
      </div>

      <PinInput
        ref="pinInputRef"
        :mode="currentStep === 'pin-create' ? 'create' : 'confirm'"
        :error="pinError"
        :disabled="isLoading"
        @complete="currentStep === 'pin-create' ? handlePinCreate($event) : handlePinConfirm($event)"
      />

      <p v-if="isLoading" class="loading-text">Creating wallet...</p>
    </div>

    <!-- Import Mnemonic Modal -->
    <ImportMnemonicModal
      :is-open="showImportModal"
      @close="showImportModal = false"
      @confirm="handleImportConfirm"
    />
  </section>
</template>

<style scoped>
.start-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--color-bg-primary);
  position: relative;
  overflow: hidden;
}

/* Ambient Glow */
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
  pointer-events: none;
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

/* Error Text */
.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

/* Mnemonic Content */
.mnemonic-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-xl);
  padding-top: 60px;
  gap: var(--space-lg);
  position: relative;
  z-index: 10;
}

.step-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  margin: 0;
}

/* Back Button Wrapper */
.back-button-wrapper {
  position: absolute;
  top: var(--space-xl);
  left: var(--space-lg);
  z-index: 10;
}

/* Warning Box */
.warning-box {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: rgba(234, 179, 8, 0.1);
  border: 1px solid rgba(234, 179, 8, 0.3);
  border-radius: var(--radius-xl);
}

.warning-icon {
  flex-shrink: 0;
  color: #eab308;
}

.warning-text {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.warning-text strong {
  color: #eab308;
  font-size: var(--font-size-sm);
}

.warning-text p {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0;
  line-height: 1.5;
}

/* V44: Mnemonic Grid - Using V43 card pattern */
.mnemonic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  padding: var(--space-lg);
  background: rgba(255, 255, 255, 0.02); /* V43: Card surface */
  border: 1px solid rgba(255, 255, 255, 0.06); /* V43: Card border */
  border-radius: var(--radius-card);
}

.mnemonic-word {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm);
}

.word-index {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  min-width: 20px;
}

.word-text {
  font-family: monospace;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

/* PIN Content */
.pin-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  padding-top: 80px;
  position: relative;
  z-index: 10;
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin-top: var(--space-lg);
}

.mt-auto {
  margin-top: auto;
}
</style>
