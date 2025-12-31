<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";

const router = useRouter();

const showDeleteConfirm = ref(false);
const confirmText = ref("");
const showPinInput = ref(false);
const deleteError = ref("");

const CONFIRM_WORD = "ELIMINAR";

function handleUserHome() {
  router.push({ path: "/user" });
}

function initiateDelete() {
  showDeleteConfirm.value = true;
  confirmText.value = "";
  deleteError.value = "";
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  showPinInput.value = false;
  confirmText.value = "";
  deleteError.value = "";
}

function confirmDeleteText() {
  if (confirmText.value.toUpperCase() !== CONFIRM_WORD) {
    deleteError.value = `Por favor escribe "${CONFIRM_WORD}" para confirmar`;
    return;
  }
  showPinInput.value = true;
  deleteError.value = "";
}

async function handlePinComplete(pin: string) {
  const mnemonic = await sessionManager.unlock(pin);

  if (!mnemonic) {
    deleteError.value = "PIN incorrecto. Intentos restantes: " + (3 - sessionManager.failedAttempts);
    return;
  }

  // Securely delete wallet data
  secureWipeAndDelete();
}

function secureWipeAndDelete() {
  secureLog("Iniciando eliminación segura de wallet");

  // Overwrite sensitive data before deletion
  const randomData = crypto.getRandomValues(new Uint8Array(256));
  const overwriteString = Array.from(randomData)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Overwrite localStorage entries before removing
  localStorage.setItem("encryptedWallet", overwriteString);
  localStorage.setItem("mnemonic", overwriteString);

  // Now remove all wallet data
  localStorage.removeItem("encryptedWallet");
  localStorage.removeItem("mnemonic");
  localStorage.removeItem("walletSalt");

  // Lock session
  sessionManager.lock();

  secureLog("Wallet eliminada de forma segura");
  router.push({ path: "/" });
}

function handlePinCancel() {
  showPinInput.value = false;
  deleteError.value = "";
}
</script>

<template>
  <section class="menu-page">
    <div class="menu-header">
      <button class="back-btn" @click="handleUserHome">
        ← Volver
      </button>
      <h2>Configuración</h2>
    </div>

    <div v-if="!showDeleteConfirm" class="menu-options">
      <button class="delete-btn" @click="initiateDelete">
        Eliminar Wallet
      </button>
    </div>

    <!-- Delete confirmation flow -->
    <div v-else class="delete-confirmation">
      <div v-if="!showPinInput" class="confirm-text-step">
        <div class="warning-box">
          <p class="warning-title">⚠️ Advertencia</p>
          <p>
            Esta acción eliminará permanentemente tu wallet de esta extensión.
            Asegúrate de tener tu frase de recuperación guardada.
          </p>
        </div>

        <label class="confirm-label">
          Escribe <strong>{{ CONFIRM_WORD }}</strong> para confirmar:
        </label>
        <input
          v-model="confirmText"
          type="text"
          class="confirm-input"
          :placeholder="CONFIRM_WORD"
          autocomplete="off"
        />

        <p v-if="deleteError" class="error-text">{{ deleteError }}</p>

        <div class="button-group">
          <button class="cancel-btn" @click="cancelDelete">Cancelar</button>
          <button class="confirm-btn" @click="confirmDeleteText">
            Continuar
          </button>
        </div>
      </div>

      <div v-else class="pin-step">
        <p class="pin-prompt">Ingresa tu PIN para confirmar la eliminación:</p>
        <PinInput
          mode="unlock"
          @complete="handlePinComplete"
          @cancel="handlePinCancel"
        />
        <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
      </div>
    </div>
  </section>
</template>

<style scoped>
.menu-page {
  padding: 1rem;
  max-width: 360px;
  margin: 0 auto;
}

.menu-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.menu-header h2 {
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

.menu-options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.delete-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
}

.delete-btn:hover {
  background: #c82333;
}

.delete-confirmation {
  background: #1a1a2e;
  padding: 1.5rem;
  border-radius: 12px;
}

.warning-box {
  background: rgba(220, 53, 69, 0.1);
  border: 1px solid #dc3545;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1.5rem;
}

.warning-title {
  color: #dc3545;
  font-weight: bold;
  margin: 0 0 0.5rem 0;
}

.warning-box p {
  margin: 0;
  color: #ccc;
  font-size: 0.9rem;
}

.confirm-label {
  display: block;
  margin-bottom: 0.5rem;
  color: #fff;
}

.confirm-input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #333;
  border-radius: 8px;
  background: #0f0f1a;
  color: #fff;
  font-size: 1rem;
  margin-bottom: 1rem;
  box-sizing: border-box;
}

.button-group {
  display: flex;
  gap: 1rem;
}

.cancel-btn {
  flex: 1;
  padding: 0.75rem;
  background: #333;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.confirm-btn {
  flex: 1;
  padding: 0.75rem;
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}

.error-text {
  color: #dc3545;
  font-size: 0.85rem;
  margin: 0.5rem 0;
}

.pin-prompt {
  color: #fff;
  margin-bottom: 1rem;
  text-align: center;
}

.pin-step {
  text-align: center;
}
</style>
