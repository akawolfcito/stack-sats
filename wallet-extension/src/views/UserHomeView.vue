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
  formatTokenBalance,
} from "../utils/tokens";
import {
  getCustomTokensForNetwork,
  getEnabledTokens,
  type CustomToken,
} from "../utils/tokens/custom";
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
import AssetList, { type AssetRowModel } from "../components/AssetList.vue";
import NetworkChip from "../components/network/NetworkChip.vue";
import AccountSwitcher, { type AccountItem } from "../components/account/AccountSwitcher.vue";
import ActivityList, { type ActivityItem } from "../components/activity/ActivityList.vue";
import { useUiMode } from "../composables/useUiMode";

const router = useRouter();

// UI Mode detection
const { isPopup } = useUiMode();

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

// Current account address (short)
const currentAccountAddressShort = computed(() => {
  const address = userAccounts.value[accountIndexToDisplay.value]?.stxAddress || '';
  return truncateAddress(address);
});

// Account items for AccountSwitcher component
const accountItems = computed<AccountItem[]>(() => {
  return userAccounts.value.map((account, index) => ({
    index,
    label: accountNames.value[index] || `Account ${index + 1}`,
    addressShort: truncateAddress(account.stxAddress),
  }));
});

// Handle account selection from AccountSwitcher
const handleAccountSelect = (index: number) => {
  accountIndexToDisplay.value = index;
};

// Asset items for AssetList component
const assetItems = computed<AssetRowModel[]>(() => {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount) return [];

  return [
    {
      id: 'stx',
      symbol: 'STX',
      name: 'Stacks',
      balanceText: shortBalance.value,
      fiatText: totalValueUsd.value || undefined,
      iconColor: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(168, 85, 247, 0.1))',
    },
    {
      id: 'btc',
      symbol: 'BTC',
      name: 'Bitcoin',
      balanceText: '0.00',
      fiatText: undefined,
      iconColor: 'linear-gradient(135deg, rgba(249, 115, 22, 0.2), rgba(249, 115, 22, 0.1))',
    },
    {
      id: 'runes',
      symbol: 'R',
      name: 'Runes',
      balanceText: '0',
      fiatText: undefined,
      iconColor: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(236, 72, 153, 0.1))',
    },
    {
      id: 'ordinals',
      symbol: 'O',
      name: 'Inscriptions',
      balanceText: '0',
      fiatText: undefined,
      iconColor: 'linear-gradient(135deg, rgba(234, 179, 8, 0.2), rgba(234, 179, 8, 0.1))',
    },
  ];
});

// Handle asset item click (copy address to clipboard)
const handleAssetClick = (item: AssetRowModel) => {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount) return;

  let address = '';
  switch (item.id) {
    case 'stx':
      address = currentAccount.stxAddress || '';
      break;
    case 'btc':
      address = currentAccount.btcP2PKHAddress || '';
      break;
    case 'runes':
    case 'ordinals':
      address = currentAccount.btcP2TRAddress || '';
      break;
  }
  if (address) {
    copyToClipboard(address);
  }
};

// Activity items for ActivityList component
const activityItems = computed<ActivityItem[]>(() => {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount) return [];

  return transactions.value.map((tx) => {
    // For FT transfers, check if user is sender or recipient
    const ftSender = tx.ftTransfer?.sender;
    const ftRecipient = tx.ftTransfer?.recipient;
    const isOutgoing = tx.ftTransfer
      ? ftSender === currentAccount.stxAddress
      : tx.sender === currentAccount.stxAddress;

    // Determine title and subtitle
    let title = '';
    let subtitle = '';
    let amountText: string | undefined;

    // Check if this is a SIP-010 token transfer
    if (tx.ftTransfer) {
      const tokenName = tx.ftTransfer.tokenName || 'Token';
      title = `${tokenName} Transfer`;
      subtitle = isOutgoing
        ? `To ${truncateTxAddress(ftRecipient || '', 4)}`
        : `From ${truncateTxAddress(ftSender || '', 4)}`;
      // Format FT amount (assume decimals are in the amount already)
      const ftAmount = Number(tx.ftTransfer.amount) / 1_000_000; // Assume 6 decimals
      amountText = ftAmount > 0 ? `${ftAmount.toFixed(ftAmount < 1 ? 6 : 2)} ${tokenName}` : undefined;
    } else if (tx.type === 'token_transfer' && tx.recipient) {
      title = 'Transfer';
      subtitle = isOutgoing
        ? `To ${truncateTxAddress(tx.recipient, 4)}`
        : `From ${truncateTxAddress(tx.sender, 4)}`;
      amountText = tx.amount ? `${formatAmount(tx.amount)} STX` : undefined;
    } else if (tx.contractId) {
      title = getTransactionTypeLabel(tx.type) + (tx.functionName ? `.${tx.functionName}` : '');
      const [contractAddr, contractName] = tx.contractId.split('.');
      subtitle = `${truncateTxAddress(contractAddr, 4)}.${contractName}`;
    } else {
      title = getTransactionTypeLabel(tx.type);
    }

    // Map status to simplified type
    let status: 'pending' | 'success' | 'failed' = 'pending';
    if (tx.status === 'success') status = 'success';
    else if (tx.status === 'failed' || tx.status === 'abort_by_response' || tx.status === 'abort_by_post_condition') status = 'failed';

    return {
      txId: tx.txId,
      status,
      title,
      subtitle,
      amountText,
      timeText: formatRelativeTime(tx.timestamp),
      isOutgoing,
    };
  });
});

// Handle activity item click (navigate to transaction details)
const handleActivityClick = (txId: string) => {
  router.push({ path: `/transaction/${txId}` });
};

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
    // Fetch on-chain token balances
    const fungibleTokens = await fetchFungibleTokens(currentAccount.stxAddress, selectedNetwork.value);

    // Get custom tokens for current network that are enabled
    const customTokens = getCustomTokensForNetwork(selectedNetwork.value);
    const enabledTokens = getEnabledTokens();

    // Build token info from fetched balances
    let tokenInfos: TokenInfo[] = [];
    if (fungibleTokens && Object.keys(fungibleTokens).length > 0) {
      tokenInfos = await fetchAllTokenInfo(fungibleTokens, selectedNetwork.value);
    }

    // Create a map of contractId -> TokenInfo for easy lookup
    const tokenMap = new Map<string, TokenInfo>();
    for (const t of tokenInfos) {
      tokenMap.set(t.contractId, t);
    }

    // Add custom tokens that are enabled but not in the balance response
    for (const custom of customTokens) {
      if (!enabledTokens.has(custom.contractId)) continue;

      // Skip if already in the balance response
      if (tokenMap.has(custom.contractId)) continue;

      // Add custom token with 0 balance
      const customTokenInfo: TokenInfo = {
        contractId: custom.contractId,
        name: custom.name,
        symbol: custom.symbol,
        decimals: custom.decimals,
        balance: "0",
        formattedBalance: "0",
        imageUri: custom.image,
      };
      tokenMap.set(custom.contractId, customTokenInfo);
    }

    // Convert map to array and filter enabled tokens
    tokens.value = Array.from(tokenMap.values())
      .filter(t => enabledTokens.has(t.contractId) || enabledTokens.has("STX"))
      .filter(t => t.balance !== "0" || customTokens.some(c => c.contractId === t.contractId));
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

// Handle network selection from NetworkChip
const handleNetworkSelect = (network: NetworkName) => {
  selectedNetwork.value = network;
};

const openReceiveModal = () => {
  showReceiveModal.value = true;
};

const closeReceiveModal = () => {
  showReceiveModal.value = false;
};

// Handle token click - navigate to send token view
const handleTokenClick = (token: TokenInfo) => {
  const tokenKey = `${selectedNetwork.value}:${token.contractId}`;
  router.push({ path: `/send-token/${encodeURIComponent(tokenKey)}` });
};

const handleManageTokens = () => {
  router.push({ path: "/manage-tokens" });
};
</script>

<template>
  <section class="user-home-view" :class="{ 'user-home-view--popup': isPopup }">
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

        <!-- Account Switcher -->
        <AccountSwitcher
          :current-label="currentAccountName"
          :current-address-short="currentAccountAddressShort"
          :accounts="accountItems"
          :can-add-account="accountCount < 100"
          @select="handleAccountSelect"
          @add-account="handleAddAccount"
        />

        <!-- Network Chip -->
        <NetworkChip
          :network="selectedNetwork"
          :label="NETWORKS[selectedNetwork].name"
          @select="handleNetworkSelect"
        />
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
          <div class="section-actions">
            <button class="manage-btn" @click="handleManageTokens">
              Manage
            </button>
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
        </div>

        <!-- Asset List (rows) -->
        <AssetList
          :items="assetItems"
          @item-click="handleAssetClick"
        />
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
              class="token-item token-item--clickable"
              :title="token.contractId"
              @click="handleTokenClick(token)"
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

      <!-- Activity (show when activity tab is active) -->
      <section v-if="activeTab === 'activity'" class="activity-section">
        <div class="section-header">
          <h2 class="section-title">Recent Activity</h2>
          <button
            class="refresh-btn"
            @click="loadTransactions"
            :disabled="isLoadingTx"
            title="Refresh"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" :class="{ 'animate-spin': isLoadingTx }">
              <path d="M23 4v6h-6M1 20v-6h6"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
          </button>
        </div>
        <ActivityList
          :items="activityItems"
          :loading="isLoadingTx"
          @item-click="handleActivityClick"
        />
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
  -webkit-overflow-scrolling: touch; /* Smooth scrolling on iOS */
  scroll-behavior: smooth;
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
  gap: var(--space-sm);
  padding: var(--card-pad-x);
  padding-top: var(--space-lg);
  padding-bottom: var(--space-sm);
}

.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  min-width: var(--icon-btn-size);
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
  font-size: 18px;
  line-height: 1;
  color: #FFFFFF;
}

/* Account Switcher and Network Chip styles are in their respective components */

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
  border-radius: var(--radius-pill);
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
  margin-bottom: var(--space-lg);
}

.action-btn {
  flex: 1;
  height: var(--control-h);
  border-radius: var(--radius-pill);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
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
  margin-bottom: var(--space-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-md);
}

.section-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.manage-btn {
  background: transparent;
  border: none;
  color: var(--color-accent-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm, 6px);
  transition: all 0.15s ease;
}

.manage-btn:hover {
  background: rgba(232, 248, 89, 0.1);
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
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
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

/* Assets Section uses AssetList component */

/* Tokens Section */
.tokens-section {
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-lg);
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

.token-item--clickable {
  cursor: pointer;
}

.token-item--clickable:active {
  transform: scale(0.98);
}

.token-icon {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
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

/* Activity Section */
.activity-section {
  padding: 0 var(--space-lg);
  margin-bottom: var(--space-lg);
}

.empty-state {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-xl);
  font-size: 14px;
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
