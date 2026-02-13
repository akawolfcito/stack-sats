<script setup lang="ts">
/**
 * ManageWalletsView - V78 Wallets Management Screen
 *
 * Features:
 * - Scrollable list of all wallets (solves Settings clipping issue)
 * - Active wallet highlighted at top
 * - Per-wallet actions: Set Active, Rename (inline), Remove
 * - Footer action: Add Wallet
 * - In-app confirmation modals (no native browser confirms)
 * - Guardrail: cannot remove active wallet if it's the only one
 *
 * V78 Primitives: ScreenShell, AppHeader, ListGroup, ListRow, Button, Sheet
 */
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import ScreenShell from '@/components/layout/ScreenShell.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ListGroup from '@/components/list/ListGroup.vue';
import ListRow from '@/components/list/ListRow.vue';
import { Button, Sheet } from '@/components/ui';
import { sessionManager } from '@/utils/security/session';
import { secureLog } from '@/utils/security/logger';
import {
  getWalletsAsync,
  getActiveWalletIdAsync,
  setActiveWalletIdAsync,
  deleteWalletAsync,
  renameWalletAsync,
  type WalletEntry,
} from '@/utils/wallets';

const router = useRouter();

// State
const wallets = ref<WalletEntry[]>([]);
const activeWalletId = ref<string | null>(null);
const isLoading = ref(true);

// Rename state
const editingWalletId = ref<string | null>(null);
const editingName = ref('');
const renameInputRef = ref<HTMLInputElement | null>(null);

// Remove confirmation state
const showRemoveConfirm = ref(false);
const walletToRemove = ref<WalletEntry | null>(null);

// Computed
const sortedWallets = computed(() => {
  // Active wallet first, then alphabetically
  return [...wallets.value].sort((a, b) => {
    if (a.id === activeWalletId.value) return -1;
    if (b.id === activeWalletId.value) return 1;
    return a.name.localeCompare(b.name);
  });
});

const canRemoveWallet = computed(() => {
  // Can remove if there's more than one wallet
  return wallets.value.length > 1;
});

// Load wallets
onMounted(async () => {
  await loadWallets();
});

async function loadWallets() {
  isLoading.value = true;
  try {
    wallets.value = await getWalletsAsync();
    activeWalletId.value = await getActiveWalletIdAsync();
  } catch (error) {
    console.error('Failed to load wallets', error);
  } finally {
    isLoading.value = false;
  }
}

// Navigation
function goBack() {
  router.push({ path: '/usermenu' });
}

function handleAddWallet() {
  router.push({ path: '/add-wallet' });
}

// Set active wallet
async function setActiveWallet(walletId: string) {
  if (walletId === activeWalletId.value) return;

  await setActiveWalletIdAsync(walletId);
  await sessionManager.switchWalletAsync(walletId);

  // Redirect to unlock to re-authenticate with new wallet
  router.push({ path: '/unlock' });
}

// Rename wallet
function startRename(wallet: WalletEntry, event: Event) {
  event.stopPropagation();
  editingWalletId.value = wallet.id;
  editingName.value = wallet.name;

  // Focus input after render
  setTimeout(() => {
    renameInputRef.value?.focus();
    renameInputRef.value?.select();
  }, 50);
}

function cancelRename() {
  editingWalletId.value = null;
  editingName.value = '';
}

async function confirmRename() {
  if (!editingWalletId.value || !editingName.value.trim()) {
    cancelRename();
    return;
  }

  const trimmedName = editingName.value.trim();
  await renameWalletAsync(editingWalletId.value, trimmedName);

  // Update local state
  const wallet = wallets.value.find(w => w.id === editingWalletId.value);
  if (wallet) {
    wallet.name = trimmedName;
  }

  secureLog('Wallet renamed', { walletId: editingWalletId.value });
  cancelRename();
}

function handleRenameKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    confirmRename();
  } else if (event.key === 'Escape') {
    cancelRename();
  }
}

// Remove wallet
function initiateRemove(wallet: WalletEntry, event: Event) {
  event.stopPropagation();

  // Cannot remove active wallet if it's the only one
  if (wallet.id === activeWalletId.value && wallets.value.length === 1) {
    return;
  }

  walletToRemove.value = wallet;
  showRemoveConfirm.value = true;
}

function cancelRemove() {
  showRemoveConfirm.value = false;
  walletToRemove.value = null;
}

async function confirmRemove() {
  if (!walletToRemove.value) return;

  const isActive = walletToRemove.value.id === activeWalletId.value;
  const walletId = walletToRemove.value.id;

  await deleteWalletAsync(walletId);
  secureLog('Wallet removed from device', { walletId });

  // Reset modal state
  showRemoveConfirm.value = false;
  walletToRemove.value = null;

  // Reload wallets
  await loadWallets();

  // Handle navigation based on state
  if (wallets.value.length === 0) {
    // No wallets left - go to start
    sessionManager.lock();
    router.push({ path: '/' });
  } else if (isActive) {
    // Active wallet was removed - need to re-authenticate
    sessionManager.lock();
    router.push({ path: '/unlock' });
  }
}

// Handle row click - set active if not editing
function handleWalletClick(wallet: WalletEntry) {
  if (editingWalletId.value) return;
  setActiveWallet(wallet.id);
}
</script>

<template>
  <ScreenShell :padded="false" data-roi="manage-wallets-screen" class="manage-wallets-view">
    <template #header>
      <AppHeader
        title="Manage Wallets"
        left="back"
        data-roi="manage-wallets-title"
        @left-click="goBack"
      />
    </template>

    <!-- Ambient Glow -->
    <div class="ambient-glow"></div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading wallets...</p>
    </div>

    <!-- Content -->
    <div v-else class="wallets-content">
      <!-- Wallets List -->
      <ListGroup data-roi="wallets-list">
        <ListRow
          v-for="wallet in sortedWallets"
          :key="wallet.id"
          :label="editingWalletId === wallet.id ? '' : wallet.name"
          :badge="wallet.id === activeWalletId ? 'Active' : undefined"
          :chevron="false"
          @click="handleWalletClick(wallet)"
        >
          <template #icon>
            <div class="wallet-avatar" :class="{ 'wallet-avatar--active': wallet.id === activeWalletId }">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/>
                <path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/>
                <path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>
              </svg>
            </div>
          </template>

          <!-- Inline rename input -->
          <template v-if="editingWalletId === wallet.id" #label>
            <input
              ref="renameInputRef"
              v-model="editingName"
              type="text"
              class="rename-input"
              maxlength="30"
              @blur="confirmRename"
              @keydown="handleRenameKeydown"
              @click.stop
            />
          </template>

          <!-- Actions -->
          <template #right>
            <div class="wallet-actions">
              <!-- Rename button -->
              <button
                v-if="editingWalletId !== wallet.id"
                class="action-btn"
                title="Rename wallet"
                @click="startRename(wallet, $event)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>

              <!-- Remove button (not shown for active wallet if only one) -->
              <button
                v-if="canRemoveWallet && editingWalletId !== wallet.id"
                class="action-btn action-btn--danger"
                :class="{ 'action-btn--disabled': wallet.id === activeWalletId && wallets.length === 1 }"
                title="Remove wallet"
                @click="initiateRemove(wallet, $event)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </template>
        </ListRow>
      </ListGroup>

      <!-- Hint -->
      <p class="wallets-hint">
        Tap a wallet to switch to it
      </p>

      <!-- Add Wallet CTA -->
      <div class="add-wallet-section" data-roi="wallets-add-cta">
        <Button
          variant="secondary"
          full-width
          @click="handleAddWallet"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Add Wallet
        </Button>
      </div>
    </div>

    <!-- V78: Remove wallet confirmation modal (in-app, not native) -->
    <Sheet
      :is-open="showRemoveConfirm"
      variant="modal"
      title="Remove wallet?"
      :show-close="false"
      data-roi="remove-wallet-modal"
      @close="cancelRemove"
    >
      <div class="remove-modal-content">
        <div class="remove-modal-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </div>
        <p class="remove-modal-body">
          "<strong>{{ walletToRemove?.name }}</strong>" will be removed from this device only.
          Your funds remain safe if you have your recovery phrase.
        </p>
      </div>

      <template #footer>
        <div class="remove-modal-actions">
          <Button
            variant="secondary"
            full-width
            data-roi="remove-wallet-cancel"
            @click="cancelRemove"
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            full-width
            data-roi="remove-wallet-confirm"
            @click="confirmRemove"
          >
            Remove
          </Button>
        </div>
      </template>
    </Sheet>
  </ScreenShell>
</template>

<style scoped>
/* V78: Root view styling */
.manage-wallets-view {
  position: relative;
}

/* Ambient Glow */
.ambient-glow {
  position: absolute;
  top: -10%;
  left: -20%;
  width: 60%;
  height: 30%;
  background: rgba(255, 255, 255, 0.3);
  opacity: 0.02;
  filter: blur(80px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

/* Loading State */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  color: var(--color-text-muted);
  position: relative;
  z-index: 1;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-card);
  border-top-color: var(--color-text-muted);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Content - V83: Scroll container within flex layout */
.wallets-content {
  display: flex;
  flex-direction: column;
  padding: var(--space-md) var(--page-pad-x) var(--space-lg);
  gap: var(--space-lg);
  /* V83: Fix scroll - must be scroll container within flex parent */
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

/* V78: Wallet Avatar - Premium glass surface */
.wallet-avatar {
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  /* Glass surface */
  background: var(--panel-bg-glass);
  border: 1px solid var(--panel-border);
  box-shadow: var(--panel-highlight);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

/* Active wallet avatar - mainnet glow */
.wallet-avatar--active {
  background: rgba(153, 225, 142, 0.15);
  border-color: rgba(153, 225, 142, 0.3);
  color: var(--color-success);
  box-shadow: 0 0 12px rgba(153, 225, 142, 0.15);
}

/* Premium "Active" badge */
:deep(.list-row-badge) {
  background: rgba(153, 225, 142, 0.15);
  color: var(--color-success);
  border: 1px solid rgba(153, 225, 142, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* Wallet actions */
.wallet-actions {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

/* Action buttons - V83: Override global button styles */
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  min-width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  background: var(--surface-hover);
  color: var(--color-text-primary);
}

.action-btn:active {
  background: var(--surface-pressed);
  transform: scale(0.92);
}

/* Danger action button */
.action-btn--danger {
  color: var(--color-text-muted);
}

.action-btn--danger:hover {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
}

.action-btn--disabled {
  opacity: 0.3;
  pointer-events: none;
}

/* Inline rename input */
.rename-input {
  flex: 1;
  height: 32px;
  padding: 0 var(--space-sm);
  background: var(--surface-hover);
  border: 1px solid var(--panel-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.rename-input:focus {
  outline: none;
  border-color: var(--color-text-muted);
}

/* Hint */
.wallets-hint {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}

/* Add Wallet Section */
.add-wallet-section {
  margin-top: auto;
}

/* V78: Remove modal styles */
.remove-modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-sm) var(--space-md);
}

.remove-modal-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: 50%;
  color: var(--color-error);
}

.remove-modal-body {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  text-align: center;
}

.remove-modal-body strong {
  color: var(--color-text-primary);
}

.remove-modal-actions {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md);
}
</style>
