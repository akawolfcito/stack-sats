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
  <section class="flex flex-col min-h-full p-4">
    <!-- Header -->
    <div class="text-center pt-6 mb-6">
      <!-- Logo with glow ring -->
      <div class="flex justify-center mb-6">
        <div class="relative">
          <div class="absolute -inset-2 rounded-full border border-border-default"></div>
          <div class="w-[100px] h-[100px] rounded-full bg-bg-card border border-border-default flex items-center justify-center relative">
            <img src="/denvault-i.png" width="80" alt="DenVault" class="rounded-full" />
          </div>
        </div>
      </div>
      <h1 class="text-2xl font-bold text-text-primary mb-3">Set Up Your Wallet</h1>
      <p class="text-text-secondary text-sm leading-relaxed max-w-[300px] mx-auto">
        Create a new wallet or import an existing one to start managing your assets securely.
      </p>
    </div>

    <!-- Content -->
    <div class="flex-1 flex flex-col">
      <!-- Step 1: Start -->
      <div v-if="currentStep === 'start'" class="flex flex-col gap-3 w-full">
        <!-- Create Wallet Card -->
        <button
          @click="handleGenerateSecret"
          class="flex items-center gap-3 w-full p-4 bg-bg-card border border-primary/30 rounded-xl cursor-pointer transition-all duration-200 text-left hover:border-primary hover:bg-bg-card-hover active:scale-[0.99]"
        >
          <span class="w-12 h-12 rounded-full bg-primary text-bg-primary flex items-center justify-center shrink-0 text-2xl font-bold">+</span>
          <span class="flex-1 flex flex-col gap-0.5">
            <span class="text-text-primary font-semibold">Create New Wallet</span>
            <span class="text-text-muted text-xs">Generate new recovery phrase</span>
          </span>
          <span class="text-text-muted text-2xl font-light">›</span>
        </button>

        <!-- Import Wallet Card -->
        <button
          @click="handleImportMnemonic"
          class="flex items-center gap-3 w-full p-4 bg-bg-card border border-border-default rounded-xl cursor-pointer transition-all duration-200 text-left hover:border-border-hover hover:bg-bg-card-hover active:scale-[0.99]"
        >
          <span class="w-12 h-12 rounded-full bg-bg-elevated border border-border-default text-text-secondary flex items-center justify-center shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </span>
          <span class="flex-1 flex flex-col gap-0.5">
            <span class="text-text-primary font-semibold">Import Existing Wallet</span>
            <span class="text-text-muted text-xs">Use recovery phrase or key</span>
          </span>
          <span class="text-text-muted text-2xl font-light">›</span>
        </button>

        <p v-if="importError" class="text-error text-sm text-center">{{ importError }}</p>

        <!-- Security Badge -->
        <div class="flex items-center justify-center gap-2 mt-6 text-primary text-xs tracking-wider">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="stroke-primary">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <span>END-TO-END ENCRYPTED</span>
        </div>
      </div>

      <!-- Step 2: Show Mnemonic -->
      <div v-else-if="currentStep === 'mnemonic'" class="flex flex-col gap-3 w-full">
        <!-- Warning -->
        <div class="bg-warning-muted border border-warning rounded-lg p-4 text-center">
          <strong class="text-warning">Save your recovery phrase</strong>
          <p class="mt-2 text-sm text-text-secondary">Store it securely. Anyone with this phrase can access your wallet.</p>
        </div>

        <!-- Mnemonic Grid -->
        <div class="grid grid-cols-3 gap-2 bg-bg-card border border-border-default p-4 rounded-lg">
          <div
            v-for="(word, index) in mnemonic.split(' ')"
            :key="index"
            class="flex items-center gap-2 font-mono text-sm"
          >
            <span class="text-text-muted text-xs min-w-[18px]">{{ index + 1 }}</span>
            <span class="text-text-primary">{{ word }}</span>
          </div>
        </div>

        <!-- Buttons -->
        <div class="flex gap-3 mt-4">
          <button @click="handleBack" class="btn-secondary flex-1">Back</button>
          <button @click="handleContinueToPin" class="btn-primary flex-[2]">I saved it</button>
        </div>
      </div>

      <!-- Step 3: Create PIN -->
      <div v-else-if="currentStep === 'pin-create'" class="flex flex-col gap-3 w-full">
        <PinInput
          ref="pinInputRef"
          mode="create"
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinCreate"
        />

        <div class="flex gap-3 mt-4">
          <button @click="handleBack" class="btn-secondary flex-1" :disabled="isLoading">Back</button>
        </div>
      </div>

      <!-- Step 4: Confirm PIN -->
      <div v-else-if="currentStep === 'pin-confirm'" class="flex flex-col gap-3 w-full">
        <PinInput
          ref="pinInputRef"
          mode="confirm"
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinConfirm"
        />

        <div class="flex gap-3 mt-4">
          <button @click="handleBack" class="btn-secondary flex-1" :disabled="isLoading">Back</button>
        </div>

        <p v-if="isLoading" class="text-text-muted text-sm text-center">Creating wallet...</p>
      </div>
    </div>
  </section>
</template>
