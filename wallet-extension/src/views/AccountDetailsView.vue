<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useRouter, useRoute } from "vue-router";
import { generateInitialAccounts } from "@/utils/accounts";
import { type Account } from "@/utils/types";
import { sessionManager } from "@/utils/security/session";
import { getSelectedNetwork, type NetworkName } from "@/utils/network";
import {
  getAccountName,
  setAccountName,
  isAccountHidden,
  hideAccount,
  showAccount,
} from "@/utils/accounts/settings";
import AddressCard from "@/components/account/AddressCard.vue";
import AddressQrModal from "@/components/account/AddressQrModal.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";

const router = useRouter();
const route = useRoute();

// State
const account = ref<Account | null>(null);
const accountName = ref("");
const isHidden = ref(false);
const isLoading = ref(true);
const isSavingName = ref(false);
const network = ref<NetworkName>("devnet");

// QR Modal state
const qrModalOpen = ref(false);
const qrModalLabel = ref("");
const qrModalAddress = ref("");
const qrModalAsset = ref<"STX" | "BTC" | "P2TR">("STX");

// Get account index from route params
const accountIndex = computed(() => {
  const idx = route.params.index;
  return typeof idx === "string" ? parseInt(idx, 10) : 0;
});

// Truncate address for display
function truncateAddress(address: string, chars: number = 6): string {
  if (!address || address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

// Load account data
onBeforeMount(async () => {
  network.value = getSelectedNetwork();

  if (!sessionManager.hasWallet || sessionManager.isLocked) {
    router.push({ path: "/unlock" });
    return;
  }

  const mnemonic = sessionManager.getMnemonic();
  if (!mnemonic) {
    router.push({ path: "/unlock" });
    return;
  }

  try {
    const accounts = await generateInitialAccounts(mnemonic, accountIndex.value + 1, network.value);
    account.value = accounts[accountIndex.value];

    // Load account settings
    accountName.value = await getAccountName(accountIndex.value);
    isHidden.value = await isAccountHidden(accountIndex.value);
  } catch (error) {
    console.error("Failed to load account", error);
    router.push({ path: "/user" });
  } finally {
    isLoading.value = false;
  }
});

// Actions
function handleBack() {
  router.back();
}

async function saveName() {
  if (isSavingName.value) return;

  isSavingName.value = true;
  try {
    await setAccountName(accountIndex.value, accountName.value);
  } finally {
    isSavingName.value = false;
  }
}

async function toggleHidden() {
  const newValue = !isHidden.value;
  isHidden.value = newValue;

  if (newValue) {
    await hideAccount(accountIndex.value);
  } else {
    await showAccount(accountIndex.value);
  }
}

function handleShowQr(address: string, label: string) {
  qrModalAddress.value = address;
  qrModalLabel.value = label;
  // Determine asset type from label
  if (label.toLowerCase().includes("stx") || label.toLowerCase().includes("stacks")) {
    qrModalAsset.value = "STX";
  } else if (label.toLowerCase().includes("taproot") || label.toLowerCase().includes("p2tr")) {
    qrModalAsset.value = "P2TR";
  } else {
    qrModalAsset.value = "BTC";
  }
  qrModalOpen.value = true;
}

function handleCloseQr() {
  qrModalOpen.value = false;
}

function handleViewPrivateKey() {
  // TODO: Implement with PIN verification
  alert("This feature requires PIN verification. Coming soon!");
}

function handleViewSecretPhrase() {
  // TODO: Implement with PIN verification
  alert("This feature requires PIN verification. Coming soon!");
}

function handleClose() {
  router.push({ path: "/user" });
}
</script>

<template>
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        title="Account Details"
        left="back"
        @left-click="handleBack"
      />
    </template>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading account...</p>
    </div>

    <!-- Content -->
    <main v-else-if="account" class="content">
      <!-- Profile Section -->
      <div class="profile-section">
        <!-- Avatar -->
        <div class="avatar-wrapper">
          <div class="avatar">
            <span class="avatar-text">{{ accountIndex + 1 }}</span>
          </div>
        </div>

        <!-- Account Name -->
        <div class="name-section">
          <label class="name-label">Account Name</label>
          <div class="name-input-wrapper">
            <input
              v-model="accountName"
              type="text"
              class="name-input"
              placeholder="Enter account name"
              @blur="saveName"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
            <span class="edit-icon">&#9998;</span>
          </div>
          <p class="address-preview">{{ truncateAddress(account.stxAddress, 4) }}</p>
        </div>
      </div>

      <!-- Addresses Section -->
      <div class="section">
        <h3 class="section-title">Addresses</h3>
        <div class="addresses-list">
          <!-- STX Address -->
          <AddressCard
            label="Stacks Address"
            :address="account.stxAddress"
            subtitle="STX & SIP-10 tokens"
            assetTag="STX"
            safetyMessage="Only send STX to this address."
            @showQr="handleShowQr"
          />

          <!-- BTC P2PKH Address -->
          <AddressCard
            v-if="account.btcP2PKHAddress"
            label="Bitcoin (Legacy)"
            :address="account.btcP2PKHAddress"
            subtitle="P2PKH"
            assetTag="BTC"
            safetyMessage="Only send BTC to this address."
            @showQr="handleShowQr"
          />

          <!-- BTC P2TR Address -->
          <AddressCard
            v-if="account.btcP2TRAddress"
            label="Bitcoin (Taproot)"
            :address="account.btcP2TRAddress"
            subtitle="P2TR"
            assetTag="P2TR"
            safetyMessage="Only send BTC to this address."
            @showQr="handleShowQr"
          />
        </div>
      </div>

      <!-- Security Section -->
      <div class="section">
        <h3 class="section-title">Security</h3>
        <div class="card">
          <!-- View Private Key -->
          <button class="action-row" @click="handleViewPrivateKey">
            <div class="action-icon key-icon">
              <span>&#128273;</span>
            </div>
            <div class="action-content">
              <p class="action-title">View Private Key</p>
              <p class="action-subtitle">Requires PIN verification</p>
            </div>
            <span class="chevron">&rsaquo;</span>
          </button>

          <div class="divider"></div>

          <!-- View Secret Phrase -->
          <button class="action-row" @click="handleViewSecretPhrase">
            <div class="action-icon phrase-icon">
              <span>&#128274;</span>
            </div>
            <div class="action-content">
              <p class="action-title">View Secret Phrase</p>
              <p class="action-subtitle">Requires PIN verification</p>
            </div>
            <span class="chevron">&rsaquo;</span>
          </button>
        </div>
      </div>

      <!-- Preferences Section -->
      <div class="section">
        <h3 class="section-title">Preferences</h3>
        <div class="card">
          <div class="preference-row">
            <div class="preference-info">
              <div class="preference-icon">
                <span v-if="isHidden">&#128065;</span>
                <span v-else>&#128064;</span>
              </div>
              <div class="preference-content">
                <p class="preference-title">Hide Account</p>
                <p class="preference-subtitle">Hidden accounts can be unhidden in Settings</p>
              </div>
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                :checked="isHidden"
                @change="toggleHidden"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Close Button -->
      <button class="close-btn" @click="handleClose">
        Close
      </button>
    </main>

    <!-- QR Modal -->
    <AddressQrModal
      :isOpen="qrModalOpen"
      :label="qrModalLabel"
      :address="qrModalAddress"
      :assetTag="qrModalAsset"
      @close="handleCloseQr"
    />
  </ScreenShell>
</template>

<style scoped>
/* Loading State */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  color: var(--color-text-muted);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-card);
  border-top-color: var(--color-text-muted); /* v17: neutral spinner */
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Content */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0 var(--space-md) var(--space-lg);
  overflow-y: auto;
  gap: var(--space-md);
}

/* Profile Section */
.profile-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-xs) 0;
}

.avatar-wrapper {
  position: relative;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--color-bg-elevated), var(--color-bg-card));
  border: 2px solid var(--color-border-hover); /* v17: neutral border */
  box-shadow: var(--shadow-elev-2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-text {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary); /* v17: neutral text */
}

.name-section {
  text-align: center;
  width: 100%;
  max-width: 280px;
}

.name-label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-sm);
}

.name-input-wrapper {
  display: flex;
  align-items: center;
  background: var(--color-bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-sm) var(--space-md);
  border: 1px solid var(--color-border);
}

.name-input-wrapper:focus-within {
  border-color: var(--color-border-hover); /* v17: neutral focus */
}

.name-input {
  flex: 1;
  background: transparent;
  border: none;
  text-align: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  outline: none;
}

.name-input::placeholder {
  color: var(--color-text-muted);
}

.edit-icon {
  color: var(--color-text-muted); /* v17: neutral icon */
  font-size: var(--font-size-lg);
  margin-left: var(--space-sm);
}

.address-preview {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary); /* v17: neutral address */
  margin-top: var(--space-sm);
}

/* Sections */
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.section-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin: 0;
  padding-left: var(--space-sm);
}

.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.divider {
  height: 1px;
  background: var(--color-border);
  margin: 0 var(--space-lg);
}

/* Addresses List */
.addresses-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* Action Row */
.action-row {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md) var(--space-lg);
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
}

.action-row:hover {
  background: var(--color-bg-elevated);
}

.action-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  flex-shrink: 0;
}

.key-icon {
  background: rgba(255, 255, 255, 0.08); /* v17: neutral icon bg */
  color: var(--color-text-primary);
}

.phrase-icon {
  background: rgba(255, 255, 255, 0.08); /* v17: neutral icon bg */
  color: var(--color-text-primary);
}

.action-content {
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.action-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}

.chevron {
  color: var(--color-text-muted);
  font-size: 1.5rem;
  flex-shrink: 0;
}

/* Preference Row */
.preference-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
}

.preference-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.preference-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--color-bg-elevated);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.preference-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.preference-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.preference-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}

/* Toggle Switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 28px;
  flex-shrink: 0;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: 28px;
  transition: all var(--transition-base);
}

.toggle-slider::before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 4px;
  bottom: 3px;
  background-color: var(--color-text-muted);
  border-radius: 50%;
  transition: all var(--transition-base);
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-success); /* v17: success for on state */
  border-color: var(--color-success);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background-color: var(--color-bg-primary);
}

/* Close Button */
.close-btn {
  width: 100%;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  margin-top: auto;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: var(--color-bg-elevated);
  border-color: var(--color-border-hover); /* v17: neutral hover */
}
</style>
