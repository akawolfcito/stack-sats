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
    sessionManager.saveEncryptedWallet(encryptedData);

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
  // Check if user already has a wallet (encrypted or legacy)
  if (sessionManager.hasWallet) {
    router.push({ path: "/unlock" });
    return;
  }

  // Check for legacy unencrypted mnemonic
  const legacyMnemonic = localStorage.getItem("mnemonic");
  if (legacyMnemonic) {
    // Redirect to migration flow or user page
    router.push({ path: "/user" });
  }
});
</script>

<template>
  <section class="start-page">
    <div class="page-top">
      <img src="/laser-eyes-lil-guy-dark.png" width="100px" alt="laser-logo" />
      <h1>Stacks Wallet</h1>
      <div>Your Bitcoin experience, secured.</div>
    </div>

    <div class="page-bottom">
      <!-- Step 1: Start -->
      <div v-if="currentStep === 'start'" class="step-container">
        <button @click="handleGenerateSecret" class="btn-primary">
          Create New Wallet
        </button>
        <button @click="handleImportMnemonic" class="btn-secondary">
          Import Existing Wallet
        </button>
        <p v-if="importError" class="error-text">{{ importError }}</p>
      </div>

      <!-- Step 2: Show Mnemonic -->
      <div v-else-if="currentStep === 'mnemonic'" class="step-container">
        <div class="mnemonic-warning">
          <strong>Write down your recovery phrase!</strong>
          <p>Store it safely. Anyone with this phrase can access your wallet.</p>
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
            I've saved it
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
  padding: 20px;
}

.page-top {
  text-align: center;
  margin-bottom: 24px;
}

.page-top h1 {
  font-weight: 900;
  margin: 12px 0 4px;
}

.page-top div {
  color: #888;
  font-size: 0.9rem;
}

.page-bottom {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.step-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.btn-primary {
  background: #646cff;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover:not(:disabled) {
  background: #535bf2;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background: transparent;
  color: #888;
  border: 1px solid #444;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s;
}

.btn-secondary:hover:not(:disabled) {
  border-color: #666;
  color: #fff;
}

.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}

.button-group .btn-secondary {
  flex: 1;
}

.button-group .btn-primary {
  flex: 2;
}

.mnemonic-warning {
  background: rgba(255, 170, 0, 0.1);
  border: 1px solid rgba(255, 170, 0, 0.3);
  border-radius: 8px;
  padding: 12px;
  text-align: center;
}

.mnemonic-warning strong {
  color: #ffaa00;
}

.mnemonic-warning p {
  margin: 8px 0 0;
  font-size: 0.85rem;
  color: #888;
}

.mnemonic-display {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  background: #1a1a1a;
  padding: 16px;
  border-radius: 8px;
}

.mnemonic-word {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: monospace;
  font-size: 0.9rem;
}

.word-number {
  color: #666;
  font-size: 0.75rem;
  min-width: 20px;
}

.word-text {
  color: #fff;
}

.error-text {
  color: #ff4444;
  font-size: 0.875rem;
  text-align: center;
  margin: 0;
}

.loading-text {
  color: #888;
  font-size: 0.875rem;
  text-align: center;
  margin: 0;
}
</style>
