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

  // Securely delete wallet data
  secureWipeAndDelete();
}

async function secureWipeAndDelete() {
  secureLog("Starting secure wallet deletion");

  if (walletToDelete.value) {
    // Delete specific wallet
    const isActive = walletToDelete.value === activeWalletId.value;
    await deleteWalletAsync(walletToDelete.value);

    // Refresh wallet list
    await loadWallets();

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

  // Show PIN input for verification
  showBackupPinInput.value = true;
}

async function handleBackupPinComplete(pin: string) {
  const mnemonic = await sessionManager.unlock(pin);

  if (!mnemonic) {
    backupPinError.value = "Incorrect PIN. Attempts remaining: " + (3 - sessionManager.failedAttempts);
    return;
  }

  // PIN verified, proceed with backup
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
    backupMessage.value = { type: "error", text: "Invalid backup file" };
    return;
  }

  // Check if wallet already exists
  if (await walletExistsAsync(backup.wallet.id)) {
    pendingImportWallet.value = backup.wallet;
    showImportConfirm.value = true;
    return;
  }

  // Import directly
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
  <section class="menu-page">
    <div class="menu-header">
      <button class="back-btn" @click="handleUserHome">
        ← Back
      </button>
      <h2>Settings</h2>
    </div>

    <div v-if="!showDeleteConfirm" class="menu-options">
      <!-- Wallet List -->
      <div class="wallets-section">
        <div class="section-header">
          <h3>Your Wallets</h3>
          <button class="add-wallet-btn" @click="handleAddWallet">+ Add</button>
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
              <span v-if="wallet.id === activeWalletId" class="active-badge">Active</span>
            </div>
            <button
              class="delete-wallet-btn"
              @click.stop="initiateDelete(wallet.id)"
              title="Delete wallet"
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
          <h3>Backup</h3>
        </div>

        <div class="backup-buttons">
          <button class="backup-btn export" @click="handleExportBackup">
            Export Backup
          </button>
          <button class="backup-btn import" @click="triggerFileInput">
            Import Backup
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
        <small>Danger Zone</small>
        <button class="delete-btn" @click="initiateDelete()">
          Delete All Wallets
        </button>
      </div>
    </div>

    <!-- Delete confirmation flow -->
    <div v-else class="delete-confirmation">
      <div v-if="!showPinInput" class="confirm-text-step">
        <div class="warning-box">
          <p class="warning-title">⚠️ Warning</p>
          <p>
            This action will permanently delete your wallet from this extension.
            Make sure you have your recovery phrase saved.
          </p>
        </div>

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

        <p v-if="deleteError" class="error-text">{{ deleteError }}</p>

        <div class="button-group">
          <button class="cancel-btn" @click="cancelDelete">Cancel</button>
          <button class="confirm-btn" @click="confirmDeleteText">
            Continue
          </button>
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
    <div v-if="showBackupPinInput" class="import-confirm-overlay">
      <div class="import-confirm-modal backup-pin-modal">
        <h3>Verify PIN</h3>
        <p>Enter your PIN to export backup:</p>
        <PinInput
          mode="unlock"
          @complete="handleBackupPinComplete"
          @cancel="cancelBackupPin"
        />
        <p v-if="backupPinError" class="error-text">{{ backupPinError }}</p>
        <button class="cancel-btn full-width" @click="cancelBackupPin">Cancel</button>
      </div>
    </div>

    <!-- Import Confirmation Modal -->
    <div v-if="showImportConfirm" class="import-confirm-overlay">
      <div class="import-confirm-modal">
        <h3>Wallet already exists</h3>
        <p>
          The wallet "<strong>{{ pendingImportWallet?.name }}</strong>" already exists in your extension.
        </p>
        <p class="import-question">Do you want to replace it with the backup?</p>

        <div class="button-group">
          <button class="cancel-btn" @click="cancelImport">Cancel</button>
          <button class="confirm-btn replace" @click="completeImport(pendingImportWallet!, true)">
            Replace
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.menu-page {
  padding: var(--space-lg);
  max-width: 360px;
  margin: 0 auto;
}

.menu-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xl);
}

.menu-header h2 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  flex: 1;
  text-align: center;
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: var(--font-size-base);
  padding: var(--space-sm);
  width: auto;
}

.back-btn:hover {
  opacity: 0.7;
}

.menu-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
}

.delete-btn {
  background: var(--color-error);
  color: var(--color-text-primary);
  border: none;
  padding: var(--space-lg);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
}

.delete-btn:hover {
  background: #FF5252;
}

.delete-confirmation {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  padding: var(--space-xl);
  border-radius: var(--radius-xl);
}

.warning-box {
  background: var(--color-error-muted);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  margin-bottom: var(--space-xl);
}

.warning-title {
  color: var(--color-error);
  font-weight: var(--font-weight-bold);
  margin: 0 0 var(--space-sm) 0;
}

.warning-box p {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.confirm-label {
  display: block;
  margin-bottom: var(--space-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
}

.confirm-input {
  width: 100%;
  padding: var(--space-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg-elevated);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  margin-bottom: var(--space-lg);
  box-sizing: border-box;
  height: auto;
}

.confirm-input:focus {
  outline: none;
  border-color: var(--color-error);
}

.button-group {
  display: flex;
  gap: var(--space-md);
}

.cancel-btn {
  flex: 1;
  padding: var(--space-lg);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

.cancel-btn:hover {
  border-color: var(--color-border-hover);
}

.confirm-btn {
  flex: 1;
  padding: var(--space-lg);
  background: var(--color-error);
  color: var(--color-text-primary);
  border: none;
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-weight: var(--font-weight-semibold);
}

.pin-prompt {
  color: var(--color-text-primary);
  margin-bottom: var(--space-lg);
  text-align: center;
  font-size: var(--font-size-sm);
}

.pin-step {
  text-align: center;
}

/* Wallets Section */
.wallets-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
}

.section-header h3 {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.add-wallet-btn {
  background: var(--color-accent-primary);
  color: var(--color-bg-primary);
  border: none;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  width: auto;
}

.add-wallet-btn:hover {
  background: var(--color-accent-primary-hover);
}

.wallet-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.wallet-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--space-md);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  transition: all var(--transition-fast);
}

.wallet-item:hover {
  border-color: var(--color-border-hover);
}

.wallet-item.active {
  border-color: var(--color-accent-primary);
  background: var(--color-accent-primary-muted);
}

.wallet-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  cursor: pointer;
  flex: 1;
}

.wallet-name {
  color: var(--color-text-primary);
  font-weight: var(--font-weight-medium);
}

.active-badge {
  background: var(--color-accent-primary);
  color: var(--color-bg-primary);
  font-size: var(--font-size-xs);
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
  font-weight: var(--font-weight-semibold);
}

.delete-wallet-btn {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: 1.2rem;
  cursor: pointer;
  padding: 0 var(--space-sm);
  line-height: 1;
  width: auto;
}

.delete-wallet-btn:hover {
  color: var(--color-error);
}

.divider {
  border: none;
  border-top: 1px solid var(--color-border);
  margin: var(--space-lg) 0;
}

.danger-zone {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* Backup Section */
.backup-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
}

.backup-buttons {
  display: flex;
  gap: var(--space-md);
}

.backup-btn {
  flex: 1;
  padding: var(--space-md);
  border-radius: var(--radius-pill);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-fast);
}

.backup-btn.export {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.backup-btn.export:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card-hover);
}

.backup-btn.import {
  background: transparent;
  border: 1px solid var(--color-success);
  color: var(--color-success);
}

.backup-btn.import:hover {
  background: var(--color-success-muted);
}

.backup-message {
  margin: var(--space-md) 0 0 0;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  text-align: center;
}

.backup-message.success {
  background: var(--color-success-muted);
  color: var(--color-success);
}

.backup-message.error {
  background: var(--color-error-muted);
  color: var(--color-error);
}

/* Import Confirmation Modal */
.import-confirm-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(1, 7, 14, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-lg);
}

.import-confirm-modal {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  max-width: 320px;
  width: 100%;
}

.import-confirm-modal h3 {
  margin: 0 0 var(--space-lg) 0;
  color: var(--color-warning);
  font-size: var(--font-size-lg);
}

.import-confirm-modal p {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.import-question {
  color: var(--color-text-primary) !important;
  font-weight: var(--font-weight-medium);
}

.confirm-btn.replace {
  background: var(--color-warning);
  color: var(--color-bg-primary);
}

.confirm-btn.replace:hover {
  filter: brightness(1.1);
}

/* Backup PIN Modal */
.backup-pin-modal {
  text-align: center;
}

.backup-pin-modal h3 {
  color: var(--color-accent-primary);
}

.backup-pin-modal p {
  margin-bottom: var(--space-lg);
}

.full-width {
  width: 100%;
  margin-top: var(--space-lg);
}
</style>
