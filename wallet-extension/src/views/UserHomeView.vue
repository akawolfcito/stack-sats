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
  <section class="h-full flex flex-col justify-start gap-6 pb-20">
    <div v-if="isLoading" class="flex items-center justify-center h-full text-text-muted">Loading accounts...</div>

    <template v-else>
      <!-- Header -->
      <div class="flex items-center justify-between gap-3 py-3 mb-4">
        <!-- Menu Button -->
        <button
          class="w-10 h-10 rounded-lg bg-bg-card border border-border-default cursor-pointer flex items-center justify-center transition-all duration-150 shrink-0 text-text-secondary hover:bg-bg-card-hover hover:border-border-hover hover:text-text-primary"
          @click="handleOpenUserMenu"
          title="Menu"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>

        <!-- Account Info -->
        <div class="flex-1 cursor-pointer relative py-1 px-2 rounded-lg transition-colors hover:bg-bg-card" @click="toggleAccountDropdown">
          <div class="flex items-center gap-1">
            <span class="text-base font-semibold text-text-primary">{{ currentAccountName }}</span>
            <span class="text-[8px] text-text-muted transition-transform">▼</span>
          </div>
          <span class="text-xs font-mono text-text-muted">{{ truncateAddress(userAccounts[accountIndexToDisplay]?.stxAddress || '') }}</span>

          <!-- Account Dropdown -->
          <div
            v-if="showAccountDropdown"
            class="absolute top-full left-0 right-0 mt-1 min-w-[220px] bg-bg-elevated border border-border-default rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[100] overflow-hidden"
          >
            <div
              v-for="(account, index) in userAccounts"
              :key="index"
              class="p-3 cursor-pointer transition-colors border-b border-border-default last:border-b-0 hover:bg-bg-card-hover"
              :class="{ 'bg-primary-muted': index === accountIndexToDisplay }"
              @click.stop="selectAccount(index)"
            >
              <span class="block text-sm font-medium text-text-primary">{{ getDisplayName(index) }}</span>
              <span class="block text-xs font-mono text-text-muted mt-0.5">{{ truncateAddress(account.stxAddress) }}</span>
            </div>
            <div class="p-2 bg-bg-card border-t border-border-default">
              <button
                class="w-full p-2 bg-transparent border border-dashed border-border-default rounded-sm text-text-secondary text-sm cursor-pointer transition-all hover:bg-bg-card-hover hover:border-primary hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                @click.stop="handleAddAccount"
                :disabled="accountCount >= 100"
              >
                + Add Account
              </button>
            </div>
          </div>
        </div>

        <!-- Header Right -->
        <div class="flex items-center gap-2">
          <!-- Network Selector -->
          <div class="relative cursor-pointer" @click="toggleNetworkDropdown">
            <span
              class="py-2 px-4 text-xs font-bold tracking-wider rounded-lg uppercase transition-all"
              :class="{
                'bg-primary/10 text-primary border-[1.5px] border-primary/40 hover:bg-primary/15 hover:border-primary/60': selectedNetwork === 'testnet',
                'bg-success/10 text-success border-[1.5px] border-success/40 hover:bg-success/15 hover:border-success/60': selectedNetwork === 'mainnet',
                'bg-warning/10 text-warning border-[1.5px] border-warning/40 hover:bg-warning/15 hover:border-warning/60': selectedNetwork === 'devnet'
              }"
            >
              {{ NETWORKS[selectedNetwork]?.name.toUpperCase() }}
            </span>

            <!-- Network Dropdown -->
            <div
              v-if="showNetworkDropdown"
              class="absolute top-full right-0 mt-1 min-w-[140px] bg-bg-elevated border border-border-default rounded-lg shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-[100] overflow-hidden"
            >
              <div
                v-for="(network, key) in NETWORKS"
                :key="key"
                class="p-3 cursor-pointer flex items-center justify-between transition-colors border-b border-border-default last:border-b-0 hover:bg-bg-card-hover"
                :class="{ 'bg-primary-muted': key === selectedNetwork }"
                @click.stop="selectNetwork(key as NetworkName)"
              >
                <span class="text-sm font-medium text-text-primary capitalize">{{ network.name }}</span>
                <span v-if="key === selectedNetwork" class="text-primary text-sm">✓</span>
              </div>
            </div>
          </div>

          <!-- Expand Button -->
          <button
            class="w-10 h-10 rounded-lg bg-bg-card border border-border-default cursor-pointer flex items-center justify-center text-text-secondary transition-all hover:bg-bg-card-hover hover:border-border-hover hover:text-text-primary"
            @click="openFullPage"
            title="Abrir en pestaña"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <polyline points="15 3 21 3 21 9"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </button>
        </div>
      </div>

      <!-- Balance Section -->
      <div class="py-4 text-center mb-4">
        <div class="flex items-center justify-center gap-2 mb-3">
          <span class="text-xs font-medium text-text-muted tracking-widest uppercase">TOTAL BALANCE</span>
          <button
            class="bg-transparent border-none p-1 cursor-pointer text-text-muted flex items-center justify-center rounded-sm transition-all w-auto hover:text-text-secondary hover:bg-bg-card-hover"
            @click="toggleBalanceVisibility"
            :title="showBalance ? 'Hide balance' : 'Show balance'"
          >
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

        <div class="flex items-baseline justify-center gap-2 mb-1 min-h-14" :class="{ 'opacity-50': isLoadingBalance }">
          <span class="text-5xl font-bold font-mono text-text-primary leading-none tracking-wider">{{ showBalance ? (isLoadingBalance ? '...' : shortBalance) : '******' }}</span>
          <span class="text-xl font-medium text-text-muted">STX</span>
        </div>

        <div class="text-sm text-text-muted mb-6 min-h-5 tracking-wider">
          {{ showBalance ? `≈ ${totalValueUsd || '$0.00'} USD` : '******' }}
        </div>

        <div class="flex gap-3 justify-center">
          <button
            class="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-3 px-6 text-base font-semibold rounded-full cursor-pointer transition-all bg-primary border-none text-bg-primary hover:bg-primary-hover hover:-translate-y-0.5"
            @click="handleSend"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
            Send
          </button>
          <button
            class="flex-1 max-w-[160px] flex items-center justify-center gap-2 py-3 px-6 text-base font-semibold rounded-full cursor-pointer transition-all bg-transparent border border-border-default text-text-primary hover:bg-bg-card-hover hover:border-border-hover hover:-translate-y-0.5"
            @click="openReceiveModal(userAccounts[accountIndexToDisplay]?.stxAddress || '', 'STX')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <polyline points="19 12 12 19 5 12"/>
            </svg>
            Receive
          </button>
        </div>
      </div>

      <!-- Assets Section -->
      <div class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <span class="text-base font-semibold text-text-primary">Assets</span>
          <button
            class="w-8 h-8 p-0 bg-transparent border-none cursor-pointer text-text-muted flex items-center justify-center rounded-sm transition-all hover:text-text-secondary hover:bg-bg-card disabled:opacity-50 disabled:cursor-not-allowed"
            @click="refreshBalance"
            :disabled="isLoadingBalance"
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'animate-spin': isLoadingBalance }">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>

        <div class="flex flex-col gap-2">
          <!-- Stacks Card -->
          <div
            class="flex items-center gap-3 p-4 bg-bg-card border border-border-default rounded-lg cursor-pointer transition-all relative overflow-hidden hover:bg-bg-card-hover hover:border-border-hover active:scale-[0.99]"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.stxAddress || '')"
          >
            <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-gradient-to-b from-[#5546ff] to-[#7c3aed]"></div>
            <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ml-2 bg-gradient-to-br from-[#5546ff]/20 to-[#7c3aed]/20 text-[#7c3aed] border-2 border-[#7c3aed]/30">S</div>
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="text-base font-semibold text-text-primary">Stacks</span>
              <span class="text-xs text-text-muted">STX • {{ NETWORKS[selectedNetwork]?.name }}</span>
            </div>
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="font-mono text-base font-semibold text-text-primary">{{ shortBalance }}</span>
              <span class="text-xs text-text-muted">{{ totalValueUsd || '$0.00' }}</span>
            </div>
          </div>

          <!-- Bitcoin Card -->
          <div
            class="flex items-center gap-3 p-4 bg-bg-card border border-border-default rounded-lg cursor-pointer transition-all relative overflow-hidden hover:bg-bg-card-hover hover:border-border-hover active:scale-[0.99]"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '')"
          >
            <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-gradient-to-b from-[#f7931a] to-[#ffb84d]"></div>
            <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ml-2 bg-gradient-to-br from-[#f7931a]/20 to-[#ffb84d]/20 text-[#f7931a] border-2 border-[#f7931a]/30">B</div>
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="text-base font-semibold text-text-primary">Bitcoin</span>
              <span class="text-xs text-text-muted">BTC • Native Segwit</span>
            </div>
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="font-mono text-base font-semibold text-text-primary">0.0000</span>
              <span class="text-xs text-text-muted">$0.00</span>
            </div>
          </div>

          <!-- Runes Card -->
          <div
            class="flex items-center gap-3 p-4 bg-bg-card border border-border-default rounded-lg cursor-pointer transition-all relative overflow-hidden hover:bg-bg-card-hover hover:border-border-hover active:scale-[0.99]"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
          >
            <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-gradient-to-b from-[#ec4899] to-[#f472b6]"></div>
            <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ml-2 bg-gradient-to-br from-[#ec4899]/20 to-[#f472b6]/20 text-[#ec4899] border-2 border-[#ec4899]/30">R</div>
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="text-base font-semibold text-text-primary">Runes</span>
              <span class="text-xs text-text-muted">Token • Etchings</span>
            </div>
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="font-mono text-base font-semibold text-text-primary">0</span>
              <span class="text-xs text-text-muted">$0.00</span>
            </div>
          </div>

          <!-- Ordinals Card -->
          <div
            class="flex items-center gap-3 p-4 bg-bg-card border border-border-default rounded-lg cursor-pointer transition-all relative overflow-hidden hover:bg-bg-card-hover hover:border-border-hover active:scale-[0.99]"
            @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
          >
            <div class="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg bg-gradient-to-b from-[#eab308] to-[#fbbf24]"></div>
            <div class="w-11 h-11 rounded-full flex items-center justify-center font-bold text-lg shrink-0 ml-2 bg-gradient-to-br from-[#eab308]/20 to-[#fbbf24]/20 text-[#eab308] border-2 border-[#eab308]/30">O</div>
            <div class="flex-1 min-w-0 flex flex-col gap-0.5">
              <span class="text-base font-semibold text-text-primary">Ordinals</span>
              <span class="text-xs text-text-muted">NFT • Inscriptions</span>
            </div>
            <div class="flex flex-col items-end gap-0.5 shrink-0">
              <span class="text-xs font-medium text-text-secondary bg-bg-elevated py-1 px-2 rounded-sm">Collectibles</span>
            </div>
          </div>
        </div>

        <!-- Manage Token List Button -->
        <button class="w-full p-3 mt-3 bg-transparent border border-dashed border-border-default rounded-lg text-text-muted text-sm cursor-pointer transition-all flex items-center justify-center gap-2 hover:bg-bg-card hover:border-primary hover:text-primary">
          <span class="text-lg font-light">+</span> Manage Token List
        </button>
      </div>

      <!-- SIP-010 Tokens Section -->
      <div class="w-full flex flex-col items-center justify-start gap-4 mt-4">
        <div class="flex justify-between items-center w-full mb-3">
          <small class="text-text-muted text-xs uppercase tracking-wider">Tokens ({{ tokens.length }})</small>
          <button
            v-if="tokens.length > 0 || isLoadingTokens"
            class="bg-transparent border-none text-primary text-xs cursor-pointer w-auto hover:text-primary-hover"
            @click="showTokens = !showTokens"
          >
            {{ showTokens ? 'Hide' : 'Show' }}
          </button>
        </div>

        <div v-if="showTokens" class="w-full">
          <div v-if="isLoadingTokens" class="text-center text-text-muted py-6 text-sm">
            Loading tokens...
          </div>

          <div v-else-if="tokens.length === 0" class="text-center text-text-muted py-4 text-sm">
            No tokens found
          </div>

          <div v-else class="flex flex-col gap-2">
            <div
              v-for="token in tokens"
              :key="token.contractId"
              class="flex items-center gap-3 p-3 bg-bg-card border border-border-default rounded-lg transition-all hover:border-border-hover hover:bg-bg-card-hover"
              :title="token.contractId"
            >
              <div class="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center bg-primary-muted shrink-0">
                <img
                  v-if="token.imageUri"
                  :src="token.imageUri"
                  :alt="token.symbol"
                  class="w-full h-full object-cover"
                  @error="($event.target as HTMLImageElement).style.display = 'none'"
                />
                <span v-else class="text-sm font-semibold text-primary uppercase">{{ token.symbol.charAt(0) }}</span>
              </div>
              <div class="flex-1 min-w-0 flex flex-col gap-0.5">
                <span class="text-sm font-semibold text-text-primary">{{ token.symbol }}</span>
                <span class="text-xs text-text-muted whitespace-nowrap overflow-hidden text-ellipsis">{{ token.name }}</span>
              </div>
              <span class="font-mono text-sm font-semibold text-success shrink-0">{{ token.formattedBalance }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Transaction History -->
      <div class="w-full flex flex-col items-center justify-start gap-4 mt-4">
        <div class="flex justify-between items-center w-full mb-3">
          <small class="text-text-muted text-xs uppercase tracking-wider">Recent Activity</small>
          <button
            v-if="transactions.length > 5"
            class="bg-transparent border-none text-primary text-xs cursor-pointer w-auto hover:text-primary-hover"
            @click="showAllTx = !showAllTx"
          >
            {{ showAllTx ? 'Show Less' : 'Show All' }}
          </button>
        </div>

        <div v-if="isLoadingTx" class="text-center text-text-muted py-6 text-sm w-full">
          Loading transactions...
        </div>

        <div v-else-if="transactions.length === 0" class="text-center text-text-muted py-4 text-sm w-full">
          No transactions yet
        </div>

        <div v-else class="flex flex-col gap-2 max-h-[300px] overflow-y-auto w-full">
          <div
            v-for="tx in (showAllTx ? transactions : transactions.slice(0, 5))"
            :key="tx.txId"
            class="flex items-center gap-3 p-3 bg-bg-card border border-border-default rounded-lg cursor-pointer transition-all hover:border-border-hover hover:bg-bg-card-hover"
            @click="openExplorer(tx.txId)"
            :title="'View on Explorer: ' + tx.txId"
          >
            <div class="w-9 h-9 flex items-center justify-center rounded-full text-base shrink-0" :class="getStatusClass(tx.status)">
              <span v-if="tx.type === 'token_transfer'">
                {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? '↑' : '↓' }}
              </span>
              <span v-else-if="tx.type === 'contract_call'">⚡</span>
              <span v-else-if="tx.type === 'smart_contract'">📄</span>
              <span v-else>•</span>
            </div>

            <div class="flex-1 min-w-0 overflow-hidden">
              <div class="text-sm font-medium text-text-primary whitespace-nowrap overflow-hidden text-ellipsis">
                {{ getTransactionTypeLabel(tx.type) }}
                <span v-if="tx.functionName" class="text-primary font-normal text-xs">
                  .{{ tx.functionName }}
                </span>
              </div>
              <div class="flex gap-2 text-xs text-text-muted mt-0.5">
                <span v-if="tx.type === 'token_transfer' && tx.recipient">
                  {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress
                    ? 'To: ' + truncateTxAddress(tx.recipient, 4)
                    : 'From: ' + truncateTxAddress(tx.sender, 4) }}
                </span>
                <span v-else-if="tx.contractId">
                  {{ truncateTxAddress(tx.contractId.split('.')[0], 4) }}.{{ tx.contractId.split('.')[1] }}
                </span>
                <span class="text-text-muted">{{ formatRelativeTime(tx.timestamp) }}</span>
              </div>
            </div>

            <div v-if="tx.amount" class="text-right shrink-0">
              <span
                class="font-mono text-sm font-semibold"
                :class="tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? 'text-error' : 'text-success'"
              >
                {{ tx.sender === userAccounts[accountIndexToDisplay]?.stxAddress ? '-' : '+' }}{{ formatAmount(tx.amount) }}
              </span>
              <small class="block text-xs text-text-muted">STX</small>
            </div>

            <div class="w-5 text-center text-sm shrink-0" :class="getStatusTextClass(tx.status)">
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
