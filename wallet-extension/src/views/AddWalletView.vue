<script setup lang="ts">
/**
 * AddWalletView - V53.2 Unified Recovery Phrase Flow
 *
 * Add wallet flow from Settings. Uses shared components:
 * - RecoveryPhraseDisplay: Mnemonic grid with reveal/hide, copy
 * - VerifyPhraseStep: 2-word verification
 *
 * Flow: start → mnemonic → verify → name → pin-create → pin-confirm → done
 */
import { ref, nextTick, computed } from "vue";
import { randomSeedPhrase } from "@stacks/wallet-sdk";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import ImportMnemonicModal from "@/components/ImportMnemonicModal.vue";
import RecoveryPhraseDisplay from "@/components/RecoveryPhraseDisplay.vue";
import VerifyPhraseStep from "@/components/VerifyPhraseStep.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { Button } from "@/components/ui";
import { encryptWithPIN, isValidPIN } from "@/utils/security";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import { getWalletCount } from "@/utils/wallets";

const router = useRouter();

// V53.2: Steps now include 'verify' before 'name'
type Step = "start" | "mnemonic" | "verify" | "name" | "pin-create" | "pin-confirm";
const currentStep = ref<Step>("start");

// Dynamic header title based on step
const headerTitle = computed(() => {
  switch (currentStep.value) {
    case "start": return "Add Wallet";
    case "mnemonic": return "Recovery Phrase";
    case "verify": return "Verify Phrase";
    case "name": return "Name Wallet";
    case "pin-create": return "Create PIN";
    case "pin-confirm": return "Confirm PIN";
    default: return "Add Wallet";
  }
});

// Show back button only on steps after start
const showStepBack = computed(() => currentStep.value !== "start");

const mnemonic = ref("");
const walletName = ref("");
const pin = ref("");
const pinError = ref("");
const isLoading = ref(false);
const importError = ref("");
const showImportModal = ref(false);

// V53.2: Verification state
const verifyWord1Index = ref(0);
const verifyWord2Index = ref(0);

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

// V53.2: Generate random word indices for verification
function generateVerifyIndices() {
  const words = mnemonic.value.split(" ");
  const wordCount = words.length;

  const idx1 = Math.floor(Math.random() * wordCount);
  let idx2 = Math.floor(Math.random() * wordCount);
  while (idx2 === idx1) {
    idx2 = Math.floor(Math.random() * wordCount);
  }

  const [first, second] = [idx1, idx2].sort((a, b) => a - b);
  verifyWord1Index.value = first;
  verifyWord2Index.value = second;
}

function handleBack() {
  router.push({ path: "/usermenu" });
}

function handleGenerateSecret() {
  const seedPhrase = randomSeedPhrase();
  secureLog("Mnemonic generated for new wallet");
  mnemonic.value = seedPhrase;
  currentStep.value = "mnemonic";
}

function handleImportMnemonic() {
  importError.value = "";
  showImportModal.value = true;
}

function handleImportConfirm(seedPhrase: string) {
  showImportModal.value = false;
  secureLog("Mnemonic imported for new wallet");
  mnemonic.value = seedPhrase;
  currentStep.value = "mnemonic";
}

// V53.2: Continue from mnemonic to verify step
function handleContinueToVerify() {
  generateVerifyIndices();
  currentStep.value = "verify";
}

// V53.2: Handle verified - proceed to name step
function handleVerified() {
  const walletNumber = getWalletCount() + 1;
  walletName.value = `Wallet ${walletNumber}`;
  currentStep.value = "name";
}

function handleContinueToPin() {
  if (!walletName.value.trim()) {
    walletName.value = `Wallet ${getWalletCount() + 1}`;
  }
  currentStep.value = "pin-create";
  nextTick(() => {
    pinInputRef.value?.focus();
  });
}

function handlePinCreate(enteredPin: string) {
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
}

async function handlePinConfirm(enteredPin: string) {
  if (enteredPin !== pin.value) {
    pinError.value = "PINs do not match";
    return;
  }

  pinError.value = "";
  isLoading.value = true;

  try {
    const encryptedData = await encryptWithPIN(mnemonic.value, pin.value);

    // Save as new wallet with name
    await sessionManager.saveEncryptedWalletAsync(encryptedData, walletName.value.trim());

    // Unlock session with new wallet
    await sessionManager.unlock(pin.value);

    secureLog("New wallet created and encrypted", { name: walletName.value });

    // Clear sensitive data
    mnemonic.value = "";
    pin.value = "";
    walletName.value = "";

    router.push({ path: "/user" });
  } catch (error) {
    pinError.value = "Failed to create wallet";
    secureLog("Wallet creation failed", error);
  } finally {
    isLoading.value = false;
  }
}

function handleStepBack() {
  pinError.value = "";
  importError.value = "";

  switch (currentStep.value) {
    case "mnemonic":
      mnemonic.value = "";
      currentStep.value = "start";
      break;
    case "verify":
      currentStep.value = "mnemonic";
      break;
    case "name":
      currentStep.value = "verify";
      break;
    case "pin-create":
      pin.value = "";
      currentStep.value = "name";
      break;
    case "pin-confirm":
      currentStep.value = "pin-create";
      nextTick(() => {
        pinInputRef.value?.clear();
        pinInputRef.value?.focus();
      });
      break;
  }
}
</script>

<template>
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        :title="headerTitle"
        left="back"
        @left-click="showStepBack ? handleStepBack() : handleBack()"
      />
    </template>

    <div class="page-content" data-roi="add-wallet-content">
      <!-- Step 1: Choose action -->
      <div v-if="currentStep === 'start'" class="step-container" data-roi="add-wallet-start">
        <p class="subtitle">Create a new wallet or import an existing one</p>

        <Button variant="primary" full-width data-roi="add-wallet-create-cta" @click="handleGenerateSecret">
          Create New Wallet
        </Button>
        <Button variant="secondary" full-width data-roi="add-wallet-import-cta" @click="handleImportMnemonic">
          Import Existing Wallet
        </Button>
        <!-- V53: Error slot with reserved height -->
        <div class="error-slot" aria-live="polite">
          <p v-if="importError" class="error-text">{{ importError }}</p>
        </div>
      </div>

      <!-- V54.2: Step 2: Show Mnemonic (header back handles navigation) -->
      <div v-else-if="currentStep === 'mnemonic'" class="step-container" data-roi="add-wallet-mnemonic">
        <RecoveryPhraseDisplay
          :mnemonic="mnemonic"
          @continue="handleContinueToVerify"
        />
      </div>

      <!-- V54.3: Step 3: Verify Phrase (header back handles navigation) -->
      <div v-else-if="currentStep === 'verify'" class="step-container" data-roi="add-wallet-verify">
        <VerifyPhraseStep
          :mnemonic="mnemonic"
          :word1-index="verifyWord1Index"
          :word2-index="verifyWord2Index"
          @verified="handleVerified"
        />
      </div>

      <!-- Step 4: Name wallet -->
      <div v-else-if="currentStep === 'name'" class="step-container">
        <label class="input-label">Wallet name (optional)</label>
        <input
          v-model="walletName"
          type="text"
          class="name-input"
          placeholder="My Wallet"
          maxlength="30"
        />

        <div class="button-group">
          <Button variant="secondary" @click="handleStepBack">Back</Button>
          <Button variant="primary" @click="handleContinueToPin">
            Continue
          </Button>
        </div>
      </div>

      <!-- Step 5: Create PIN -->
      <div v-else-if="currentStep === 'pin-create'" class="step-container">
        <p class="subtitle">Create a 6-digit PIN</p>
        <PinInput
          ref="pinInputRef"
          mode="create"
          hide-label
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinCreate"
        />

        <div class="button-group">
          <Button variant="secondary" :disabled="isLoading" @click="handleStepBack">
            Back
          </Button>
        </div>
      </div>

      <!-- Step 6: Confirm PIN -->
      <div v-else-if="currentStep === 'pin-confirm'" class="step-container">
        <p class="subtitle">Confirm your PIN</p>
        <PinInput
          ref="pinInputRef"
          mode="confirm"
          hide-label
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinConfirm"
        />

        <div class="button-group">
          <Button variant="secondary" :disabled="isLoading" @click="handleStepBack">
            Back
          </Button>
        </div>

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
/* V53.2: Same padding as StartView for visual parity */
.page-content {
  flex: 1;
  padding: var(--space-lg);
  overflow-y: auto;
}

.step-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-height: 100%;
}

.subtitle {
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
  font-size: var(--font-size-sm);
}

.button-group {
  display: flex;
  gap: var(--space-md);
  margin-top: var(--space-lg);
}

.button-group :deep(.btn--secondary) {
  flex: 1;
}

.button-group :deep(.btn--primary) {
  flex: 2;
}

/* V53: Error slot - reserved height for no layout shift */
.error-slot {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

.input-label {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.name-input {
  width: 100%;
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  box-sizing: border-box;
  height: auto;
}

.name-input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}
</style>
