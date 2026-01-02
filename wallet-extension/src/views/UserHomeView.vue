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
  formatStxBalance,
  microStxToStx,
  formatUsdValue,
} from "../utils/balance";
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
function loadAccountNames() {
  const names: Record<number, string> = {};
  for (let i = 0; i < accountCount.value; i++) {
    const customName = getAccountName(i);
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
function saveAccountName() {
  const trimmed = editingName.value.trim();
  if (trimmed && trimmed !== `Account ${accountIndexToDisplay.value + 1}`) {
    setAccountName(accountIndexToDisplay.value, trimmed);
    accountNames.value[accountIndexToDisplay.value] = trimmed;
  } else {
    // Clear custom name if empty or same as default
    setAccountName(accountIndexToDisplay.value, "");
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
  const newCount = addAccount();
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

  const newCount = removeLastAccount();
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
  await loadTransactions();
}

onBeforeMount(async () => {
  // Load account settings
  accountCount.value = getAccountCount();
  loadAccountNames();

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
      // Load balance and transactions after accounts are loaded
      await loadBalance();
      loadTransactions(); // Don't await, load in background
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
  if (currentMnemonic.value) {
    await loadAccounts(currentMnemonic.value, newNetwork);
    await loadBalance();
    loadTransactions();
  }
});

// Watch for account index changes - save to localStorage and reload balance
watch(accountIndexToDisplay, async (newIndex) => {
  localStorage.setItem(ACCOUNT_STORAGE_KEY, String(newIndex));
  transactions.value = []; // Clear transactions on account change
  await loadBalance();
  loadTransactions();
});

const handleOpenUserMenu = () => {
  router.push({ path: "/usermenu" });
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
        <img
          class="laser-logo"
          @click="handleOpenUserMenu"
          src="/ironvault.png"
          width="30px"
          alt="laser-logo"
        />
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
            <span>0</span>
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
  </section>
</template>

<style scoped>
select {
  cursor: pointer;
  border: none;
  background: transparent;
  color: inherit;
}

small {
  color: #8c877d;
}

.laser-logo {
  cursor: pointer;
}

.assets-display-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-family: monospace;
}

.assets-display {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  row-gap: 10px;
}

.value-display {
  font-size: 3rem;
  font-weight: bolder;
  font-family: monospace;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
}

.address-copy {
  cursor: pointer;
  transition: all 0.2s;
  padding: 2px 6px;
  border-radius: 4px;
}

.address-copy:hover {
  background: rgba(100, 108, 255, 0.2);
  color: #646cff;
}

.address-copy.copied {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.header-selects {
  display: flex;
  gap: 8px;
  align-items: center;
}

.account-controls {
  display: flex;
  align-items: center;
  gap: 4px;
}

.account-btn {
  width: 24px;
  height: 24px;
  border: 1px solid rgba(100, 108, 255, 0.3);
  background: transparent;
  color: #646cff;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.account-btn:hover:not(:disabled) {
  background: rgba(100, 108, 255, 0.2);
  border-color: #646cff;
}

.account-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.account-btn.add:hover:not(:disabled) {
  color: #4ade80;
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.account-btn.remove:hover:not(:disabled) {
  color: #f87171;
  border-color: #f87171;
  background: rgba(248, 113, 113, 0.1);
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
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.2s;
  margin: 0;
}

.editable-name:hover {
  background: rgba(100, 108, 255, 0.15);
}

.editable-name::after {
  content: " \270E";
  font-size: 0.7em;
  opacity: 0;
  transition: opacity 0.2s;
}

.editable-name:hover::after {
  opacity: 0.5;
}

.name-edit-container {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-input {
  font-size: 1.5rem;
  font-weight: bold;
  text-align: center;
  background: rgba(100, 108, 255, 0.1);
  border: 2px solid #646cff;
  border-radius: 8px;
  color: #fff;
  padding: 4px 12px;
  width: 180px;
  outline: none;
}

.name-input:focus {
  background: rgba(100, 108, 255, 0.2);
}

.account-select {
  font-size: 0.9rem;
}

.network-select {
  font-size: 0.75rem;
  padding: 2px 4px;
  background: rgba(100, 108, 255, 0.2);
  border-radius: 4px;
  color: #646cff;
}

.refresh-btn {
  margin-top: 8px;
  padding: 4px 12px;
  font-size: 0.75rem;
  background: transparent;
  border: 1px solid rgba(100, 108, 255, 0.3);
  border-radius: 4px;
  color: #646cff;
  cursor: pointer;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(100, 108, 255, 0.1);
  border-color: #646cff;
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.value-display.loading {
  opacity: 0.5;
}

.balance-value {
  color: #4ade80;
  font-weight: bold;
}

/* Transaction History Styles */
.tx-section {
  margin-top: 16px;
}

.tx-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.show-all-btn {
  background: transparent;
  border: none;
  color: #646cff;
  font-size: 0.75rem;
  cursor: pointer;
  text-decoration: underline;
}

.show-all-btn:hover {
  color: #535bf2;
}

.tx-loading,
.tx-empty {
  text-align: center;
  color: #8c877d;
  padding: 20px;
  font-size: 0.85rem;
}

.tx-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}

.tx-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
  background: rgba(100, 108, 255, 0.05);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.tx-item:hover {
  background: rgba(100, 108, 255, 0.12);
}

.tx-icon {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-size: 1rem;
  flex-shrink: 0;
}

.tx-icon.tx-success {
  background: rgba(74, 222, 128, 0.15);
  color: #4ade80;
}

.tx-icon.tx-pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.tx-icon.tx-failed {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
}

.tx-details {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.tx-type {
  font-size: 0.85rem;
  font-weight: 500;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tx-function {
  color: #646cff;
  font-weight: normal;
  font-size: 0.8rem;
}

.tx-meta {
  display: flex;
  gap: 8px;
  font-size: 0.75rem;
  color: #8c877d;
  margin-top: 2px;
}

.tx-time {
  color: #6b6b6b;
}

.tx-amount {
  text-align: right;
  flex-shrink: 0;
}

.tx-amount span {
  font-family: monospace;
  font-size: 0.9rem;
  font-weight: 600;
}

.tx-amount small {
  display: block;
  font-size: 0.65rem;
  color: #6b6b6b;
}

.amount-in {
  color: #4ade80;
}

.amount-out {
  color: #f87171;
}

.tx-status {
  width: 20px;
  text-align: center;
  font-size: 0.85rem;
  flex-shrink: 0;
}

.tx-status.tx-success {
  color: #4ade80;
}

.tx-status.tx-pending {
  color: #fbbf24;
}

.tx-status.tx-failed {
  color: #f87171;
}
</style>
