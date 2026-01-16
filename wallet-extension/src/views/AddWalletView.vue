<script setup lang="ts">
import { ref, nextTick, computed } from "vue";
import { randomSeedPhrase } from "@stacks/wallet-sdk";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import ImportMnemonicModal from "@/components/ImportMnemonicModal.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { Button } from "@/components/ui";
import { encryptWithPIN, isValidPIN } from "@/utils/security";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import { getWalletCount } from "@/utils/wallets";

const router = useRouter();

// Dynamic header title based on step
const headerTitle = computed(() => {
  switch (currentStep.value) {
    case "start": return "Add Wallet";
    case "mnemonic": return "Recovery Phrase";
    case "name": return "Name Wallet";
    case "pin-create": return "Create PIN";
    case "pin-confirm": return "Confirm PIN";
    default: return "Add Wallet";
  }
});

// Show back button only on steps after start
const showStepBack = computed(() => currentStep.value !== "start");

type Step = "start" | "mnemonic" | "name" | "pin-create" | "pin-confirm";
const currentStep = ref<Step>("start");

const mnemonic = ref("");
const walletName = ref("");
const pin = ref("");
const pinError = ref("");
const isLoading = ref(false);
const importError = ref("");
const showImportModal = ref(false);

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

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

function handleContinueToName() {
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
    case "name":
      currentStep.value = "mnemonic";
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

      <!-- Step 2: Show Mnemonic -->
      <div v-else-if="currentStep === 'mnemonic'" class="step-container" data-roi="add-wallet-mnemonic">
        <!-- V53: Warning box using tokens -->
        <div class="mnemonic-warning">
          <div class="warning-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <div class="warning-text">
            <strong>Save your recovery phrase</strong>
            <p>Anyone with this phrase can access your wallet.</p>
          </div>
        </div>

        <!-- V53: Mnemonic grid - V43 card pattern -->
        <div class="mnemonic-display" data-roi="add-wallet-mnemonic-grid">
          <div
            v-for="(word, index) in mnemonic.split(' ')"
            :key="index"
            class="mnemonic-word"
          >
            <span class="word-number">{{ index + 1 }}</span>
            <span class="word-text">{{ word }}</span>
          </div>
        </div>

        <div class="button-group" data-roi="add-wallet-mnemonic-cta">
          <Button variant="secondary" @click="handleStepBack">Back</Button>
          <Button variant="primary" @click="handleContinueToName">
            I saved it
          </Button>
        </div>
      </div>

      <!-- Step 3: Name wallet -->
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

      <!-- Step 4: Create PIN (V47: hide-label - subtitle provides context) -->
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

      <!-- Step 5: Confirm PIN (V47: hide-label - subtitle provides context) -->
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
.page-content {
  flex: 1;
  padding: var(--space-md) var(--space-lg);
  overflow-y: auto;
}

.step-container {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
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

/* V53: Warning box - flex layout with icon */
.mnemonic-warning {
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
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
}

/* V53: Mnemonic display - V43 card pattern */
.mnemonic-display {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 6px;
  padding: var(--space-md);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: var(--radius-card);
}

/* V53: Word row - premium hierarchy */
.mnemonic-word {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: 6px var(--space-sm);
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  min-width: 0; /* V53: Prevent overflow */
}

.mnemonic-word:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* V53: Index - muted numeric badge */
.word-number {
  font-size: 10px;
  font-family: var(--font-mono);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  min-width: 16px;
  text-align: right;
  flex-shrink: 0;
}

/* V53: Word text - premium mono */
.word-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
  overflow: hidden;
  text-overflow: ellipsis;
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
