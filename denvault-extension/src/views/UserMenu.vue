<script setup lang="ts">
import { ref, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import ListGroup from "@/components/list/ListGroup.vue";
import ListRow from "@/components/list/ListRow.vue";
import { Button, ModalScaffold } from "@/components/ui";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import {
  getWalletsAsync,
  getActiveWalletIdAsync,
  getActiveWalletAsync,
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
import {
  ERASE_ACKNOWLEDGEMENT,
  ERASE_CONFIRM_WORD,
  ERASE_HEADLINE,
  ERASE_ROW_LABEL,
  ERASE_ROW_SUBTITLE,
  ERASE_SCREEN_TITLE,
  eraseBody,
  eraseButtonLabel,
} from "@/utils/wallets/erase-copy";

const router = useRouter();
const route = useRoute();

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

// V78: Wallet summary state (no longer expanding list)
// Injected from public/manifest.json at build time — the version the
// browser and the Chrome Web Store actually report.
const appVersion = __APP_VERSION__;

const walletCount = ref(0);
const activeWalletName = ref<string>('');

const showDeleteConfirm = ref(false);
const confirmText = ref("");
const showPinInput = ref(false);
const deleteError = ref("");
const walletToDelete = ref<string | null>(null);

// One source for the words, shared with UnlockView's copy of this flow.
// Two screens is how this action ended up with three names. See
// utils/wallets/erase-copy.
const CONFIRM_WORD = ERASE_CONFIRM_WORD;

/** Named, not counted. A number is read past; a name you recognise is not. */
const walletNames = ref<string[]>([]);

/** The promise has to be made before the word can be typed. */
const eraseAcknowledged = ref(false);

// Backup state
const backupMessage = ref<{ type: "success" | "error"; text: string } | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const showImportConfirm = ref(false);
const pendingImportWallet = ref<WalletEntry | null>(null);

onMounted(async () => {
  loadDensityMode();
  await loadWalletSummary();
});

// V78: Load only wallet count and active wallet name (not full list)
async function loadWalletSummary() {
  const wallets = await getWalletsAsync();
  const activeId = await getActiveWalletIdAsync();

  walletCount.value = wallets.length;
  walletNames.value = wallets.map((w) => w.name);
  const activeWallet = wallets.find(w => w.id === activeId);
  activeWalletName.value = activeWallet?.name || 'No wallet';
}

function handleUserHome() {
  router.push({ path: "/user" });
}

// V78: Navigate to Manage Wallets screen (replaces inline wallet list)
function handleManageWallets() {
  router.push({ path: "/manage-wallets" });
}

function handleManageTokens() {
  router.push({ path: "/manage-tokens" });
}

/**
 * Open the wallet in a full browser tab.
 *
 * Lived in the Home header until the row ran out of room at popup width,
 * where it also sat next to the side panel button as a second, nearly
 * identical window icon.
 */
function handleOpenFullPage() {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL && chrome.tabs?.create) {
    chrome.tabs.create({ url: chrome.runtime.getURL("index.html?view=fullpage") });
    window.close();
    return;
  }
  secureLog("Full page mode not available outside extension context");
}

// V68: Navigate to accounts management screen
function handleManageAccounts() {
  router.push({ path: "/accounts" });
}

// V78: Delete All Wallets (Danger Zone action)
function initiateDelete() {
  showDeleteConfirm.value = true;
  confirmText.value = "";
  deleteError.value = "";
}

function cancelDelete() {
  eraseAcknowledged.value = false;
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

// V78: Delete ALL wallets (Danger Zone action)
async function secureWipeAndDelete() {
  secureLog("Starting secure wallet deletion (all wallets)");

  await sessionManager.deleteWalletAsync();
  router.push({ path: "/" });

  secureLog("All wallets deleted securely");
}

function handlePinCancel() {
  showPinInput.value = false;
  deleteError.value = "";
}

// V48: Backup functions - navigate to fullscreen PIN verification
async function handleExportBackup() {
  backupMessage.value = null;

  const activeWallet = await getActiveWalletAsync();
  if (!activeWallet) {
    backupMessage.value = { type: "error", text: "No active wallet to export" };
    return;
  }

  // Navigate to fullscreen PIN verification
  router.push({
    path: "/verify-pin",
    query: {
      action: "backup",
      returnTo: "/usermenu",
    },
  });
}

/**
 * Show the recovery phrase again.
 *
 * Goes straight to the phrase on success rather than back here, because the
 * grant VerifyPinView issues is spent by the first screen that asks for it.
 */
function handleShowRecoveryPhrase() {
  backupMessage.value = null;

  router.push({
    path: "/verify-pin",
    query: {
      action: "reveal",
      returnTo: "/recovery-phrase",
    },
  });
}

// V48: Handle return from PIN verification
async function handlePinVerifiedReturn() {
  const activeWallet = await getActiveWalletAsync();
  if (!activeWallet) {
    backupMessage.value = { type: "error", text: "No active wallet to export" };
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

  setTimeout(() => {
    backupMessage.value = null;
  }, 3000);
}

// V48: Watch for return from verify-pin route
watch(
  () => route.query,
  async (query) => {
    if (query.pinVerified === "true" && query.action === "backup") {
      // Clear query params
      router.replace({ path: "/usermenu" });
      // Execute backup
      await handlePinVerifiedReturn();
    }
  },
  { immediate: true }
);

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
    await loadWalletSummary();
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
  <ScreenShell :padded="false" class="settings-view" data-roi="menu-screen">
    <template #header>
      <AppHeader
        title="Settings"
        left="back"
        data-roi="menu-title"
        @left-click="handleUserHome"
      />
    </template>

    <!-- Ambient Glow -->
    <div class="ambient-glow"></div>

    <!-- Main Content -->
    <div v-if="!showDeleteConfirm" class="page-content">
      <!-- V78: Wallets Section - Single navigation row (no expanding list) -->
      <ListGroup title="Wallets" data-roi="menu-section-wallet">
        <ListRow
          label="Manage Wallets"
          :subtitle="`${walletCount} wallet${walletCount !== 1 ? 's' : ''} • ${activeWalletName}`"
          chevron
          data-roi="menu-action-wallets"
          @click="handleManageWallets"
        >
          <template #icon>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
              <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
              <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
            </svg>
          </template>
        </ListRow>
      </ListGroup>

      <!-- V68: Accounts Management Section -->
      <ListGroup title="Accounts" data-roi="menu-section-accounts">
        <ListRow
          label="Manage Accounts"
          subtitle="Rename, organize, and add accounts"
          chevron
          data-roi="menu-action-accounts"
          @click="handleManageAccounts"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </template>
        </ListRow>
      </ListGroup>

      <!-- View section: moved out of the Home header, where two window
           icons sat side by side and were indistinguishable at 16px. This
           is an occasional exit, not a per-session action. -->
      <ListGroup title="View" data-roi="menu-section-view">
        <ListRow
          label="Open in Full Page"
          subtitle="Use the wallet in a full browser tab"
          chevron
          data-roi="menu-action-fullpage"
          @click="handleOpenFullPage"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </template>
        </ListRow>
      </ListGroup>

      <!-- Security & Backup Section -->
      <ListGroup title="Security & Backup" data-roi="menu-section-security">
        <ListRow
          label="Recovery Phrase"
          subtitle="See your words again, after your PIN"
          chevron
          data-roi="menu-action-recovery-phrase"
          @click="handleShowRecoveryPhrase"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </template>
        </ListRow>
        <ListRow
          label="Export Secret Key"
          subtitle="Encrypted backup, opened only by this PIN"
          chevron
          data-roi="menu-action-export"
          @click="handleExportBackup"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
            </svg>
          </template>
        </ListRow>
        <!--
          Restoring from the recovery phrase is the way a wallet is normally
          brought back, and the screen for it already existed at
          /import-recovery, reachable from onboarding and Add Wallet but not
          from here. Settings offered only the encrypted JSON, which needs
          both this extension and the PIN, so the path that works everywhere
          was the one missing.
        -->
        <ListRow
          label="Import from Recovery Phrase"
          subtitle="Restore with your words"
          chevron
          data-roi="menu-action-import-phrase"
          @click="router.push('/import-recovery')"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 7V5a2 2 0 0 1 2-2h2M4 17v2a2 2 0 0 0 2 2h2m8-18h2a2 2 0 0 1 2 2v2m0 10v2a2 2 0 0 1-2 2h-2"/>
              <line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </template>
        </ListRow>
        <ListRow
          label="Import Backup File"
          subtitle="Restore from encrypted backup"
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
      <ListGroup title="Danger Zone" variant="danger" data-roi="menu-section-danger">
        <ListRow
          :label="ERASE_ROW_LABEL"
          :subtitle="ERASE_ROW_SUBTITLE"
          variant="danger"
          data-roi="menu-action-delete"
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
        DENVAULT V{{ appVersion }}
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
          <h3>{{ ERASE_SCREEN_TITLE }}</h3>
          <p class="erase-headline">{{ ERASE_HEADLINE }}</p>
          <p>{{ eraseBody(walletCount) }}</p>
        </div>

        <!-- Seeing the name you recognise is the moment a hand stops. -->
        <div v-if="walletNames.length" class="erase-inventory" data-roi="erase-inventory">
          <p class="erase-inventory-title">Wallets to be erased</p>
          <ul>
            <li v-for="name in walletNames" :key="name">{{ name }}</li>
          </ul>
        </div>

        <!-- Before the typing. Ticking a box that claims something about
             yourself is the gesture that actually gives pause; typing a
             word is muscle. -->
        <label class="erase-ack" data-roi="erase-acknowledge">
          <input v-model="eraseAcknowledged" type="checkbox" />
          <span>{{ ERASE_ACKNOWLEDGEMENT }}</span>
        </label>

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
          <Button
            variant="danger"
            :disabled="!eraseAcknowledged"
            data-roi="erase-confirm-cta"
            @click="confirmDeleteText"
          >
            {{ eraseButtonLabel(walletCount) }}
          </Button>
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

    <!-- V48: Backup PIN verification moved to fullscreen /verify-pin route -->
    <!-- V78: Remove wallet confirmation moved to ManageWalletsView -->

    <!-- Import Confirmation Modal -->
    <ModalScaffold
      :is-open="showImportConfirm"
      variant="warning"
      title="Wallet Already Exists"
      @close="cancelImport"
    >
      <template #icon>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      </template>
      <p>
        The wallet "<strong>{{ pendingImportWallet?.name }}</strong>" already exists in your extension.
      </p>
      <p class="modal-question">Do you want to replace it with the backup?</p>
      <template #actions>
        <Button variant="secondary" @click="cancelImport">Cancel</Button>
        <Button variant="danger" @click="completeImport(pendingImportWallet!, true)">Replace</Button>
      </template>
    </ModalScaffold>
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

/* Main Content - V83: Scroll container within flex layout */
.page-content {
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
  padding: var(--space-sm) var(--card-pad-x) var(--section-gap);
  /* V83: Fix scroll - must be scroll container within flex parent */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
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
  font-size: var(--font-size-sm);
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
  font-size: var(--font-size-2xs);
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
  font-size: var(--font-size-2xs);
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
  /* The inventory and the acknowledgement made this taller than a popup. */
  overflow-y: auto;
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
  font-size: var(--font-size-xl);
  font-weight: 700;
  color: var(--color-error);
  margin: 0 0 12px;
}

.warning-card p {
  font-size: var(--font-size-sm);
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
  font-size: var(--font-size-sm);
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

.erase-headline {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
}

.erase-inventory {
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md, 12px);
  background: var(--color-surface-2, rgba(255, 255, 255, 0.04));
}

.erase-inventory-title {
  margin: 0 0 var(--space-xs);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.erase-inventory ul {
  margin: 0;
  padding-left: var(--space-md);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
}

.erase-ack {
  display: flex;
  gap: var(--space-sm);
  align-items: flex-start;
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.erase-ack input {
  margin-top: 0.2em;
  flex-shrink: 0;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

.button-group {
  display: flex;
  gap: var(--space-md);
  /* See UnlockView: a confirmation whose buttons can leave the screen is
     worse than no confirmation, because it looks like one. */
  position: sticky;
  bottom: 0;
  padding: var(--space-sm) 0;
  background: var(--color-bg-primary);
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
  font-size: var(--font-size-base);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
}

/* Modal content styles (used within ModalScaffold) */
.modal-question {
  color: var(--color-text-primary) !important;
  font-weight: var(--font-weight-medium);
}

/* V48: PIN modal styles removed - now using fullscreen /verify-pin route */
</style>
