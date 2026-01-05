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
  <section class="start-page">
    <div class="page-top">
      <div class="logo-container">
        <div class="logo-ring">
          <img src="/denvault-i.png" width="100" alt="DenVault" />
        </div>
      </div>
      <h1 class="title">Set Up Your Wallet</h1>
      <p class="subtitle">
        Create a new wallet or import an existing one to start managing your assets securely.
      </p>
    </div>

    <div class="page-bottom">
      <!-- Step 1: Start -->
      <div v-if="currentStep === 'start'" class="step-container">
        <button @click="handleGenerateSecret" class="action-card primary">
          <span class="action-icon primary">+</span>
          <span class="action-content">
            <span class="action-title">Create New Wallet</span>
            <span class="action-desc">Generate new recovery phrase</span>
          </span>
          <span class="action-arrow">›</span>
        </button>
        <button @click="handleImportMnemonic" class="action-card">
          <span class="action-icon secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </span>
          <span class="action-content">
            <span class="action-title">Import Existing Wallet</span>
            <span class="action-desc">Use recovery phrase or key</span>
          </span>
          <span class="action-arrow">›</span>
        </button>
        <p v-if="importError" class="error-text">{{ importError }}</p>

        <div class="security-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>END-TO-END ENCRYPTED</span>
        </div>
      </div>

      <!-- Step 2: Show Mnemonic -->
      <div v-else-if="currentStep === 'mnemonic'" class="step-container">
        <div class="mnemonic-warning">
          <strong>Save your recovery phrase</strong>
          <p>Store it securely. Anyone with this phrase can access your wallet.</p>
        </div>

        <div class="mnemonic-display">
          <div
            v-for="(word, index) in mnemonic.split(' ')"
            :key="index"
            class="mnemonic-word"
          >
            <span class="word-number">{{ index + 1 }}</span>
            <span class="word-text">{{ word }}</span>
          </div>
        </div>

        <div class="button-group">
          <button @click="handleBack" class="btn-secondary">Back</button>
          <button @click="handleContinueToPin" class="btn-primary">
            I saved it
          </button>
        </div>
      </div>

      <!-- Step 3: Create PIN -->
      <div v-else-if="currentStep === 'pin-create'" class="step-container">
        <PinInput
          ref="pinInputRef"
          mode="create"
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinCreate"
        />

        <div class="button-group">
          <button @click="handleBack" class="btn-secondary" :disabled="isLoading">
            Back
          </button>
        </div>
      </div>

      <!-- Step 4: Confirm PIN -->
      <div v-else-if="currentStep === 'pin-confirm'" class="step-container">
        <PinInput
          ref="pinInputRef"
          mode="confirm"
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinConfirm"
        />

        <div class="button-group">
          <button @click="handleBack" class="btn-secondary" :disabled="isLoading">
            Back
          </button>
        </div>

        <p v-if="isLoading" class="loading-text">Creating wallet...</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.start-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: var(--space-lg);
}

.page-top {
  text-align: center;
  padding-top: var(--space-xl);
  margin-bottom: var(--space-xl);
}

.logo-container {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-xl);
}

.logo-ring {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.logo-ring::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
  border: 1px solid var(--color-border);
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-md);
}

.subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  margin: 0;
  max-width: 300px;
  margin-left: auto;
  margin-right: auto;
}

.page-bottom {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.step-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  width: 100%;
}

/* Action Cards */
.action-card {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  cursor: pointer;
  transition: all var(--transition-base);
  text-align: left;
}

.action-card:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card-hover);
}

.action-card.primary {
  border-color: var(--color-accent-primary-muted);
}

.action-card.primary:hover {
  border-color: var(--color-accent-primary);
}

.action-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  font-size: 1.5rem;
  font-weight: var(--font-weight-bold);
}

.action-icon.primary {
  background: var(--color-accent-primary);
  color: var(--color-bg-primary);
}

.action-icon.secondary {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.action-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.action-title {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-base);
}

.action-desc {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
}

.action-arrow {
  color: var(--color-text-muted);
  font-size: 1.5rem;
  font-weight: 300;
}

/* Security Badge */
.security-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-xl);
  color: var(--color-accent-primary);
  font-size: var(--font-size-xs);
  letter-spacing: 1px;
}

.security-badge svg {
  stroke: var(--color-accent-primary);
}

/* Button Group */
.button-group {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.button-group .btn-secondary {
  flex: 1;
}

.button-group .btn-primary {
  flex: 2;
}

/* Mnemonic Warning */
.mnemonic-warning {
  background: var(--color-warning-muted);
  border: 1px solid var(--color-warning);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  text-align: center;
}

.mnemonic-warning strong {
  color: var(--color-warning);
  font-size: var(--font-size-base);
}

.mnemonic-warning p {
  margin: var(--space-sm) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

/* Mnemonic Display */
.mnemonic-display {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-sm);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
}

.mnemonic-word {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
}

.word-number {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  min-width: 18px;
}

.word-text {
  color: var(--color-text-primary);
}

/* Loading Text */
.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}
</style>
