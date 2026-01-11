<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import ListGroup from "@/components/list/ListGroup.vue";
import ListRow from "@/components/list/ListRow.vue";
import { Button } from "@/components/ui";
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
import { DensityService, type DensityMode } from "@/services/density";

const router = useRouter();

// Density mode state
const densityMode = ref<DensityMode>("auto");

// Load density mode on mount
async function loadDensityMode() {
  densityMode.value = await DensityService.get();
}

function setDensityMode(mode: DensityMode) {
  densityMode.value = mode;
  DensityService.set(mode);
}

// Wallet list state
const wallets = ref<WalletEntry[]>([]);
const activeWalletId = ref<string | null>(null);
const isManagingWallets = ref(false);

const showDeleteConfirm = ref(false);
const confirmText = ref("");
const showPinInput = ref(false);
const deleteError = ref("");
const walletToDelete = ref<string | null>(null);

// Per-wallet removal confirmation
const showRemoveWalletConfirm = ref(false);
const walletToRemove = ref<WalletEntry | null>(null);

const CONFIRM_WORD = "DELETE";

// Backup state
const backupMessage = ref<{ type: "success" | "error"; text: string } | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const showImportConfirm = ref(false);
const pendingImportWallet = ref<WalletEntry | null>(null);
const showBackupPinInput = ref(false);
const backupPinError = ref("");

onMounted(async () => {
  loadDensityMode();
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

function handleManageTokens() {
  router.push({ path: "/manage-tokens" });
}

function toggleManageWallets() {
  isManagingWallets.value = !isManagingWallets.value;
}

// Per-wallet removal (lighter confirmation)
function initiateRemoveWallet(walletId: string) {
  const wallet = wallets.value.find(w => w.id === walletId);
  if (wallet) {
    walletToRemove.value = wallet;
    showRemoveWalletConfirm.value = true;
  }
}

function cancelRemoveWallet() {
  showRemoveWalletConfirm.value = false;
  walletToRemove.value = null;
}

async function confirmRemoveWallet() {
  if (!walletToRemove.value) return;

  const isActive = walletToRemove.value.id === activeWalletId.value;
  await deleteWalletAsync(walletToRemove.value.id);

  await loadWallets();
  showRemoveWalletConfirm.value = false;
  walletToRemove.value = null;
  isManagingWallets.value = false;

  if (wallets.value.length === 0) {
    sessionManager.lock();
    router.push({ path: "/" });
  } else if (isActive) {
    sessionManager.lock();
    router.push({ path: "/unlock" });
  }

  secureLog("Wallet removed from device");
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
  <ScreenShell :padded="false" class="settings-view">
    <template #header>
      <AppHeader
        title="Settings"
        left="back"
        @left-click="handleUserHome"
      />
    </template>

    <!-- Ambient Glow -->
    <div class="ambient-glow"></div>

    <!-- Main Content -->
    <div v-if="!showDeleteConfirm" class="page-content">
      <!-- Your Wallets Section -->
      <ListGroup title="Your Wallets">
        <template #headerAction>
          <Button variant="ghost" size="sm" @click="toggleManageWallets">
            {{ isManagingWallets ? 'Done' : 'Manage' }}
          </Button>
        </template>
        <ListRow
          v-for="wallet in wallets"
          :key="wallet.id"
          :label="wallet.name"
          :badge="wallet.id === activeWalletId ? 'Active' : undefined"
          icon-color="rgba(255, 255, 255, 0.08)"
          :chevron="!isManagingWallets"
          @click="switchWallet(wallet.id)"
        >
          <template #icon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
            </svg>
          </template>
          <template v-if="isManagingWallets" #right>
            <Button
              variant="icon"
              class="delete-icon-btn"
              @click.stop="initiateRemoveWallet(wallet.id)"
              title="Remove wallet"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </Button>
          </template>
        </ListRow>
        <ListRow
          label="Add Wallet"
          variant="add"
          @click="handleAddWallet"
        />
      </ListGroup>

      <!-- Security & Backup Section -->
      <ListGroup title="Security & Backup">
        <ListRow
          label="Export Secret Key"
          subtitle="Download encrypted backup"
          chevron
          @click="handleExportBackup"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </template>
        </ListRow>
        <ListRow
          label="Import Wallet"
          subtitle="Restore from backup file"
          chevron
          @click="triggerFileInput"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
          </template>
        </ListRow>
      </ListGroup>

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

      <!-- Token Settings Section -->
      <ListGroup title="Tokens">
        <ListRow
          label="Manage Tokens"
          subtitle="Add or remove custom tokens"
          icon-color="rgba(168, 85, 247, 0.15)"
          chevron
          @click="handleManageTokens"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 6v12M6 12h12"/>
            </svg>
          </template>
        </ListRow>
      </ListGroup>

      <!-- Appearance Section -->
      <ListGroup title="Appearance">
        <div class="density-row">
          <div class="density-label">
            <span class="density-title">Density</span>
            <span class="density-hint">Adjust UI spacing</span>
          </div>
          <div class="density-selector">
            <button
              class="density-option"
              :class="{ active: densityMode === 'auto' }"
              @click="setDensityMode('auto')"
            >
              Auto
            </button>
            <button
              class="density-option"
              :class="{ active: densityMode === 'compact' }"
              @click="setDensityMode('compact')"
            >
              Compact
            </button>
            <button
              class="density-option"
              :class="{ active: densityMode === 'comfy' }"
              @click="setDensityMode('comfy')"
            >
              Comfy
            </button>
          </div>
        </div>
      </ListGroup>

      <!-- Danger Zone -->
      <ListGroup title="Danger Zone" variant="danger">
        <ListRow
          label="Delete All Wallets"
          subtitle="Removes wallets from this device only"
          variant="danger"
          @click="initiateDelete()"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </template>
        </ListRow>
      </ListGroup>

      <!-- Version Footer -->
      <footer class="version-footer">
        DENVAULT V1.0.1
      </footer>
    </div>

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
          <Button variant="secondary" @click="cancelDelete">Cancel</Button>
          <Button variant="danger" @click="confirmDeleteText">Continue</Button>
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

    <!-- Remove Wallet Confirmation Modal -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showRemoveWalletConfirm" class="modal-overlay" @click.self="cancelRemoveWallet">
          <div class="modal-card">
            <div class="modal-icon modal-icon--danger">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </div>
            <h3>Remove wallet?</h3>
            <p>
              "<strong>{{ walletToRemove?.name }}</strong>" will be removed from this device only.
              Your funds remain safe if you have your recovery phrase.
            </p>
            <div class="button-group">
              <Button variant="secondary" @click="cancelRemoveWallet">Cancel</Button>
              <Button variant="danger" @click="confirmRemoveWallet">Remove</Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

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
            <Button variant="secondary" full-width @click="cancelBackupPin">Cancel</Button>
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
              <Button variant="secondary" @click="cancelImport">Cancel</Button>
              <Button variant="danger" @click="completeImport(pendingImportWallet!, true)">
                Replace
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </ScreenShell>
</template>

<style scoped>
/* Settings-specific density overrides for tighter layout */
.settings-view {
  --section-gap: 12px;
  --card-pad-y: 6px;
}

/* Ambient Glow - v17: neutral */
.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 40%;
  background: rgba(255, 255, 255, 0.5);
  opacity: 0.05;
  filter: blur(100px);
  border-radius: 50%;
  pointer-events: none;
}

/* Main Content */
.page-content {
  flex: 1;
  min-height: 0; /* Enable proper flex scroll */
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
  padding: var(--space-sm) var(--card-pad-x) var(--section-gap);
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* DEPRECATED: v17 neutral - ghost buttons use secondary text */
.text-accent :deep(.btn__content) {
  color: var(--color-text-secondary);
}

/* Delete icon button styling */
.delete-icon-btn {
  margin-left: var(--space-xs);
}

.delete-icon-btn :deep(.btn) {
  background: rgba(239, 68, 68, 0.15);
}

.delete-icon-btn:hover :deep(.btn) {
  background: rgba(239, 68, 68, 0.25);
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

/* Density Selector */
.density-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--card-pad-y) var(--card-pad-x);
  min-height: var(--row-h);
}

.density-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.density-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.density-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.density-selector {
  display: flex;
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 2px;
}

.density-option {
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
  font-size: 11px;
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.density-option:hover {
  color: var(--color-text-secondary);
}

.density-option.active {
  background: rgba(255, 255, 255, 0.15); /* v17: neutral active */
  color: var(--color-text-primary);
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
  height: var(--control-h);
  padding: 0 var(--space-lg);
  background: var(--surface-1);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.2em;
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
  gap: var(--space-md);
}

/* Ensure buttons stretch equally in button group */
.button-group :deep(.btn) {
  flex: 1;
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
  background: rgba(255, 255, 255, 0.08); /* v17: neutral icon bg */
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary); /* v17: neutral icon */
  margin-bottom: 8px;
}

.modal-icon--warning {
  background: rgba(251, 191, 36, 0.1);
  color: var(--color-warning);
}

.modal-icon--danger {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
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
