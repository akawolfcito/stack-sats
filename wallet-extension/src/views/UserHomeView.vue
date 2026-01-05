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
import BottomNav from "../components/BottomNav.vue";

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

// Balance visibility state
const showBalance = ref(true);
const BALANCE_VISIBILITY_KEY = "balance_visibility";

// Load saved visibility preference
const savedVisibility = localStorage.getItem(BALANCE_VISIBILITY_KEY);
if (savedVisibility !== null) {
  showBalance.value = savedVisibility === "true";
}

const toggleBalanceVisibility = () => {
  showBalance.value = !showBalance.value;
  localStorage.setItem(BALANCE_VISIBILITY_KEY, String(showBalance.value));
};

// Computed properties for balance display
const formattedStxBalance = computed(() => formatStxBalance(stxBalanceMicro.value));
const stxBalanceNumber = computed(() => microStxToStx(stxBalanceMicro.value));

// Short balance format (2 decimals)
const shortBalance = computed(() => {
  const num = stxBalanceNumber.value;
  if (num === 0) return "0.00";
  if (num < 0.01) return num.toFixed(6);
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

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

// Account dropdown state
const showAccountDropdown = ref(false);

// Network dropdown state
const showNetworkDropdown = ref(false);

const toggleAccountDropdown = () => {
  showAccountDropdown.value = !showAccountDropdown.value;
  showNetworkDropdown.value = false; // Close network dropdown
};

const toggleNetworkDropdown = () => {
  showNetworkDropdown.value = !showNetworkDropdown.value;
  showAccountDropdown.value = false; // Close account dropdown
};

const selectNetwork = (network: NetworkName) => {
  selectedNetwork.value = network;
  showNetworkDropdown.value = false;
};

const selectAccount = (index: number) => {
  accountIndexToDisplay.value = index;
  showAccountDropdown.value = false;
};

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
        <button class="menu-btn" @click="handleOpenUserMenu" title="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <div class="account-info-header" @click="toggleAccountDropdown">
          <div class="account-name-row">
            <span class="header-account-name">{{ currentAccountName }}</span>
            <span class="dropdown-chevron">▼</span>
          </div>
          <span class="header-address">{{ truncateAddress(userAccounts[accountIndexToDisplay]?.stxAddress || '') }}</span>

          <!-- Account Dropdown -->
          <div v-if="showAccountDropdown" class="account-dropdown">
            <div
              v-for="(account, index) in userAccounts"
              :key="index"
              class="account-dropdown-item"
              :class="{ active: index === accountIndexToDisplay }"
              @click.stop="selectAccount(index)"
            >
              <span class="dropdown-account-name">{{ getDisplayName(index) }}</span>
              <span class="dropdown-account-address">{{ truncateAddress(account.stxAddress) }}</span>
            </div>
            <div class="account-dropdown-actions">
              <button
                class="dropdown-action-btn"
                @click.stop="handleAddAccount"
                :disabled="accountCount >= 100"
              >
                + Add Account
              </button>
            </div>
          </div>
        </div>

        <div class="header-right">
          <div class="network-selector" @click="toggleNetworkDropdown">
            <span class="network-badge" :class="selectedNetwork">
              {{ NETWORKS[selectedNetwork]?.name.toUpperCase() }}
            </span>

            <!-- Network Dropdown -->
            <div v-if="showNetworkDropdown" class="network-dropdown">
              <div
                v-for="(network, key) in NETWORKS"
                :key="key"
                class="network-dropdown-item"
                :class="{ active: key === selectedNetwork }"
                @click.stop="selectNetwork(key as NetworkName)"
              >
                <span class="network-name">{{ network.name }}</span>
                <span class="network-check" v-if="key === selectedNetwork">✓</span>
              </div>
            </div>
          </div>
          <button class="expand-btn" @click="openFullPage" title="Abrir en pestaña">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="15 3 21 3 21 9"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="balance-section">
        <div class="balance-label">
          <span>TOTAL BALANCE</span>
          <button class="visibility-toggle" @click="toggleBalanceVisibility" :title="showBalance ? 'Hide balance' : 'Show balance'">
            <svg v-if="showBalance" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
              <line x1="1" y1="1" x2="23" y2="23"/>
            </svg>
          </button>
        </div>
        <div class="balance-amount" :class="{ loading: isLoadingBalance }">
          <span class="balance-value">{{ showBalance ? (isLoadingBalance ? '...' : shortBalance) : '******' }}</span>
          <span class="balance-currency">STX</span>
        </div>
        <div class="balance-usd">
          {{ showBalance ? `≈ ${totalValueUsd || '$0.00'} USD` : '******' }}
        </div>

        <div class="balance-actions">
          <button class="action-btn-large send" @click="handleSend">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
            Send
          </button>
          <button class="action-btn-large receive" @click="openReceiveModal(userAccounts[accountIndexToDisplay]?.stxAddress || '', 'STX')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <polyline points="19 12 12 19 5 12"/>
            </svg>
            Receive
          </button>
        </div>
      </div>

      <div class="assets-section">
        <div class="assets-header">
          <span class="assets-title">Assets</span>
          <button class="refresh-icon-btn" @click="refreshBalance" :disabled="isLoadingBalance" title="Refresh">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ spinning: isLoadingBalance }">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <div class="assets-list">
          <!-- Stacks Card -->
          <div class="asset-card-new stx" @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.stxAddress || '')">
            <div class="asset-accent"></div>
            <div class="asset-icon-new">S</div>
            <div class="asset-details">
              <span class="asset-title">Stacks</span>
              <span class="asset-subtitle">STX • {{ NETWORKS[selectedNetwork]?.name }}</span>
            </div>
            <div class="asset-values">
              <span class="asset-amount">{{ shortBalance }}</span>
              <span class="asset-usd">{{ totalValueUsd || '$0.00' }}</span>
            </div>
          </div>

          <!-- Bitcoin Card -->
          <div class="asset-card-new btc" @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '')">
            <div class="asset-accent"></div>
            <div class="asset-icon-new">B</div>
            <div class="asset-details">
              <span class="asset-title">Bitcoin</span>
              <span class="asset-subtitle">BTC • Native Segwit</span>
            </div>
            <div class="asset-values">
              <span class="asset-amount">0.0000</span>
              <span class="asset-usd">$0.00</span>
            </div>
          </div>

          <!-- Runes Card -->
          <div class="asset-card-new runes" @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')">
            <div class="asset-accent"></div>
            <div class="asset-icon-new">R</div>
            <div class="asset-details">
              <span class="asset-title">Runes</span>
              <span class="asset-subtitle">Token • Etchings</span>
            </div>
            <div class="asset-values">
              <span class="asset-amount">0</span>
              <span class="asset-usd">$0.00</span>
            </div>
          </div>

          <!-- Ordinals Card -->
          <div class="asset-card-new ordinals" @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')">
            <div class="asset-accent"></div>
            <div class="asset-icon-new">O</div>
            <div class="asset-details">
              <span class="asset-title">Ordinals</span>
              <span class="asset-subtitle">NFT • Inscriptions</span>
            </div>
            <div class="asset-values">
              <span class="asset-badge">Collectibles</span>
            </div>
          </div>
        </div>

        <!-- Manage Token List Button -->
        <button class="manage-tokens-btn">
          <span>+</span> Manage Token List
        </button>
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

    <!-- Bottom Navigation -->
    <BottomNav @open-receive="openReceiveModal(userAccounts[accountIndexToDisplay]?.stxAddress || '', 'STX')" />
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

/* Section Title */
.section-title {
  display: block;
  margin-bottom: var(--space-md);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Asset Card Styles */
.asset-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.asset-card:hover {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card-hover);
}

.asset-left {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex: 1;
  min-width: 0;
}

.asset-right {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  flex-shrink: 0;
}

/* Asset Icon */
.asset-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-base);
  flex-shrink: 0;
}

.asset-icon.stx-icon {
  background: linear-gradient(135deg, #5546ff 0%, #7c3aed 100%);
  color: white;
}

.asset-icon.btc-icon {
  background: linear-gradient(135deg, #f7931a 0%, #ffb84d 100%);
  color: white;
}

.asset-icon.runes-icon {
  background: linear-gradient(135deg, #ec4899 0%, #f472b6 100%);
  color: white;
}

.asset-icon.ordinals-icon {
  background: linear-gradient(135deg, #eab308 0%, #fbbf24 100%);
  color: white;
}

/* Asset Info */
.asset-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.asset-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.asset-address {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
  padding: 2px var(--space-xs);
  margin-left: calc(-1 * var(--space-xs));
  border-radius: var(--radius-sm);
}

.asset-address:hover {
  background: var(--color-accent-primary-muted);
  color: var(--color-accent-primary);
}

.asset-address.copied {
  color: var(--color-success);
  background: var(--color-success-muted);
}

/* Asset Actions */
.asset-actions {
  display: flex;
  gap: var(--space-xs);
}

.action-btn {
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  width: auto;
  min-width: 40px;
}

.action-btn.qr {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-secondary);
}

.action-btn.qr:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.action-btn.send {
  background: var(--color-accent-primary);
  border: none;
  color: var(--color-bg-primary);
}

.action-btn.send:hover:not(.disabled) {
  background: var(--color-accent-primary-hover);
}

.action-btn.disabled {
  opacity: 0.4;
  cursor: not-allowed;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  color: var(--color-text-muted);
}

/* Asset Balance */
.asset-balance {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  min-width: 60px;
  text-align: right;
}

.asset-balance.has-balance {
  color: var(--color-success);
}

/* ========== NEW HEADER STYLES ========== */
.user-page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-md);
  padding: var(--space-md) 0;
  margin-bottom: var(--space-lg);
}

.menu-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
  flex-shrink: 0;
  color: var(--color-text-secondary);
}

.menu-btn:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.menu-btn svg {
  flex-shrink: 0;
}

.account-info-header {
  flex: 1;
  cursor: pointer;
  position: relative;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.account-info-header:hover {
  background: var(--color-bg-card);
}

.account-name-row {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
}

.header-account-name {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.dropdown-chevron {
  font-size: 8px;
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
}

.account-info-header:hover .dropdown-chevron {
  color: var(--color-text-secondary);
}

.header-address {
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-text-muted);
}

/* Account Dropdown */
.account-dropdown {
  position: absolute;
  top: calc(100% + var(--space-xs));
  left: 0;
  right: 0;
  min-width: 220px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.account-dropdown-item {
  padding: var(--space-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  border-bottom: 1px solid var(--color-border);
}

.account-dropdown-item:last-of-type {
  border-bottom: none;
}

.account-dropdown-item:hover {
  background: var(--color-bg-card-hover);
}

.account-dropdown-item.active {
  background: var(--color-accent-primary-muted);
}

.dropdown-account-name {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.dropdown-account-address {
  display: block;
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.account-dropdown-actions {
  padding: var(--space-sm);
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);
}

.dropdown-action-btn {
  width: 100%;
  padding: var(--space-sm);
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dropdown-action-btn:hover:not(:disabled) {
  background: var(--color-bg-card-hover);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.dropdown-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Header Right Section */
.header-right {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

/* Network Selector */
.network-selector {
  position: relative;
  cursor: pointer;
}

.network-badge {
  padding: var(--space-sm) var(--space-lg);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  letter-spacing: 1px;
  border-radius: var(--radius-md);
  text-transform: uppercase;
  transition: all var(--transition-fast);
}

.network-badge.testnet {
  background: rgba(190, 242, 100, 0.1);
  color: var(--color-accent-primary);
  border: 1.5px solid rgba(190, 242, 100, 0.4);
}

.network-badge.testnet:hover {
  background: rgba(190, 242, 100, 0.15);
  border-color: rgba(190, 242, 100, 0.6);
}

.network-badge.mainnet {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
  border: 1.5px solid rgba(34, 197, 94, 0.4);
}

.network-badge.mainnet:hover {
  background: rgba(34, 197, 94, 0.15);
  border-color: rgba(34, 197, 94, 0.6);
}

.network-badge.devnet {
  background: rgba(251, 191, 36, 0.1);
  color: var(--color-warning);
  border: 1.5px solid rgba(251, 191, 36, 0.4);
}

.network-badge.devnet:hover {
  background: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.6);
}

/* Network Dropdown */
.network-dropdown {
  position: absolute;
  top: calc(100% + var(--space-xs));
  right: 0;
  min-width: 140px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

.network-dropdown-item {
  padding: var(--space-md);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  transition: background var(--transition-fast);
  border-bottom: 1px solid var(--color-border);
}

.network-dropdown-item:last-child {
  border-bottom: none;
}

.network-dropdown-item:hover {
  background: var(--color-bg-card-hover);
}

.network-dropdown-item.active {
  background: var(--color-accent-primary-muted);
}

.network-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  text-transform: capitalize;
}

.network-check {
  color: var(--color-accent-primary);
  font-size: var(--font-size-sm);
}

.expand-btn {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.expand-btn:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  color: var(--color-text-primary);
}

.expand-btn svg {
  flex-shrink: 0;
}

/* ========== BALANCE SECTION STYLES ========== */
.balance-section {
  padding: var(--space-lg) 0;
  text-align: center;
  margin-bottom: var(--space-lg);
}

.balance-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.balance-label span {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  letter-spacing: 1.5px;
  text-transform: uppercase;
}

.visibility-toggle {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
  width: auto;
}

.visibility-toggle:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-card-hover);
}

.balance-amount {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-xs);
  min-height: 3.5rem;
}

.balance-amount.loading {
  opacity: 0.5;
}

.balance-value {
  font-size: 3rem;
  font-weight: var(--font-weight-bold);
  font-family: var(--font-mono);
  color: var(--color-text-primary);
  line-height: 1;
  letter-spacing: 2px;
}

.balance-currency {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
}

.balance-usd {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin-bottom: var(--space-xl);
  min-height: 1.25rem;
  letter-spacing: 1px;
}

.balance-actions {
  display: flex;
  gap: var(--space-md);
  justify-content: center;
}

.action-btn-large {
  flex: 1;
  max-width: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-xl);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn-large.send {
  background: var(--color-accent-primary);
  border: none;
  color: var(--color-bg-primary);
}

.action-btn-large.send:hover {
  background: var(--color-accent-primary-hover);
  transform: translateY(-1px);
}

.action-btn-large.receive {
  background: transparent;
  border: 1px solid var(--color-border);
  color: var(--color-text-primary);
}

.action-btn-large.receive:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
  transform: translateY(-1px);
}

.action-btn-large svg {
  flex-shrink: 0;
}

/* ========== ASSETS SECTION STYLES ========== */
.assets-section {
  margin-bottom: var(--space-xl);
}

.assets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-lg);
}

.assets-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.refresh-icon-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.refresh-icon-btn:hover:not(:disabled) {
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
}

.refresh-icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.refresh-icon-btn svg.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.assets-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

/* New Asset Card */
.asset-card-new {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  position: relative;
  overflow: hidden;
}

.asset-card-new:hover {
  background: var(--color-bg-card-hover);
  border-color: var(--color-border-hover);
}

.asset-card-new:active {
  transform: scale(0.99);
}

/* Left Accent Border */
.asset-accent {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;
  border-radius: var(--radius-md) 0 0 var(--radius-md);
}

.asset-card-new.stx .asset-accent {
  background: linear-gradient(180deg, #5546ff 0%, #7c3aed 100%);
}

.asset-card-new.btc .asset-accent {
  background: linear-gradient(180deg, #f7931a 0%, #ffb84d 100%);
}

.asset-card-new.runes .asset-accent {
  background: linear-gradient(180deg, #ec4899 0%, #f472b6 100%);
}

.asset-card-new.ordinals .asset-accent {
  background: linear-gradient(180deg, #eab308 0%, #fbbf24 100%);
}

/* Asset Icon */
.asset-icon-new {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
  flex-shrink: 0;
  margin-left: var(--space-sm);
}

.asset-card-new.stx .asset-icon-new {
  background: linear-gradient(135deg, rgba(85, 70, 255, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%);
  color: #7c3aed;
  border: 2px solid rgba(124, 58, 237, 0.3);
}

.asset-card-new.btc .asset-icon-new {
  background: linear-gradient(135deg, rgba(247, 147, 26, 0.2) 0%, rgba(255, 184, 77, 0.2) 100%);
  color: #f7931a;
  border: 2px solid rgba(247, 147, 26, 0.3);
}

.asset-card-new.runes .asset-icon-new {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(244, 114, 182, 0.2) 100%);
  color: #ec4899;
  border: 2px solid rgba(236, 72, 153, 0.3);
}

.asset-card-new.ordinals .asset-icon-new {
  background: linear-gradient(135deg, rgba(234, 179, 8, 0.2) 0%, rgba(251, 191, 36, 0.2) 100%);
  color: #eab308;
  border: 2px solid rgba(234, 179, 8, 0.3);
}

/* Asset Details */
.asset-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.asset-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.asset-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Asset Values */
.asset-values {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
}

.asset-amount {
  font-family: var(--font-mono);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.asset-usd {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.asset-badge {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-elevated);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
}

/* Manage Token List Button */
.manage-tokens-btn {
  width: 100%;
  padding: var(--space-md);
  margin-top: var(--space-md);
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
}

.manage-tokens-btn:hover {
  background: var(--color-bg-card);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.manage-tokens-btn span {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-light);
}
</style>
