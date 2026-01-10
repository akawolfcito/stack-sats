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
  getAccountName,
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
import SegmentedTabs from "../components/SegmentedTabs.vue";
import BalanceHeader from "../components/BalanceHeader.vue";

const router = useRouter();

// Tab state for navigation (unified for popup and panel)
const activeTab = ref<'assets' | 'activity'>('assets');
const tabItems = [
  { key: 'assets', label: 'Assets' },
  { key: 'activity', label: 'Activity' },
];

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
    case "success": return "bg-success-muted text-success";
    case "pending": return "bg-warning-muted text-warning";
    default: return "bg-error-muted text-error";
  }
}

function getStatusTextClass(status: TransactionStatus): string {
  switch (status) {
    case "success": return "text-success";
    case "pending": return "text-warning";
    default: return "text-error";
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

const openReceiveModal = () => {
  showReceiveModal.value = true;
};

const closeReceiveModal = () => {
  showReceiveModal.value = false;
};
</script>

<template>
  <section class="user-home-view">
    <!-- Ambient Glow -->
    <div class="ambient-glow"></div>

    <div v-if="isLoading" class="loading-state">Loading accounts...</div>

    <template v-else>
      <!-- Fixed Header Section (no scroll) -->
      <div class="home-header">
        <!-- Header -->
        <header class="header">
        <!-- Menu Button -->
        <button class="btn-icon header-btn menu-btn" @click="handleOpenUserMenu" title="Menu">
          <span class="menu-icon-text">☰</span>
        </button>

        <!-- Account Selector Pill -->
        <div class="account-pill" @click="toggleAccountDropdown">
          <div class="account-pill-dot"></div>
          <div class="account-pill-info">
            <span class="account-pill-label">{{ currentAccountName }}</span>
            <span class="account-pill-address">{{ truncateAddress(userAccounts[accountIndexToDisplay]?.stxAddress || '') }}</span>
          </div>
          <svg class="account-pill-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>

          <!-- Account Dropdown -->
          <div v-if="showAccountDropdown" class="account-dropdown">
            <div
              v-for="(account, index) in userAccounts"
              :key="index"
              class="account-dropdown-item"
              :class="{ 'active': index === accountIndexToDisplay }"
              @click.stop="selectAccount(index)"
            >
              <span class="account-dropdown-name">{{ getDisplayName(index) }}</span>
              <span class="account-dropdown-address">{{ truncateAddress(account.stxAddress) }}</span>
            </div>
            <div class="account-dropdown-footer">
              <button
                class="add-account-btn"
                @click.stop="handleAddAccount"
                :disabled="accountCount >= 100"
              >
                + Add Account
              </button>
            </div>
          </div>
        </div>

        <!-- Network Badge -->
        <div class="network-badge-wrapper" @click="toggleNetworkDropdown">
          <div
            class="network-badge"
            :class="{
              'network-testnet': selectedNetwork === 'testnet',
              'network-mainnet': selectedNetwork === 'mainnet',
              'network-devnet': selectedNetwork === 'devnet'
            }"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"/>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"/>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
              <line x1="12" y1="20" x2="12.01" y2="20"/>
            </svg>
          </div>

          <!-- Network Dropdown -->
          <div v-if="showNetworkDropdown" class="network-dropdown">
            <div
              v-for="(network, key) in NETWORKS"
              :key="key"
              class="network-dropdown-item"
              :class="{ 'active': key === selectedNetwork }"
              @click.stop="selectNetwork(key as NetworkName)"
            >
              <span>{{ network.name }}</span>
              <span v-if="key === selectedNetwork" class="checkmark">✓</span>
            </div>
          </div>
        </div>
      </header>

      <!-- Compact Balance Section -->
      <BalanceHeader
        :amount-text="isLoadingBalance ? '...' : shortBalance"
        symbol="STX"
        :usd-text="`${totalValueUsd || '$0.00'} USD`"
        :is-hidden="!showBalance"
        @toggle-hidden="toggleBalanceVisibility"
        @refresh="refreshBalance"
      />

      <!-- Action Buttons -->
      <section class="actions">
        <button class="action-btn action-btn-primary" @click="handleSend">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
          <span>Send</span>
        </button>
        <button class="action-btn action-btn-secondary" @click="openReceiveModal">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <polyline points="19 12 12 19 5 12"/>
          </svg>
          <span>Receive</span>
        </button>
      </section>

      <!-- Segmented Tabs (both modes - unified navigation) -->
      <div class="tabs-container">
        <SegmentedTabs
          v-model="activeTab"
          :items="tabItems"
        />
      </div>
      </div>

      <!-- Scrollable Body Section -->
      <div class="home-body">
        <!-- Assets Section (show when assets tab is active) -->
      <section v-if="activeTab === 'assets'" class="assets-section">
        <div class="section-header">
          <h2 class="section-title">Assets</h2>
          <button
            class="refresh-btn"
            @click="refreshBalance"
            :disabled="isLoadingBalance"
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" :class="{ 'animate-spin': isLoadingBalance }">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <div class="assets-grid">
          <!-- STX Card -->
          <div
            class="asset-card asset-card-stx"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.stxAddress || '')"
          >
            <div class="asset-card-glow asset-glow-purple"></div>
            <div class="asset-card-content">
              <div class="asset-card-header">
                <div class="asset-icon asset-icon-purple">S</div>
              </div>
              <div class="asset-card-body">
                <span class="asset-balance">{{ shortBalance }}</span>
                <span class="asset-name">Stacks</span>
              </div>
            </div>
          </div>

          <!-- BTC Card -->
          <div
            class="asset-card asset-card-btc"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '')"
          >
            <div class="asset-card-glow asset-glow-orange"></div>
            <div class="asset-card-content">
              <div class="asset-card-header">
                <div class="asset-icon asset-icon-orange">B</div>
              </div>
              <div class="asset-card-body">
                <span class="asset-balance">0.00</span>
                <span class="asset-name">Bitcoin</span>
              </div>
            </div>
          </div>

          <!-- Runes Card -->
          <div
            class="asset-card asset-card-runes"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
          >
            <div class="asset-card-glow asset-glow-pink"></div>
            <div class="asset-card-content">
              <div class="asset-card-header">
                <div class="asset-icon asset-icon-pink">R</div>
              </div>
              <div class="asset-card-body">
                <span class="asset-balance">0</span>
                <span class="asset-name">Runes</span>
              </div>
            </div>
          </div>

          <!-- Ordinals Card -->
          <div
            class="asset-card asset-card-ordinals"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
          >
            <div class="asset-card-glow asset-glow-yellow"></div>
            <div class="asset-card-content">
              <div class="asset-card-header">
                <div class="asset-icon asset-icon-yellow">O</div>
              </div>
              <div class="asset-card-body">
                <span class="asset-balance">0</span>
                <span class="asset-name">Inscriptions</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- SIP-010 Tokens Section (show when assets tab is active) -->
      <section v-if="activeTab === 'assets' && (tokens.length > 0 || isLoadingTokens)" class="tokens-section">
        <div class="section-header">
          <h2 class="section-title">Tokens <span class="token-count">({{ tokens.length }})</span></h2>
          <button class="toggle-btn" @click="showTokens = !showTokens">
            {{ showTokens ? 'Hide' : 'Show' }}
          </button>
        </div>

        <div v-if="showTokens">
          <div v-if="isLoadingTokens" class="empty-state">Loading tokens...</div>

          <div v-else-if="tokens.length === 0" class="empty-state">No tokens found</div>

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
                <span v-else>{{ token.symbol.charAt(0) }}</span>
              </div>
              <div class="token-info">
                <span class="token-symbol">{{ token.symbol }}</span>
                <span class="token-name">{{ token.name }}</span>
              </div>
              <span class="token-balance">{{ token.formattedBalance }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Transaction History (show when activity tab is active) -->
      <section v-if="activeTab === 'activity'" class="history-section">
        <div class="section-header">
          <h2 class="section-title">History</h2>
          <button v-if="transactions.length > 5" class="see-all-btn" @click="showAllTx = !showAllTx">
            {{ showAllTx ? 'Show Less' : 'See All' }}
          </button>
        </div>

        <div v-if="isLoadingTx" class="empty-state">Loading transactions...</div>

        <div v-else-if="transactions.length === 0" class="empty-state">No transactions yet</div>

        <div v-else class="tx-list">
          <div
            v-for="tx in (showAllTx ? transactions : transactions.slice(0, 5))"
            :key="tx.txId"
            class="tx-item"
            @click="openExplorer(tx.txId)"
            :title="'View on Explorer: ' + tx.txId"
          >
            <div class="tx-icon" :class="getStatusClass(tx.status)">
              <svg v-if="tx.type === 'token_transfer'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <path v-if="tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress" d="M7 17L17 7M17 7H7M17 7V17"/>
                <path v-else d="M17 7L7 17M7 17H17M7 17V7"/>
              </svg>
              <svg v-else-if="tx.type === 'contract_call'" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
              <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>

            <div class="tx-details">
              <span class="tx-type">
                {{ getTransactionTypeLabel(tx.type) }}
                <span v-if="tx.functionName" class="tx-function">.{{ tx.functionName }}</span>
              </span>
              <span class="tx-meta">
                <template v-if="tx.type === 'token_transfer' && tx.recipient">
                  {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress
                    ? 'To: ' + truncateTxAddress(tx.recipient, 4)
                    : 'From: ' + truncateTxAddress(tx.sender, 4) }}
                </template>
                <template v-else-if="tx.contractId">
                  {{ truncateTxAddress(tx.contractId.split('.')[0], 4) }}.{{ tx.contractId.split('.')[1] }}
                </template>
                <span class="tx-time">{{ formatRelativeTime(tx.timestamp) }}</span>
              </span>
            </div>

            <div v-if="tx.amount" class="tx-amount">
              <span :class="tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? 'amount-out' : 'amount-in'">
                {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? '-' : '+' }}{{ formatAmount(tx.amount) }} STX
              </span>
            </div>
          </div>
        </div>
      </section>
      </div>
    </template>

    <!-- Receive Modal -->
    <ReceiveModal
      :visible="showReceiveModal"
      :stx-address="userAccounts[accountIndexToDisplay]?.stxAddress || ''"
      :btc-p2-p-k-h-address="userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || ''"
      :btc-p2-t-r-address="userAccounts[accountIndexToDisplay]?.btcP2TRAddress || ''"
      @close="closeReceiveModal"
    />

    <!-- Bottom Navigation disabled - using SegmentedTabs in both modes -->
    <!-- <BottomNav @open-receive="openReceiveModal" /> -->
  </section>
</template>

<style scoped>
/* Base Layout */
.user-home-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #0a0a0a;
  position: relative;
  overflow: hidden;
}

/* Fixed Header - No scroll */
.home-header {
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}

/* Scrollable Body */
.home-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding-bottom: 24px; /* No BottomNav - using tabs */
}

/* Tabs Container */
.tabs-container {
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-md);
}

/* Ambient Glow */
.ambient-glow {
  position: absolute;
  top: -10%;
  left: -20%;
  width: 80%;
  height: 40%;
  background: var(--color-accent-primary);
  opacity: 0.05;
  filter: blur(100px);
  border-radius: 50%;
  pointer-events: none;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
}

/* Header */
.header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  padding-top: var(--space-xl);
  padding-bottom: var(--space-sm);
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

.header-btn:active {
  transform: scale(0.95);
}

/* Menu Icon */
.menu-icon-text {
  font-size: 20px;
  line-height: 1;
  color: #FFFFFF;
}

/* Account Pill */
.account-pill {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: #1a1a1a;
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: var(--space-sm) var(--space-md);
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  box-shadow: inset 1px 1px 0 0 rgba(255, 255, 255, 0.05);
}

.account-pill:active {
  transform: scale(0.95);
}

.account-pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.account-pill-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}

.account-pill-label {
  font-size: 10px;
  color: var(--color-text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.account-pill-address {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  font-family: monospace;
}

.account-pill-arrow {
  color: var(--color-text-muted);
}

/* Account Dropdown */
.account-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 240px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 100;
  overflow: hidden;
}

.account-dropdown-item {
  padding: var(--space-md);
  cursor: pointer;
  transition: background 0.15s ease;
  border-bottom: 1px solid var(--color-border);
}

.account-dropdown-item:last-of-type {
  border-bottom: none;
}

.account-dropdown-item:hover {
  background: var(--color-bg-card-hover);
}

.account-dropdown-item.active {
  background: rgba(232, 248, 89, 0.1);
}

.account-dropdown-name {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.account-dropdown-address {
  display: block;
  font-size: 12px;
  font-family: monospace;
  color: var(--color-text-muted);
  margin-top: 2px;
}

.account-dropdown-footer {
  padding: var(--space-sm);
  background: var(--color-bg-card);
  border-top: 1px solid var(--color-border);
}

.add-account-btn {
  width: 100%;
  padding: var(--space-sm);
  background: transparent;
  border: 1px dashed var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.add-account-btn:hover:not(:disabled) {
  background: var(--color-bg-card-hover);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.add-account-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

/* Network Badge */
.network-badge-wrapper {
  position: relative;
  cursor: pointer;
}

.network-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.network-badge.network-mainnet {
  color: var(--color-accent-primary);
}

.network-badge.network-testnet {
  color: var(--color-accent-primary);
}

.network-badge.network-devnet {
  color: var(--color-warning);
}

/* Network Dropdown */
.network-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 140px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  z-index: 100;
  overflow: hidden;
}

.network-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  cursor: pointer;
  transition: background 0.15s ease;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  text-transform: capitalize;
  border-bottom: 1px solid var(--color-border);
}

.network-dropdown-item:last-child {
  border-bottom: none;
}

.network-dropdown-item:hover {
  background: var(--color-bg-card-hover);
}

.network-dropdown-item.active {
  background: rgba(232, 248, 89, 0.1);
}

.checkmark {
  color: var(--color-accent-primary);
}

/* Balance Hero */
.balance-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl) var(--space-lg);
}

.balance-label {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  opacity: 0.6;
  margin-bottom: var(--space-xs);
}

.balance-label span {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.visibility-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.visibility-btn:hover {
  color: var(--color-text-secondary);
}

.balance-amount {
  display: flex;
  align-items: baseline;
  gap: var(--space-sm);
  margin: 0 0 var(--space-sm);
  transition: opacity 0.2s ease;
}

.balance-amount.loading {
  opacity: 0.5;
}

.balance-value {
  font-size: 48px;
  font-weight: 900;
  color: var(--color-accent-primary);
  letter-spacing: -0.02em;
  line-height: 1;
}

.balance-unit {
  font-size: 48px;
  font-weight: 900;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.balance-usd {
  display: inline-block;
  padding: var(--space-xs) var(--space-md);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 9999px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.balance-usd span {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* Action Buttons */
.actions {
  display: flex;
  gap: var(--space-md);
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-xl);
}

.action-btn {
  flex: 1;
  height: 56px;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
}

.action-btn:active {
  transform: scale(0.95);
}

.action-btn-primary {
  background: var(--color-accent-primary);
  color: #0a0a0a;
  box-shadow: 0 0 20px -5px rgba(232, 248, 89, 0.3);
}

.action-btn-primary:hover {
  filter: brightness(1.1);
}

.action-btn-secondary {
  background: #1a1a1a;
  color: var(--color-text-primary);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.action-btn-secondary:hover {
  background: rgba(255, 255, 255, 0.05);
}

/* Assets Section */
.assets-section {
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-xl);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.15s ease;
}

.refresh-btn:hover:not(:disabled) {
  color: var(--color-text-secondary);
  background: var(--color-bg-card);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Assets Grid */
.assets-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-md);
}

.asset-card {
  position: relative;
  overflow: hidden;
  background: #1a1a1a;
  padding: var(--space-md);
  border-radius: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: inset 1px 1px 0 0 rgba(255, 255, 255, 0.05);
}

.asset-card:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.asset-card:active {
  transform: scale(0.98);
}

.asset-card-glow {
  position: absolute;
  right: -16px;
  top: -16px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  filter: blur(24px);
  transition: all 0.3s ease;
}

.asset-card:hover .asset-card-glow {
  opacity: 1.5;
}

.asset-glow-purple {
  background: rgba(168, 85, 247, 0.15);
}

.asset-card-stx:hover {
  border-color: rgba(168, 85, 247, 0.3);
}

.asset-card-stx:hover .asset-glow-purple {
  background: rgba(168, 85, 247, 0.25);
}

.asset-glow-orange {
  background: rgba(249, 115, 22, 0.15);
}

.asset-card-btc:hover {
  border-color: rgba(249, 115, 22, 0.3);
}

.asset-card-btc:hover .asset-glow-orange {
  background: rgba(249, 115, 22, 0.25);
}

.asset-glow-pink {
  background: rgba(236, 72, 153, 0.15);
}

.asset-card-runes:hover {
  border-color: rgba(236, 72, 153, 0.3);
}

.asset-card-runes:hover .asset-glow-pink {
  background: rgba(236, 72, 153, 0.25);
}

.asset-glow-yellow {
  background: rgba(234, 179, 8, 0.15);
}

.asset-card-ordinals:hover {
  border-color: rgba(234, 179, 8, 0.3);
}

.asset-card-ordinals:hover .asset-glow-yellow {
  background: rgba(234, 179, 8, 0.25);
}

.asset-card-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  height: 100%;
  justify-content: space-between;
  gap: var(--space-md);
}

.asset-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.asset-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #0a0a0a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 16px;
}

.asset-icon-purple {
  color: #a855f7;
}

.asset-icon-orange {
  color: #f97316;
}

.asset-icon-pink {
  color: #ec4899;
}

.asset-icon-yellow {
  color: #eab308;
}

.asset-card-body {
  display: flex;
  flex-direction: column;
}

.asset-balance {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
}

.asset-name {
  font-size: 14px;
  color: var(--color-text-muted);
}

/* Tokens Section */
.tokens-section {
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-xl);
}

.token-count {
  font-weight: 400;
  color: var(--color-text-muted);
}

.toggle-btn,
.see-all-btn {
  background: transparent;
  border: none;
  color: var(--color-accent-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease;
}

.toggle-btn:hover,
.see-all-btn:hover {
  opacity: 0.8;
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
  background: #1a1a1a;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  transition: all 0.15s ease;
}

.token-item:hover {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
}

.token-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.token-icon img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.token-icon span {
  font-size: 14px;
  font-weight: 600;
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
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.token-name {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.token-balance {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-success);
  font-family: monospace;
  flex-shrink: 0;
}

/* History Section */
.history-section {
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-xl);
}

.empty-state {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-xl);
  font-size: 14px;
}

.tx-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
  max-height: 400px;
  overflow-y: auto;
}

.tx-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  background: #1a1a1a;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.15s ease;
}

.tx-item:hover {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.03);
}

.tx-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #2a2a2a;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.tx-icon.bg-success-muted {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-accent-primary);
}

.tx-icon.bg-warning-muted {
  background: rgba(234, 179, 8, 0.15);
  color: var(--color-warning);
}

.tx-icon.bg-error-muted {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
}

.tx-details {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: var(--space-md);
}

.tx-type {
  font-size: 14px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.tx-function {
  font-weight: 400;
  color: var(--color-accent-primary);
  font-size: 12px;
}

.tx-meta {
  font-size: 12px;
  color: var(--color-text-muted);
}

.tx-time {
  margin-left: var(--space-sm);
}

.tx-amount {
  text-align: right;
  flex-shrink: 0;
}

.tx-amount span {
  font-size: 14px;
  font-weight: 700;
  font-family: monospace;
}

.amount-in {
  color: var(--color-accent-primary);
}

.amount-out {
  color: var(--color-text-primary);
}

/* Spin animation */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
