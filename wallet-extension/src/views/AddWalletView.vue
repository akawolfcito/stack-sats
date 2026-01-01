<script setup lang="ts">
import { ref, nextTick } from "vue";
import { randomSeedPhrase } from "@stacks/wallet-sdk";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import { encryptWithPIN, isValidPIN } from "@/utils/security";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import { getWalletCount } from "@/utils/wallets";

const router = useRouter();

type Step = "start" | "mnemonic" | "name" | "pin-create" | "pin-confirm";
const currentStep = ref<Step>("start");

const mnemonic = ref("");
const walletName = ref("");
const pin = ref("");
const pinError = ref("");
const isLoading = ref(false);
const importError = ref("");

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
  const seedPhrase = prompt("Enter your 24-word mnemonic seed phrase");

  if (!seedPhrase) return;

  const trimmed = seedPhrase.trim().toLowerCase();
  const words = trimmed.split(/\s+/);

  if (words.length !== 24 && words.length !== 12) {
    importError.value = "Mnemonic must be 12 or 24 words";
    return;
  }

  const isValidFormat = words.every((word) => /^[a-z]+$/.test(word));
  if (!isValidFormat) {
    importError.value = "Invalid mnemonic format";
    return;
  }

  secureLog("Mnemonic imported for new wallet");
  mnemonic.value = trimmed;
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
    sessionManager.saveEncryptedWallet(encryptedData, walletName.value.trim());

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
  <section class="add-wallet-page">
    <div class="page-header">
      <button class="back-btn" @click="handleBack">
        &larr; Cancelar
      </button>
      <h2>Agregar Wallet</h2>
    </div>

    <div class="page-content">
      <!-- Step 1: Choose action -->
      <div v-if="currentStep === 'start'" class="step-container">
        <p class="subtitle">Crea una nueva wallet o importa una existente</p>

        <button @click="handleGenerateSecret" class="btn-primary">
          Crear Nueva Wallet
        </button>
        <button @click="handleImportMnemonic" class="btn-secondary">
          Importar Wallet Existente
        </button>
        <p v-if="importError" class="error-text">{{ importError }}</p>
      </div>

      <!-- Step 2: Show Mnemonic -->
      <div v-else-if="currentStep === 'mnemonic'" class="step-container">
        <div class="mnemonic-warning">
          <strong>Guarda tu frase de recuperaci&oacute;n</strong>
          <p>Cualquiera con esta frase puede acceder a tu wallet.</p>
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
          <button @click="handleStepBack" class="btn-secondary">Atr&aacute;s</button>
          <button @click="handleContinueToName" class="btn-primary">
            La guard&eacute;
          </button>
        </div>
      </div>

      <!-- Step 3: Name wallet -->
      <div v-else-if="currentStep === 'name'" class="step-container">
        <label class="input-label">Nombre de la wallet (opcional)</label>
        <input
          v-model="walletName"
          type="text"
          class="name-input"
          placeholder="Mi Wallet"
          maxlength="30"
        />

        <div class="button-group">
          <button @click="handleStepBack" class="btn-secondary">Atr&aacute;s</button>
          <button @click="handleContinueToPin" class="btn-primary">
            Continuar
          </button>
        </div>
      </div>

      <!-- Step 4: Create PIN -->
      <div v-else-if="currentStep === 'pin-create'" class="step-container">
        <p class="subtitle">Crea un PIN de 6 d&iacute;gitos</p>
        <PinInput
          ref="pinInputRef"
          mode="create"
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinCreate"
        />

        <div class="button-group">
          <button @click="handleStepBack" class="btn-secondary" :disabled="isLoading">
            Atr&aacute;s
          </button>
        </div>
      </div>

      <!-- Step 5: Confirm PIN -->
      <div v-else-if="currentStep === 'pin-confirm'" class="step-container">
        <p class="subtitle">Confirma tu PIN</p>
        <PinInput
          ref="pinInputRef"
          mode="confirm"
          :error="pinError"
          :disabled="isLoading"
          @complete="handlePinConfirm"
        />

        <div class="button-group">
          <button @click="handleStepBack" class="btn-secondary" :disabled="isLoading">
            Atr&aacute;s
          </button>
        </div>

        <p v-if="isLoading" class="loading-text">Creando wallet...</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.add-wallet-page {
  padding: 1rem;
  max-width: 360px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.page-header h2 {
  margin: 0;
  flex: 1;
}

.back-btn {
  background: none;
  border: none;
  color: #5546ff;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.5rem;
}

.page-content {
  flex: 1;
}

.step-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.subtitle {
  color: #888;
  text-align: center;
  margin: 0;
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

.input-label {
  color: #888;
  font-size: 0.9rem;
}

.name-input {
  width: 100%;
  padding: 12px;
  border: 1px solid #444;
  border-radius: 8px;
  background: #1a1a1a;
  color: #fff;
  font-size: 1rem;
  box-sizing: border-box;
}

.name-input:focus {
  outline: none;
  border-color: #5546ff;
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
