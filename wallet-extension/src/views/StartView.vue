<script setup lang="ts">
import { onBeforeMount, ref, nextTick } from "vue";
import { randomSeedPhrase } from "@stacks/wallet-sdk";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
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

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

// Generate random mnemonic seed phrase
const handleGenerateSecret = () => {
  const seedPhrase = randomSeedPhrase();
  secureLog("Mnemonic generated");
  mnemonic.value = seedPhrase;
  currentStep.value = "mnemonic";
};

// Import existing mnemonic
const handleImportMnemonic = () => {
  importError.value = "";
  const seedPhrase = prompt("Enter your 24-word mnemonic seed phrase");

  if (!seedPhrase) return;

  const trimmed = seedPhrase.trim().toLowerCase();
  const words = trimmed.split(/\s+/);

  // Basic validation
  if (words.length !== 24 && words.length !== 12) {
    importError.value = "Mnemonic must be 12 or 24 words";
    return;
  }

  // Basic validation - check if words look valid (alphanumeric lowercase)
  const isValidFormat = words.every((word) => /^[a-z]+$/.test(word));
  if (!isValidFormat) {
    importError.value = "Invalid mnemonic format";
    return;
  }

  secureLog("Mnemonic imported");
  mnemonic.value = trimmed;
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
        <button class="btn-primary-neon" @click="handleGenerateSecret">
          Create New Wallet
        </button>

        <!-- Secondary Button -->
        <button class="btn-secondary-neumorphic" @click="handleImportMnemonic">
          Import Existing Wallet
        </button>

        <p v-if="importError" class="error-text">{{ importError }}</p>

        <!-- Security Badge -->
        <div class="security-badge">
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      <button class="back-button" @click="handleBack">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <h2 class="step-title">Recovery Phrase</h2>

      <!-- Warning -->
      <div class="warning-box">
        <div class="warning-icon">
          <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
      <button class="btn-primary-neon mt-auto" @click="handleContinueToPin">
        I saved it securely
      </button>
    </div>

    <!-- Step 3 & 4: PIN -->
    <div v-else class="pin-content">
      <!-- Header -->
      <button class="back-button" @click="handleBack">
        <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
      </button>

      <PinInput
        ref="pinInputRef"
        :mode="currentStep === 'pin-create' ? 'create' : 'confirm'"
        :error="pinError"
        :disabled="isLoading"
        @complete="currentStep === 'pin-create' ? handlePinCreate($event) : handlePinConfirm($event)"
      />

      <p v-if="isLoading" class="loading-text">Creating wallet...</p>
    </div>
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
  box-shadow:
    8px 8px 16px rgba(18, 20, 9, 0.8),
    -8px -8px 16px rgba(46, 48, 23, 0.3);
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
  font-size: 32px;
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

/* Primary Neon Button */
.btn-primary-neon {
  width: 100%;
  height: 56px;
  background: var(--color-accent-primary);
  border: none;
  border-radius: 9999px;
  color: var(--color-bg-primary);
  font-size: 17px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 0 25px rgba(232, 248, 89, 0.15);
  transition: all 0.2s ease;
}

.btn-primary-neon:hover {
  background: #d9ea4d;
  box-shadow: 0 0 35px rgba(232, 248, 89, 0.3);
}

.btn-primary-neon:active {
  transform: scale(0.98);
}

/* Secondary Neumorphic Button */
.btn-secondary-neumorphic {
  width: 100%;
  height: 56px;
  background: #1a2424;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
  color: var(--color-text-primary);
  font-size: 17px;
  font-weight: 600;
  cursor: pointer;
  box-shadow:
    4px 4px 10px rgba(0, 0, 0, 0.3),
    -2px -2px 5px rgba(255, 255, 255, 0.03),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  transition: all 0.2s ease;
}

.btn-secondary-neumorphic:hover {
  color: var(--color-accent-primary);
}

.btn-secondary-neumorphic:active {
  transform: scale(0.98);
  box-shadow:
    inset 4px 4px 10px rgba(0, 0, 0, 0.3),
    inset -2px -2px 5px rgba(255, 255, 255, 0.03);
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
  font-size: 11px;
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
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  text-align: center;
  margin: 0;
}

/* Back Button */
.back-button {
  position: absolute;
  top: var(--space-xl);
  left: var(--space-lg);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.back-button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-accent-primary);
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

/* Mnemonic Grid */
.mnemonic-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
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
