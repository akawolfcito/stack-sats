<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import {
  getWalletsAsync,
  getActiveWalletIdAsync,
  getActiveWalletAsync,
  deleteWalletAsync,
  importWalletAsync,
  walletExistsAsync,
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

const CONFIRM_WORD = "DELETE";

// Backup state
const backupMessage = ref<{ type: "success" | "error"; text: string } | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const showImportConfirm = ref(false);
const pendingImportWallet = ref<WalletEntry | null>(null);
const showBackupPinInput = ref(false);
const backupPinError = ref("");

onMounted(async () => {
  await loadWallets();
});

async function loadWallets() {
  wallets.value = await getWalletsAsync();
  activeWalletId.value = await getActiveWalletIdAsync();
}

function handleUserHome() {
  router.push({ path: "/user" });
}

async function switchWallet(walletId: string) {
  if (walletId === activeWalletId.value) return;
  await sessionManager.switchWalletAsync(walletId);
  router.push({ path: "/unlock" });
}

function handleAddWallet() {
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
    deleteError.value = `Please type "${CONFIRM_WORD}" to confirm`;
    return;
  }
  showPinInput.value = true;
  deleteError.value = "";
}

async function handlePinComplete(pin: string) {
  const mnemonic = await sessionManager.unlock(pin);

  if (!mnemonic) {
    deleteError.value = "Incorrect PIN. Attempts remaining: " + (3 - sessionManager.failedAttempts);
    return;
  }

  secureWipeAndDelete();
}

async function secureWipeAndDelete() {
  secureLog("Starting secure wallet deletion");

  if (walletToDelete.value) {
    const isActive = walletToDelete.value === activeWalletId.value;
    await deleteWalletAsync(walletToDelete.value);

    await loadWallets();

    if (wallets.value.length === 0) {
      sessionManager.lock();
      router.push({ path: "/" });
    } else if (isActive) {
      sessionManager.lock();
      router.push({ path: "/unlock" });
    } else {
      cancelDelete();
    }
  } else {
    await sessionManager.deleteWalletAsync();
    router.push({ path: "/" });
  }

  secureLog("Wallet deleted securely");
}

function handlePinCancel() {
  showPinInput.value = false;
  deleteError.value = "";
}

// Backup functions
async function handleExportBackup() {
  backupMessage.value = null;
  backupPinError.value = "";

  const activeWallet = await getActiveWalletAsync();
  if (!activeWallet) {
    backupMessage.value = { type: "error", text: "No active wallet to export" };
    return;
  }

  showBackupPinInput.value = true;
}

async function handleBackupPinComplete(pin: string) {
  const mnemonic = await sessionManager.unlock(pin);

  if (!mnemonic) {
    backupPinError.value = "Incorrect PIN. Attempts remaining: " + (3 - sessionManager.failedAttempts);
    return;
  }

  const activeWallet = await getActiveWalletAsync();
  if (!activeWallet) {
    backupMessage.value = { type: "error", text: "No active wallet to export" };
    showBackupPinInput.value = false;
    return;
  }

  try {
    const backup = createBackup(activeWallet);
    const filename = generateBackupFilename(activeWallet.name);
    downloadBackup(backup, filename);
    backupMessage.value = { type: "success", text: "Backup downloaded successfully" };
    secureLog("Backup exported", { walletId: activeWallet.id });
  } catch (error) {
    backupMessage.value = { type: "error", text: "Failed to create backup" };
    secureLog("Backup export failed", { error: String(error) });
  }

  showBackupPinInput.value = false;
  backupPinError.value = "";

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

  input.value = "";

  const backup = await parseBackupFile(file);
  if (!backup) {
    backupMessage.value = { type: "error", text: "Invalid backup file" };
    return;
  }

  if (await walletExistsAsync(backup.wallet.id)) {
    pendingImportWallet.value = backup.wallet;
    showImportConfirm.value = true;
    return;
  }

  await completeImport(backup.wallet, false);
}

async function completeImport(wallet: WalletEntry, replace: boolean) {
  const result = await importWalletAsync(wallet, replace);

  if (result) {
    backupMessage.value = {
      type: "success",
      text: result === "replaced" ? "Wallet replaced successfully" : "Wallet imported successfully",
    };
    await loadWallets();
    secureLog("Wallet imported from backup", { walletId: wallet.id, result });
  } else {
    backupMessage.value = { type: "error", text: "Failed to import wallet" };
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
  <section class="settings-page">
    <!-- Ambient Glow -->
    <div class="ambient-glow"></div>

    <!-- Header -->
    <header class="page-header">
      <button class="back-btn" @click="handleUserHome">
        <span class="back-icon">←</span>
      </button>
      <h1>Settings</h1>
      <div class="header-spacer"></div>
    </header>

    <!-- Main Content -->
    <main v-if="!showDeleteConfirm" class="page-content">
      <!-- Your Wallets Section -->
      <section class="section">
        <h3 class="section-title">Your Wallets</h3>
        <div class="wallet-list">
          <div
            v-for="wallet in wallets"
            :key="wallet.id"
            class="wallet-item"
            :class="{ 'wallet-item--active': wallet.id === activeWalletId }"
            @click="switchWallet(wallet.id)"
          >
            <div class="wallet-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
              </svg>
            </div>
            <div class="wallet-info">
              <span class="wallet-name">{{ wallet.name }}</span>
              <span v-if="wallet.id === activeWalletId" class="active-badge">Active</span>
            </div>
            <button
              class="wallet-delete"
              @click.stop="initiateDelete(wallet.id)"
              title="Delete wallet"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
            <svg class="wallet-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </div>

          <!-- Add Wallet Button -->
          <button class="add-wallet-btn" @click="handleAddWallet">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="16"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
            Add Wallet
          </button>
        </div>
      </section>

      <!-- Security & Backup Section -->
      <section class="section">
        <h3 class="section-title">Security & Backup</h3>
        <div class="security-options">
          <button class="option-card" @click="handleExportBackup">
            <div class="option-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
              </svg>
            </div>
            <div class="option-content">
              <span class="option-title">Export Secret Key</span>
              <span class="option-subtitle">Download encrypted backup</span>
            </div>
            <svg class="option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <path d="M7 17L17 7M17 7H7M17 7V17"/>
            </svg>
          </button>

          <button class="option-card" @click="triggerFileInput">
            <div class="option-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </div>
            <div class="option-content">
              <span class="option-title">Import Wallet</span>
              <span class="option-subtitle">Restore from backup file</span>
            </div>
            <svg class="option-arrow" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <path d="M9 18l6-6-6-6"/>
            </svg>
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
      </section>

      <!-- Danger Zone -->
      <section class="danger-section">
        <div class="danger-card">
          <h3 class="danger-title">Danger Zone</h3>
          <p class="danger-text">
            Deleting your wallets will remove them from this device permanently.
            Make sure you have your secret keys backed up safely.
          </p>
          <button class="danger-btn" @click="initiateDelete()">
            Delete All Wallets
          </button>
        </div>
      </section>

      <!-- Version Footer -->
      <footer class="version-footer">
        DENVAULT V1.0.1
      </footer>
    </main>

    <!-- Delete Confirmation Flow -->
    <div v-else class="delete-flow">
      <div v-if="!showPinInput" class="confirm-step">
        <div class="warning-card">
          <div class="warning-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h3>Delete Wallet</h3>
          <p>
            This action will permanently delete your wallet from this extension.
            Make sure you have your recovery phrase saved.
          </p>
        </div>

        <div class="confirm-input-section">
          <label class="confirm-label">
            Type <strong>{{ CONFIRM_WORD }}</strong> to confirm:
          </label>
          <input
            v-model="confirmText"
            type="text"
            class="confirm-input"
            :placeholder="CONFIRM_WORD"
            autocomplete="off"
          />
        </div>

        <p v-if="deleteError" class="error-text">{{ deleteError }}</p>

        <div class="button-group">
          <button class="btn-secondary" @click="cancelDelete">Cancel</button>
          <button class="btn-danger" @click="confirmDeleteText">Continue</button>
        </div>
      </div>

      <div v-else class="pin-step">
        <p class="pin-prompt">Enter your PIN to confirm deletion:</p>
        <PinInput
          mode="unlock"
          @complete="handlePinComplete"
          @cancel="handlePinCancel"
        />
        <p v-if="deleteError" class="error-text">{{ deleteError }}</p>
      </div>
    </div>

    <!-- Backup PIN Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showBackupPinInput" class="modal-overlay" @click.self="cancelBackupPin">
          <div class="modal-card">
            <div class="modal-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            <h3>Verify PIN</h3>
            <p>Enter your PIN to export backup</p>
            <PinInput
              mode="unlock"
              @complete="handleBackupPinComplete"
              @cancel="cancelBackupPin"
            />
            <p v-if="backupPinError" class="error-text">{{ backupPinError }}</p>
            <button class="btn-secondary full-width" @click="cancelBackupPin">Cancel</button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Import Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showImportConfirm" class="modal-overlay" @click.self="cancelImport">
          <div class="modal-card">
            <div class="modal-icon modal-icon--warning">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <h3>Wallet Already Exists</h3>
            <p>
              The wallet "<strong>{{ pendingImportWallet?.name }}</strong>" already exists in your extension.
            </p>
            <p class="modal-question">Do you want to replace it with the backup?</p>
            <div class="button-group">
              <button class="btn-secondary" @click="cancelImport">Cancel</button>
              <button class="btn-warning" @click="completeImport(pendingImportWallet!, true)">
                Replace
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </section>
</template>

<style scoped>
/* Base Layout */
.settings-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--color-bg-primary);
  position: relative;
}

/* Ambient Glow */
.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 40%;
  background: var(--color-accent-primary);
  opacity: 0.05;
  filter: blur(100px);
  border-radius: 50%;
  pointer-events: none;
}

/* Header */
.page-header {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 48px 20px 16px;
  background: rgba(23, 24, 17, 0.95);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.page-header h1 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.back-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #282828;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: #333333;
}

.back-btn:active {
  transform: scale(0.95);
}

.back-icon {
  font-size: 20px;
  line-height: 1;
  color: #FFFFFF;
}

.header-spacer {
  width: 40px;
}

/* Main Content */
.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 32px;
  padding: 8px 16px 24px;
  overflow-y: auto;
}

/* Section Styles */
.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #9ca3af;
  margin: 0;
  padding-left: 8px;
}

/* Wallet List */
.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.wallet-item {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: #282828;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
}

.wallet-item:hover {
  background: #333333;
}

.wallet-item:active {
  transform: scale(0.99);
}

.wallet-item--active {
  border-color: var(--color-accent-primary);
  background: rgba(232, 248, 89, 0.05);
}

.wallet-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(232, 248, 89, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
  flex-shrink: 0;
}

.wallet-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.wallet-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.active-badge {
  display: inline-block;
  font-size: 10px;
  font-weight: 700;
  color: #0a0a0a;
  background: var(--color-accent-primary);
  padding: 2px 8px;
  border-radius: 4px;
  width: fit-content;
}

.wallet-delete {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: transparent;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.wallet-delete:hover {
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
}

.wallet-arrow {
  color: #6b7280;
  flex-shrink: 0;
}

/* Add Wallet Button */
.add-wallet-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 16px;
  border-radius: 9999px;
  border: 2px dashed #4b5563;
  background: transparent;
  color: #9ca3af;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  margin-top: 8px;
}

.add-wallet-btn:hover {
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.add-wallet-btn:active {
  background: rgba(255, 255, 255, 0.05);
}

/* Security Options */
.security-options {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 16px;
  width: 100%;
  padding: 16px;
  background: #282828;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.option-card:hover {
  background: #333333;
}

.option-card:active {
  background: #3a3a3a;
}

.option-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-primary);
  flex-shrink: 0;
}

.option-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.option-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.option-subtitle {
  font-size: 12px;
  color: #9ca3af;
}

.option-arrow {
  color: #6b7280;
  flex-shrink: 0;
}

/* Backup Message */
.backup-message {
  margin: 8px 0 0;
  padding: 12px 16px;
  border-radius: 12px;
  font-size: 14px;
  text-align: center;
}

.backup-message.success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}

.backup-message.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

/* Danger Section */
.danger-section {
  margin-top: auto;
  padding-top: 16px;
}

.danger-card {
  padding: 20px;
  border-radius: 16px;
  background: rgba(239, 68, 68, 0.05);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.danger-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-error);
  margin: 0 0 8px;
}

.danger-text {
  font-size: 12px;
  color: rgba(239, 68, 68, 0.7);
  line-height: 1.5;
  margin: 0 0 16px;
}

.danger-btn {
  width: 100%;
  height: 48px;
  border-radius: 9999px;
  background: var(--color-error);
  border: none;
  color: white;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.3);
  transition: all 0.2s ease;
}

.danger-btn:hover {
  background: #dc2626;
}

.danger-btn:active {
  transform: scale(0.98);
}

/* Version Footer */
.version-footer {
  text-align: center;
  font-size: 10px;
  font-weight: 500;
  color: #4b5563;
  letter-spacing: 0.15em;
  padding: 24px 0 16px;
}

/* Delete Flow */
.delete-flow {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px 16px;
}

.confirm-step {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.warning-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 24px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 20px;
}

.warning-icon {
  color: var(--color-error);
  margin-bottom: 16px;
}

.warning-card h3 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-error);
  margin: 0 0 12px;
}

.warning-card p {
  font-size: 14px;
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0;
}

.confirm-input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.confirm-label {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.confirm-label strong {
  color: var(--color-error);
}

.confirm-input {
  width: 100%;
  height: 56px;
  padding: 0 20px;
  background: #16180c;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  color: var(--color-text-primary);
  font-size: 16px;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  box-shadow:
    inset 2px 2px 5px rgba(0, 0, 0, 0.4),
    inset -1px -1px 1px rgba(255, 255, 255, 0.05);
}

.confirm-input:focus {
  outline: none;
  border-color: var(--color-error);
}

.confirm-input::placeholder {
  color: #4b5563;
  text-transform: uppercase;
}

.error-text {
  color: var(--color-error);
  font-size: 14px;
  text-align: center;
  margin: 0;
}

.button-group {
  display: flex;
  gap: 12px;
}

.btn-secondary {
  flex: 1;
  height: 56px;
  border-radius: 9999px;
  background: #282828;
  border: none;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: #333333;
}

.btn-danger {
  flex: 1;
  height: 56px;
  border-radius: 9999px;
  background: var(--color-error);
  border: none;
  color: white;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover {
  background: #dc2626;
}

.btn-warning {
  flex: 1;
  height: 56px;
  border-radius: 9999px;
  background: var(--color-warning);
  border: none;
  color: #0a0a0a;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-warning:hover {
  filter: brightness(1.1);
}

/* PIN Step */
.pin-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.pin-prompt {
  font-size: 16px;
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 24px;
}

.modal-card {
  width: 100%;
  max-width: 340px;
  background: #1a1c0d;
  border-radius: 24px;
  padding: 32px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 16px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.modal-icon {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(232, 248, 89, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
  margin-bottom: 8px;
}

.modal-icon--warning {
  background: rgba(251, 191, 36, 0.1);
  color: var(--color-warning);
}

.modal-card h3 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.modal-card p {
  font-size: 14px;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.modal-question {
  color: var(--color-text-primary) !important;
  font-weight: 500;
}

.full-width {
  width: 100%;
  margin-top: 8px;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-card,
.modal-leave-active .modal-card {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-card,
.modal-leave-to .modal-card {
  transform: scale(0.95);
}
</style>
