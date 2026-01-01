<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import {
  getWallets,
  getActiveWalletId,
  getActiveWallet,
  deleteWallet as deleteWalletEntry,
  importWallet,
  walletExists,
  type WalletEntry,
} from "@/utils/wallets";
import {
  createBackup,
  downloadBackup,
  generateBackupFilename,
  parseBackupFile,
} from "@/utils/backup";

const router = useRouter();

// Wallet list state
const wallets = ref<WalletEntry[]>([]);
const activeWalletId = ref<string | null>(null);

const showDeleteConfirm = ref(false);
const confirmText = ref("");
const showPinInput = ref(false);
const deleteError = ref("");
const walletToDelete = ref<string | null>(null);

const CONFIRM_WORD = "ELIMINAR";

// Backup state
const backupMessage = ref<{ type: "success" | "error"; text: string } | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const showImportConfirm = ref(false);
const pendingImportWallet = ref<WalletEntry | null>(null);
const showBackupPinInput = ref(false);
const backupPinError = ref("");

onMounted(() => {
  loadWallets();
});

function loadWallets() {
  wallets.value = getWallets();
  activeWalletId.value = getActiveWalletId();
}

function handleUserHome() {
  router.push({ path: "/user" });
}

function switchWallet(walletId: string) {
  if (walletId === activeWalletId.value) return;
  sessionManager.switchWallet(walletId);
  router.push({ path: "/unlock" });
}

function handleAddWallet() {
  // Navigate to start view to create/import new wallet
  // The StartView should detect existing wallets and offer to add, not replace
  router.push({ path: "/add-wallet" });
}

function initiateDelete(walletId?: string) {
  walletToDelete.value = walletId || activeWalletId.value;
  showDeleteConfirm.value = true;
  confirmText.value = "";
  deleteError.value = "";
}

function cancelDelete() {
  showDeleteConfirm.value = false;
  showPinInput.value = false;
  confirmText.value = "";
  deleteError.value = "";
  walletToDelete.value = null;
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

  if (walletToDelete.value) {
    // Delete specific wallet
    const isActive = walletToDelete.value === activeWalletId.value;
    deleteWalletEntry(walletToDelete.value);

    // Refresh wallet list
    loadWallets();

    if (wallets.value.length === 0) {
      // No wallets left, go to start
      sessionManager.lock();
      router.push({ path: "/" });
    } else if (isActive) {
      // Deleted active wallet, need to unlock another
      sessionManager.lock();
      router.push({ path: "/unlock" });
    } else {
      // Deleted inactive wallet, stay on menu
      cancelDelete();
    }
  } else {
    // Delete all wallets (legacy behavior)
    sessionManager.deleteWallet();
    router.push({ path: "/" });
  }

  secureLog("Wallet eliminada de forma segura");
}

function handlePinCancel() {
  showPinInput.value = false;
  deleteError.value = "";
}

// Backup functions
function handleExportBackup() {
  backupMessage.value = null;
  backupPinError.value = "";

  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    backupMessage.value = { type: "error", text: "No hay wallet activa para exportar" };
    return;
  }

  // Show PIN input for verification
  showBackupPinInput.value = true;
}

async function handleBackupPinComplete(pin: string) {
  const mnemonic = await sessionManager.unlock(pin);

  if (!mnemonic) {
    backupPinError.value = "PIN incorrecto. Intentos restantes: " + (3 - sessionManager.failedAttempts);
    return;
  }

  // PIN verified, proceed with backup
  const activeWallet = getActiveWallet();
  if (!activeWallet) {
    backupMessage.value = { type: "error", text: "No hay wallet activa para exportar" };
    showBackupPinInput.value = false;
    return;
  }

  try {
    const backup = createBackup(activeWallet);
    const filename = generateBackupFilename(activeWallet.name);
    downloadBackup(backup, filename);
    backupMessage.value = { type: "success", text: "Backup descargado correctamente" };
    secureLog("Backup exported", { walletId: activeWallet.id });
  } catch (error) {
    backupMessage.value = { type: "error", text: "Error al crear el backup" };
    secureLog("Backup export failed", { error: String(error) });
  }

  showBackupPinInput.value = false;
  backupPinError.value = "";

  // Clear message after 3 seconds
  setTimeout(() => {
    backupMessage.value = null;
  }, 3000);
}

function cancelBackupPin() {
  showBackupPinInput.value = false;
  backupPinError.value = "";
}

function triggerFileInput() {
  backupMessage.value = null;
  fileInputRef.value?.click();
}

async function handleFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];

  if (!file) return;

  // Reset input for future selections
  input.value = "";

  const backup = await parseBackupFile(file);
  if (!backup) {
    backupMessage.value = { type: "error", text: "Archivo de backup inválido" };
    return;
  }

  // Check if wallet already exists
  if (walletExists(backup.wallet.id)) {
    pendingImportWallet.value = backup.wallet;
    showImportConfirm.value = true;
    return;
  }

  // Import directly
  completeImport(backup.wallet, false);
}

function completeImport(wallet: WalletEntry, replace: boolean) {
  const result = importWallet(wallet, replace);

  if (result) {
    backupMessage.value = {
      type: "success",
      text: result === "replaced" ? "Wallet reemplazada correctamente" : "Wallet importada correctamente",
    };
    loadWallets();
    secureLog("Wallet imported from backup", { walletId: wallet.id, result });
  } else {
    backupMessage.value = { type: "error", text: "Error al importar la wallet" };
  }

  showImportConfirm.value = false;
  pendingImportWallet.value = null;

  setTimeout(() => {
    backupMessage.value = null;
  }, 3000);
}

function cancelImport() {
  showImportConfirm.value = false;
  pendingImportWallet.value = null;
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
      <!-- Wallet List -->
      <div class="wallets-section">
        <div class="section-header">
          <h3>Tus Wallets</h3>
          <button class="add-wallet-btn" @click="handleAddWallet">+ Agregar</button>
        </div>

        <div class="wallet-list">
          <div
            v-for="wallet in wallets"
            :key="wallet.id"
            class="wallet-item"
            :class="{ active: wallet.id === activeWalletId }"
          >
            <div class="wallet-info" @click="switchWallet(wallet.id)">
              <span class="wallet-name">{{ wallet.name }}</span>
              <span v-if="wallet.id === activeWalletId" class="active-badge">Activa</span>
            </div>
            <button
              class="delete-wallet-btn"
              @click.stop="initiateDelete(wallet.id)"
              title="Eliminar wallet"
            >
              &times;
            </button>
          </div>
        </div>
      </div>

      <hr class="divider" />

      <!-- Backup Section -->
      <div class="backup-section">
        <div class="section-header">
          <h3>Respaldo</h3>
        </div>

        <div class="backup-buttons">
          <button class="backup-btn export" @click="handleExportBackup">
            Exportar Backup
          </button>
          <button class="backup-btn import" @click="triggerFileInput">
            Importar Backup
          </button>
        </div>

        <input
          ref="fileInputRef"
          type="file"
          accept=".json"
          style="display: none"
          @change="handleFileSelected"
        />

        <p v-if="backupMessage" class="backup-message" :class="backupMessage.type">
          {{ backupMessage.text }}
        </p>
      </div>

      <hr class="divider" />

      <!-- Danger Zone -->
      <div class="danger-zone">
        <small>Zona de peligro</small>
        <button class="delete-btn" @click="initiateDelete()">
          Eliminar Todas las Wallets
        </button>
      </div>
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

    <!-- Backup PIN Modal -->
    <div v-if="showBackupPinInput" class="import-confirm-overlay">
      <div class="import-confirm-modal backup-pin-modal">
        <h3>Verificar PIN</h3>
        <p>Ingresa tu PIN para exportar el backup:</p>
        <PinInput
          mode="unlock"
          @complete="handleBackupPinComplete"
          @cancel="cancelBackupPin"
        />
        <p v-if="backupPinError" class="error-text">{{ backupPinError }}</p>
        <button class="cancel-btn full-width" @click="cancelBackupPin">Cancelar</button>
      </div>
    </div>

    <!-- Import Confirmation Modal -->
    <div v-if="showImportConfirm" class="import-confirm-overlay">
      <div class="import-confirm-modal">
        <h3>Wallet ya existe</h3>
        <p>
          La wallet "<strong>{{ pendingImportWallet?.name }}</strong>" ya existe en tu extensión.
        </p>
        <p class="import-question">¿Deseas reemplazarla con el backup?</p>

        <div class="button-group">
          <button class="cancel-btn" @click="cancelImport">Cancelar</button>
          <button class="confirm-btn replace" @click="completeImport(pendingImportWallet!, true)">
            Reemplazar
          </button>
        </div>
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

/* Wallets Section */
.wallets-section {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.section-header h3 {
  margin: 0;
  font-size: 1rem;
  color: #fff;
}

.add-wallet-btn {
  background: #5546ff;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.85rem;
}

.add-wallet-btn:hover {
  background: #4438cc;
}

.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.wallet-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #0f0f1a;
  border-radius: 8px;
  border: 1px solid transparent;
  transition: all 0.2s;
}

.wallet-item:hover {
  border-color: #5546ff;
}

.wallet-item.active {
  border-color: #5546ff;
  background: rgba(85, 70, 255, 0.1);
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  flex: 1;
}

.wallet-name {
  color: #fff;
  font-weight: 500;
}

.active-badge {
  background: #5546ff;
  color: white;
  font-size: 0.7rem;
  padding: 2px 6px;
  border-radius: 4px;
}

.delete-wallet-btn {
  background: none;
  border: none;
  color: #666;
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 0.5rem;
  line-height: 1;
}

.delete-wallet-btn:hover {
  color: #dc3545;
}

.divider {
  border: none;
  border-top: 1px solid #333;
  margin: 1rem 0;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.danger-zone small {
  color: #888;
}

/* Backup Section */
.backup-section {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1rem;
}

.backup-buttons {
  display: flex;
  gap: 0.75rem;
}

.backup-btn {
  flex: 1;
  padding: 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.2s;
}

.backup-btn.export {
  background: transparent;
  border: 1px solid #5546ff;
  color: #5546ff;
}

.backup-btn.export:hover {
  background: rgba(85, 70, 255, 0.1);
}

.backup-btn.import {
  background: transparent;
  border: 1px solid #4ade80;
  color: #4ade80;
}

.backup-btn.import:hover {
  background: rgba(74, 222, 128, 0.1);
}

.backup-message {
  margin: 0.75rem 0 0 0;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.85rem;
  text-align: center;
}

.backup-message.success {
  background: rgba(74, 222, 128, 0.1);
  color: #4ade80;
}

.backup-message.error {
  background: rgba(220, 53, 69, 0.1);
  color: #dc3545;
}

/* Import Confirmation Modal */
.import-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 1rem;
}

.import-confirm-modal {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 320px;
  width: 100%;
}

.import-confirm-modal h3 {
  margin: 0 0 1rem 0;
  color: #fbbf24;
}

.import-confirm-modal p {
  margin: 0 0 0.75rem 0;
  color: #ccc;
  font-size: 0.9rem;
}

.import-question {
  color: #fff !important;
  font-weight: 500;
}

.confirm-btn.replace {
  background: #fbbf24;
  color: #000;
}

.confirm-btn.replace:hover {
  background: #f59e0b;
}

/* Backup PIN Modal */
.backup-pin-modal {
  text-align: center;
}

.backup-pin-modal h3 {
  color: #5546ff;
}

.backup-pin-modal p {
  margin-bottom: 1rem;
}

.full-width {
  width: 100%;
  margin-top: 1rem;
}
</style>
