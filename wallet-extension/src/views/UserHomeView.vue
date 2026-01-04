<script setup lang="ts">
import { useRouter } from "vue-router";
import { onBeforeMount, ref, watch, computed } from "vue";
import { generateInitialAccounts } from "../utils/accounts";
import { type Account } from "../utils/types";
import { sessionManager } from "../utils/security/session";
import { secureLog } from "../utils/security/logger";
import {
  getSelectedNetwork,
  setSelectedNetwork,
  NETWORKS,
  type NetworkName,
} from "../utils/network";
import {
  fetchStxBalance,
  fetchFungibleTokens,
  formatStxBalance,
  microStxToStx,
  formatUsdValue,
} from "../utils/balance";
import {
  fetchAllTokenInfo,
  type TokenInfo,
} from "../utils/tokens";
import {
  getAccountCount,
  addAccount,
  removeLastAccount,
  getAccountName,
  setAccountName,
  DEFAULT_ACCOUNT_COUNT,
} from "../utils/accounts/settings";
import {
  fetchTransactions,
  formatRelativeTime,
  formatAmount,
  truncateAddress as truncateTxAddress,
  getTransactionTypeLabel,
  getExplorerUrl,
  type Transaction,
  type TransactionStatus,
} from "../utils/transactions";
import ReceiveModal from "../components/ReceiveModal.vue";

const router = useRouter();
const userAccounts = ref<Account[]>([]);
const isLoading = ref(true);
const selectedNetwork = ref<NetworkName>(getSelectedNetwork());
const currentMnemonic = ref<string | null>(null);

// Persistent account selection
const ACCOUNT_STORAGE_KEY = "selected_account_index";
function getSavedAccountIndex(): number {
  const saved = localStorage.getItem(ACCOUNT_STORAGE_KEY);
  if (saved !== null) {
    const index = parseInt(saved, 10);
    if (!isNaN(index) && index >= 0 && index < 20) {
      return index;
    }
  }
  return 0;
}
const accountIndexToDisplay = ref(getSavedAccountIndex());

// Balance state
const stxBalanceMicro = ref<string>("0");
const isLoadingBalance = ref(false);
const stxPriceUsd = ref(0); // TODO: Fetch from price API

// Account count state
const accountCount = ref(DEFAULT_ACCOUNT_COUNT);

// Account naming state
const isEditingName = ref(false);
const editingName = ref("");
const accountNames = ref<Record<number, string>>({});

// Transaction history state
const transactions = ref<Transaction[]>([]);
const isLoadingTx = ref(false);
const showAllTx = ref(false);

// Token state (SIP-010)
const tokens = ref<TokenInfo[]>([]);
const isLoadingTokens = ref(false);
const showTokens = ref(true);

// Computed properties for balance display
const formattedStxBalance = computed(() => formatStxBalance(stxBalanceMicro.value));
const stxBalanceNumber = computed(() => microStxToStx(stxBalanceMicro.value));
const totalValueUsd = computed(() => {
  if (stxPriceUsd.value === 0) return null;
  return formatUsdValue(stxBalanceNumber.value * stxPriceUsd.value);
});

// Current account display name
const currentAccountName = computed(() => {
  return accountNames.value[accountIndexToDisplay.value] || `Account ${accountIndexToDisplay.value + 1}`;
});

// Get display name for account in dropdown
function getDisplayName(index: number): string {
  return accountNames.value[index] || `Account ${index + 1}`;
}

// Load account names from settings
async function loadAccountNames() {
  const names: Record<number, string> = {};
  for (let i = 0; i < accountCount.value; i++) {
    const customName = await getAccountName(i);
    if (customName !== `Account ${i + 1}`) {
      names[i] = customName;
    }
  }
  accountNames.value = names;
}

// Start editing name
function startEditName() {
  editingName.value = currentAccountName.value;
  isEditingName.value = true;
}

// Save edited name
async function saveAccountName() {
  const trimmed = editingName.value.trim();
  if (trimmed && trimmed !== `Account ${accountIndexToDisplay.value + 1}`) {
    await setAccountName(accountIndexToDisplay.value, trimmed);
    accountNames.value[accountIndexToDisplay.value] = trimmed;
  } else {
    // Clear custom name if empty or same as default
    await setAccountName(accountIndexToDisplay.value, "");
    delete accountNames.value[accountIndexToDisplay.value];
  }
  isEditingName.value = false;
}

// Cancel editing
function cancelEditName() {
  isEditingName.value = false;
  editingName.value = "";
}

// Handle enter key in name input
function handleNameKeydown(event: KeyboardEvent) {
  if (event.key === "Enter") {
    saveAccountName();
  } else if (event.key === "Escape") {
    cancelEditName();
  }
}

async function loadAccounts(mnemonic: string, network: NetworkName, count?: number) {
  isLoading.value = true;
  try {
    const numAccounts = count || accountCount.value;
    const accounts = await generateInitialAccounts(mnemonic, numAccounts, network);
    userAccounts.value = accounts;
    secureLog(`Accounts loaded for ${network}: ${numAccounts} accounts`);
  } catch (error) {
    secureLog("Failed to generate accounts", error);
    router.push({ path: "/" });
  }
  isLoading.value = false;
}

async function handleAddAccount() {
  if (!currentMnemonic.value) return;
  const newCount = await addAccount();
  accountCount.value = newCount;
  await loadAccounts(currentMnemonic.value, selectedNetwork.value, newCount);
  // Select the new account
  accountIndexToDisplay.value = newCount - 1;
}

async function handleRemoveAccount() {
  if (!currentMnemonic.value || accountCount.value <= 1) return;

  // If current selection is the last account, move to previous
  if (accountIndexToDisplay.value >= accountCount.value - 1) {
    accountIndexToDisplay.value = accountCount.value - 2;
  }

  const newCount = await removeLastAccount();
  accountCount.value = newCount;
  await loadAccounts(currentMnemonic.value, selectedNetwork.value, newCount);
}

async function loadBalance() {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount?.stxAddress) return;

  isLoadingBalance.value = true;
  try {
    const balance = await fetchStxBalance(currentAccount.stxAddress, selectedNetwork.value);
    if (balance !== null) {
      stxBalanceMicro.value = balance;
    }
  } catch (error) {
    secureLog("Failed to load balance", error);
  }
  isLoadingBalance.value = false;
}

async function loadTransactions() {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount?.stxAddress) return;

  isLoadingTx.value = true;
  try {
    const txs = await fetchTransactions(currentAccount.stxAddress, 20, 0, selectedNetwork.value);
    if (txs !== null) {
      transactions.value = txs;
    }
  } catch (error) {
    secureLog("Failed to load transactions", error);
  }
  isLoadingTx.value = false;
}

async function loadTokens() {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount?.stxAddress) return;

  isLoadingTokens.value = true;
  try {
    const fungibleTokens = await fetchFungibleTokens(currentAccount.stxAddress, selectedNetwork.value);
    if (fungibleTokens && Object.keys(fungibleTokens).length > 0) {
      const tokenInfos = await fetchAllTokenInfo(fungibleTokens, selectedNetwork.value);
      // Filter out tokens with 0 balance
      tokens.value = tokenInfos.filter(t => t.balance !== "0");
    } else {
      tokens.value = [];
    }
  } catch (error) {
    secureLog("Failed to load tokens", error);
    tokens.value = [];
  }
  isLoadingTokens.value = false;
}

function getStatusClass(status: TransactionStatus): string {
  switch (status) {
    case "success": return "tx-success";
    case "pending": return "tx-pending";
    default: return "tx-failed";
  }
}

function openExplorer(txId: string) {
  const url = getExplorerUrl(txId, selectedNetwork.value);
  window.open(url, "_blank");
}

async function refreshBalance() {
  await loadBalance();
  loadTransactions(); // Load in background
  loadTokens(); // Load in background
}

onBeforeMount(async () => {
  // Load account settings
  accountCount.value = await getAccountCount();
  await loadAccountNames();

  // Check for encrypted wallet first
  if (sessionManager.hasWallet) {
    if (sessionManager.isLocked) {
      router.push({ path: "/unlock" });
      return;
    }

    // Get mnemonic from session (already unlocked)
    const mnemonic = sessionManager.getMnemonic();
    if (mnemonic) {
      currentMnemonic.value = mnemonic;
      await loadAccounts(mnemonic, selectedNetwork.value);
      // Load balance, transactions and tokens after accounts are loaded
      await loadBalance();
      loadTransactions(); // Don't await, load in background
      loadTokens(); // Don't await, load in background
    } else {
      router.push({ path: "/unlock" });
    }
  } else {
    // No wallet exists, redirect to start
    router.push({ path: "/" });
  }
});

// Watch for network changes and regenerate accounts
watch(selectedNetwork, async (newNetwork) => {
  setSelectedNetwork(newNetwork);
  transactions.value = []; // Clear transactions on network change
  tokens.value = []; // Clear tokens on network change
  if (currentMnemonic.value) {
    await loadAccounts(currentMnemonic.value, newNetwork);
    await loadBalance();
    loadTransactions();
    loadTokens();
  }
});

// Watch for account index changes - save to localStorage and reload balance
watch(accountIndexToDisplay, async (newIndex) => {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, String(newIndex));
  transactions.value = []; // Clear transactions on account change
  tokens.value = []; // Clear tokens on account change
  await loadBalance();
  loadTransactions();
  loadTokens();
});

const handleOpenUserMenu = () => {
  router.push({ path: "/usermenu" });
};

const handleSend = () => {
  router.push({ path: "/send" });
};

// Open wallet in full-page tab
const openFullPage = () => {
  const url = chrome.runtime.getURL("index.html");
  chrome.tabs.create({ url });
  window.close();
};

const copiedAddress = ref<string | null>(null);

const copyToClipboard = async (address: string) => {
  try {
    await navigator.clipboard.writeText(address);
    copiedAddress.value = address;
    setTimeout(() => {
      copiedAddress.value = null;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
};

const truncateAddress = (address: string) => {
  return address.slice(0, 7) + "..." + address.slice(-7);
};

// Receive modal state
const showReceiveModal = ref(false);
const receiveAddress = ref("");
const receiveType = ref("");

const openReceiveModal = (address: string, type: string) => {
  receiveAddress.value = address;
  receiveType.value = type;
  showReceiveModal.value = true;
};

const closeReceiveModal = () => {
  showReceiveModal.value = false;
};
</script>

<template>
  <section class="user-page">
    <div v-if="isLoading" class="loading">Loading accounts...</div>

    <template v-else>
      <div class="user-page-header">
        <div class="header-selects">
          <div class="account-controls">
            <button
              class="account-btn remove"
              @click="handleRemoveAccount"
              :disabled="accountCount <= 1 || isLoading"
              title="Quitar cuenta"
            >
              -
            </button>
            <select v-model="accountIndexToDisplay" class="account-select">
              <option v-for="(account, index) in userAccounts" :key="index" :value="index">
                {{ getDisplayName(index) }}
              </option>
            </select>
            <button
              class="account-btn add"
              @click="handleAddAccount"
              :disabled="accountCount >= 100 || isLoading"
              title="Agregar cuenta"
            >
              +
            </button>
          </div>
          <select v-model="selectedNetwork" class="network-select">
            <option v-for="(net, key) in NETWORKS" :key="key" :value="key">
              {{ net.name }}
            </option>
          </select>
        </div>
        <div class="header-actions">
          <button
            class="expand-btn"
            @click="openFullPage"
            title="Open in full page"
          >
            ⛶
          </button>
          <img
            class="laser-logo"
            @click="handleOpenUserMenu"
            src="/ironvault.png"
            width="30px"
            alt="laser-logo"
          />
        </div>
      </div>

      <div class="page-top">
        <div class="account-name-header">
          <h1 v-if="!isEditingName" @click="startEditName" class="editable-name" title="Click to rename">
            {{ currentAccountName }}
          </h1>
          <div v-else class="name-edit-container">
            <input
              v-model="editingName"
              type="text"
              class="name-input"
              maxlength="20"
              @keydown="handleNameKeydown"
              @blur="saveAccountName"
              ref="nameInputRef"
              autofocus
            />
          </div>
        </div>
        <small>STX Balance</small>
        <div class="value-display" :class="{ loading: isLoadingBalance }">
          {{ isLoadingBalance ? '...' : formattedStxBalance }} STX
        </div>
        <button class="refresh-btn" @click="refreshBalance" :disabled="isLoadingBalance">
          {{ isLoadingBalance ? '↻' : '↻ Refresh' }}
        </button>
      </div>

      <div class="page-bottom">
        <small>Assets (click to copy)</small>
        <div class="assets-display">
          <div class="assets-display-row">
            <span>STX</span>
            <span
              class="address-copy"
              :class="{ copied: copiedAddress === userAccounts[accountIndexToDisplay]?.stxAddress }"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.stxAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.stxAddress"
            >
              {{ copiedAddress === userAccounts[accountIndexToDisplay]?.stxAddress
                ? '✓ Copied!'
                : truncateAddress(userAccounts[accountIndexToDisplay]?.stxAddress || '') }}
            </span>
            <button
              class="qr-btn"
              @click="openReceiveModal(userAccounts[accountIndexToDisplay]?.stxAddress || '', 'STX')"
              title="Show QR code"
            >
              QR
            </button>
            <button
              class="send-btn"
              @click="handleSend"
              title="Send STX"
            >
              Send
            </button>
            <span class="balance-value">{{ formattedStxBalance }}</span>
          </div>
          <div class="assets-display-row">
            <span>BTC</span>
            <span
              class="address-copy"
              :class="{ copied: copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2PKHAddress }"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.btcP2PKHAddress"
            >
              {{ copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2PKHAddress
                ? '✓ Copied!'
                : truncateAddress(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '') }}
            </span>
            <button
              class="qr-btn"
              @click="openReceiveModal(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '', 'BTC')"
              title="Show QR code"
            >
              QR
            </button>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>Runes</span>
            <span
              class="address-copy"
              :class="{ copied: copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2TRAddress }"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.btcP2TRAddress"
            >
              {{ copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2TRAddress
                ? '✓ Copied!'
                : truncateAddress(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '') }}
            </span>
            <button
              class="qr-btn"
              @click="openReceiveModal(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '', 'Taproot')"
              title="Show QR code"
            >
              QR
            </button>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>Ordinals</span>
            <span
              class="address-copy"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.btcP2TRAddress"
            >
              {{ truncateAddress(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '') }}
            </span>
            <button
              class="qr-btn"
              @click="openReceiveModal(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '', 'Ordinals')"
              title="Show QR code"
            >
              QR
            </button>
            <span>0</span>
          </div>
        </div>
      </div>

      <!-- SIP-010 Tokens Section -->
      <div class="page-bottom tokens-section">
        <div class="tokens-header">
          <small>Tokens ({{ tokens.length }})</small>
          <button
            v-if="tokens.length > 0 || isLoadingTokens"
            class="toggle-tokens-btn"
            @click="showTokens = !showTokens"
          >
            {{ showTokens ? 'Hide' : 'Show' }}
          </button>
        </div>

        <div v-if="showTokens">
          <div v-if="isLoadingTokens" class="tokens-loading">
            Loading tokens...
          </div>

          <div v-else-if="tokens.length === 0" class="tokens-empty">
            No tokens found
          </div>

          <div v-else class="tokens-list">
            <div
              v-for="token in tokens"
              :key="token.contractId"
              class="token-item"
              :title="token.contractId"
            >
              <div class="token-icon">
                <img
                  v-if="token.imageUri"
                  :src="token.imageUri"
                  :alt="token.symbol"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <span v-else class="token-icon-fallback">{{ token.symbol.charAt(0) }}</span>
              </div>
              <div class="token-info">
                <span class="token-symbol">{{ token.symbol }}</span>
                <span class="token-name">{{ token.name }}</span>
              </div>
              <span class="token-balance">{{ token.formattedBalance }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction History -->
      <div class="page-bottom tx-section">
        <div class="tx-header">
          <small>Recent Activity</small>
          <button
            v-if="transactions.length > 5"
            class="show-all-btn"
            @click="showAllTx = !showAllTx"
          >
            {{ showAllTx ? 'Show Less' : 'Show All' }}
          </button>
        </div>

        <div v-if="isLoadingTx" class="tx-loading">
          Loading transactions...
        </div>

        <div v-else-if="transactions.length === 0" class="tx-empty">
          No transactions yet
        </div>

        <div v-else class="tx-list">
          <div
            v-for="tx in (showAllTx ? transactions : transactions.slice(0, 5))"
            :key="tx.txId"
            class="tx-item"
            @click="openExplorer(tx.txId)"
            :title="'View on Explorer: ' + tx.txId"
          >
            <div class="tx-icon" :class="getStatusClass(tx.status)">
              <span v-if="tx.type === 'token_transfer'">
                {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? '↑' : '↓' }}
              </span>
              <span v-else-if="tx.type === 'contract_call'">⚡</span>
              <span v-else-if="tx.type === 'smart_contract'">📄</span>
              <span v-else>•</span>
            </div>

            <div class="tx-details">
              <div class="tx-type">
                {{ getTransactionTypeLabel(tx.type) }}
                <span v-if="tx.functionName" class="tx-function">
                  .{{ tx.functionName }}
                </span>
              </div>
              <div class="tx-meta">
                <span v-if="tx.type === 'token_transfer' && tx.recipient">
                  {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress
                    ? 'To: ' + truncateTxAddress(tx.recipient, 4)
                    : 'From: ' + truncateTxAddress(tx.sender, 4) }}
                </span>
                <span v-else-if="tx.contractId">
                  {{ truncateTxAddress(tx.contractId.split('.')[0], 4) }}.{{ tx.contractId.split('.')[1] }}
                </span>
                <span class="tx-time">{{ formatRelativeTime(tx.timestamp) }}</span>
              </div>
            </div>

            <div class="tx-amount" v-if="tx.amount">
              <span :class="tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? 'amount-out' : 'amount-in'">
                {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? '-' : '+' }}{{ formatAmount(tx.amount) }}
              </span>
              <small>STX</small>
            </div>

            <div class="tx-status" :class="getStatusClass(tx.status)">
              {{ tx.status === 'success' ? '✓' : tx.status === 'pending' ? '⏳' : '✗' }}
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- Receive Modal -->
    <ReceiveModal
      :visible="showReceiveModal"
      :address="receiveAddress"
      :type="receiveType"
      @close="closeReceiveModal"
    />
  </section>
</template>

<style scoped>
select {
  cursor: pointer;
  border: 1px solid var(--color-border);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  font-family: var(--font-family);
}

small {
  color: var(--color-text-muted);
}

.laser-logo {
  cursor: pointer;
  border-radius: 50%;
}

.assets-display-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  font-family: var(--font-mono);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
}

.assets-display {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.value-display {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-mono);
  color: var(--color-text-primary);
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
}

.address-copy {
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 2px var(--space-sm);
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
}

.address-copy:hover {
  background: var(--color-accent-primary-muted);
  color: var(--color-accent-primary);
}

.address-copy.copied {
  color: var(--color-success);
  background: var(--color-success-muted);
}

.header-selects {
  display: flex;
  gap: var(--space-sm);
  align-items: center;
}

.account-controls {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.account-btn {
  width: 28px;
  height: 28px;
  border: 1px solid var(--color-border);
  background: transparent;
  color: var(--color-accent-primary);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 1rem;
  font-weight: var(--font-weight-bold);
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.account-btn:hover:not(:disabled) {
  background: var(--color-accent-primary-muted);
  border-color: var(--color-accent-primary);
}

.account-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.account-btn.add:hover:not(:disabled) {
  color: var(--color-success);
  border-color: var(--color-success);
  background: var(--color-success-muted);
}

.account-btn.remove:hover:not(:disabled) {
  color: var(--color-error);
  border-color: var(--color-error);
  background: var(--color-error-muted);
}

/* Account name editing */
.account-name-header {
  min-height: 2.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.editable-name {
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
}

.editable-name:hover {
  background: var(--color-accent-primary-muted);
}

.editable-name::after {
  content: " \270E";
  font-size: 0.7em;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.editable-name:hover::after {
  opacity: 0.5;
}

.name-edit-container {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.name-input {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  text-align: center;
  background: var(--color-bg-card);
  border: 2px solid var(--color-accent-primary);
  border-radius: var(--radius-lg);
  color: var(--color-text-primary);
  padding: var(--space-xs) var(--space-md);
  width: 180px;
  outline: none;
  height: auto;
}

.name-input:focus {
  background: var(--color-bg-elevated);
}

.account-select {
  font-size: var(--font-size-sm);
}

.network-select {
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-accent-primary-muted);
  border-radius: var(--radius-sm);
  color: var(--color-accent-primary);
  border: 1px solid var(--color-accent-primary);
}

.refresh-btn {
  margin-top: var(--space-sm);
  padding: var(--space-xs) var(--space-md);
  font-size: var(--font-size-xs);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  color: var(--color-accent-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  width: auto;
}

.refresh-btn:hover:not(:disabled) {
  background: var(--color-accent-primary-muted);
  border-color: var(--color-accent-primary);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.value-display.loading {
  opacity: 0.5;
}

.balance-value {
  color: var(--color-success);
  font-weight: var(--font-weight-bold);
}

/* Transaction History Styles */
.tx-section {
  margin-top: var(--space-lg);
}

.tx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.show-all-btn {
  background: transparent;
  border: none;
  color: var(--color-accent-primary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  text-decoration: none;
  width: auto;
}

.show-all-btn:hover {
  color: var(--color-accent-primary-hover);
}

.tx-loading,
.tx-empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-xl);
  font-size: var(--font-size-sm);
}

.tx-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-height: 300px;
  overflow-y: auto;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tx-item:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card-hover);
}

.tx-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 1rem;
  flex-shrink: 0;
}

.tx-icon.tx-success {
  background: var(--color-success-muted);
  color: var(--color-success);
}

.tx-icon.tx-pending {
  background: var(--color-warning-muted);
  color: var(--color-warning);
}

.tx-icon.tx-failed {
  background: var(--color-error-muted);
  color: var(--color-error);
}

.tx-details {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.tx-type {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-function {
  color: var(--color-accent-primary);
  font-weight: var(--font-weight-normal);
  font-size: var(--font-size-xs);
}

.tx-meta {
  display: flex;
  gap: var(--space-sm);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.tx-time {
  color: var(--color-text-muted);
}

.tx-amount {
  text-align: right;
  flex-shrink: 0;
}

.tx-amount span {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.tx-amount small {
  display: block;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.amount-in {
  color: var(--color-success);
}

.amount-out {
  color: var(--color-error);
}

.tx-status {
  width: 20px;
  text-align: center;
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.tx-status.tx-success {
  color: var(--color-success);
}

.tx-status.tx-pending {
  color: var(--color-warning);
}

.tx-status.tx-failed {
  color: var(--color-error);
}

/* Header actions (expand + menu) */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.expand-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.expand-btn:hover {
  background: var(--color-bg-card);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

/* QR button in assets rows */
.qr-btn {
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  width: auto;
}

.qr-btn:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.send-btn {
  padding: var(--space-xs) var(--space-sm);
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-bg-primary);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  width: auto;
}

.send-btn:hover {
  background: var(--color-accent-primary-hover);
}

/* Tokens Section Styles */
.tokens-section {
  margin-top: var(--space-lg);
}

.tokens-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-md);
}

.toggle-tokens-btn {
  background: transparent;
  border: none;
  color: var(--color-accent-primary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  text-decoration: none;
  width: auto;
}

.toggle-tokens-btn:hover {
  color: var(--color-accent-primary-hover);
}

.tokens-loading,
.tokens-empty {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-lg);
  font-size: var(--font-size-sm);
}

.tokens-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.token-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.token-item:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card-hover);
}

.token-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent-primary-muted);
  flex-shrink: 0;
}

.token-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-icon-fallback {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-accent-primary);
  text-transform: uppercase;
}

.token-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.token-symbol {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.token-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.token-balance {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-success);
  flex-shrink: 0;
}
</style>
