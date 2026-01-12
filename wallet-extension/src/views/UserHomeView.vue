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
import { Button, ActionBar, SectionHeader } from "@/components/ui";
import type { ActionItem } from "@/components/ui";
import BalanceHeader from "../components/BalanceHeader.vue";
import AssetList, { type AssetRowModel } from "../components/AssetList.vue";
import NetworkChip from "../components/network/NetworkChip.vue";
import AccountSwitcher, { type AccountItem } from "../components/account/AccountSwitcher.vue";
import ActivityList, { type ActivityItem } from "../components/activity/ActivityList.vue";
import ListGroup from "../components/list/ListGroup.vue";
import ListRow from "../components/list/ListRow.vue";
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

// ActionBar items for Send/Receive
const actionItems = computed<ActionItem[]>(() => [
  { key: 'send', label: 'Send', variant: 'primary' },
  { key: 'receive', label: 'Receive', variant: 'secondary' },
]);

// Handle action bar clicks
const handleActionClick = (key: string) => {
  if (key === 'send') handleSend();
  else if (key === 'receive') openReceiveModal();
};

// Open wallet in full-page tab (only in extension context)
const openFullPage = () => {
  if (typeof chrome !== "undefined" && chrome.runtime?.getURL && chrome.tabs?.create) {
    const url = chrome.runtime.getURL("index.html");
    chrome.tabs.create({ url });
    window.close();
  } else {
    // Fallback for non-extension context (e.g., Playwright tests)
    console.log("Full page mode not available outside extension context");
  }
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
        <!-- Header - V28: Premium controls -->
        <header class="header">
        <!-- Menu Button -->
        <Button variant="icon" @click="handleOpenUserMenu" title="Menu">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6"/>
            <line x1="3" y1="12" x2="21" y2="12"/>
            <line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </Button>

        <!-- Account Switcher -->
        <AccountSwitcher
          :current-label="currentAccountName"
          :current-address-short="currentAccountAddressShort"
          :accounts="accountItems"
          :can-add-account="accountCount < 100"
          @select="handleAccountSelect"
          @add-account="handleAddAccount"
        />

        <!-- Header Right Actions -->
        <div class="header-actions">
          <!-- Network Chip -->
          <NetworkChip
            :network="selectedNetwork"
            :label="NETWORKS[selectedNetwork].name"
            @select="handleNetworkSelect"
          />

          <!-- Fullpage Button (V28) -->
          <Button variant="icon" @click="openFullPage" title="Open in full page">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="15 3 21 3 21 9"/>
              <polyline points="9 21 3 21 3 15"/>
              <line x1="21" y1="3" x2="14" y2="10"/>
              <line x1="3" y1="21" x2="10" y2="14"/>
            </svg>
          </Button>
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

      <!-- Action Bar (Send/Receive) -->
      <section class="actions">
        <ActionBar :items="actionItems" @action="handleActionClick">
          <template #icon-send>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="19" x2="12" y2="5"/>
              <polyline points="5 12 12 5 19 12"/>
            </svg>
          </template>
          <template #icon-receive>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <polyline points="19 12 12 19 5 12"/>
            </svg>
          </template>
        </ActionBar>
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
        <SectionHeader title="Assets">
          <template #actions>
            <Button variant="ghost" size="sm" @click="handleManageTokens">
              Manage
            </Button>
            <Button
              variant="icon"
              :disabled="isLoadingBalance"
              title="Refresh"
              @click="refreshBalance"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'animate-spin': isLoadingBalance }">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </Button>
          </template>
        </SectionHeader>
        <ListGroup>
          <!-- Asset rows rendered inside card -->
          <AssetList
            :items="assetItems"
            @item-click="handleAssetClick"
          />
        </ListGroup>
      </section>

      <!-- SIP-010 Tokens Section (show when assets tab is active) -->
      <section v-if="activeTab === 'assets' && (tokens.length > 0 || isLoadingTokens)" class="tokens-section">
        <SectionHeader title="Tokens" :subtitle="`(${tokens.length})`">
          <template #actions>
            <Button variant="ghost" size="sm" @click="showTokens = !showTokens">
              {{ showTokens ? 'Hide' : 'Show' }}
            </Button>
          </template>
        </SectionHeader>

        <ListGroup v-if="showTokens">
          <template v-if="true">
            <div v-if="isLoadingTokens" class="empty-state">Loading tokens...</div>

            <template v-else-if="tokens.length === 0">
              <div class="empty-state">No tokens found</div>
            </template>

            <template v-else>
              <!-- v18: Token rows now use ListRow for Settings-grade consistency -->
              <ListRow
                v-for="token in tokens"
                :key="token.contractId"
                :label="token.symbol"
                :subtitle="token.name"
                :value="token.formattedBalance"
                chevron
                :title="token.contractId"
                @click="handleTokenClick(token)"
              >
                <template #icon>
                  <img
                    v-if="token.imageUri"
                    :src="token.imageUri"
                    :alt="token.symbol"
                    class="token-img"
                    @error="($event.target as HTMLImageElement).style.display = 'none'"
                  />
                  <span v-else class="token-initial">{{ token.symbol.charAt(0) }}</span>
                </template>
              </ListRow>
            </template>
          </template>
        </ListGroup>
      </section>

      <!-- Activity (show when activity tab is active) -->
      <section v-if="activeTab === 'activity'" class="activity-section">
        <SectionHeader title="Recent Activity">
          <template #actions>
            <Button
              variant="icon"
              :disabled="isLoadingTx"
              title="Refresh"
              @click="loadTransactions"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" :class="{ 'animate-spin': isLoadingTx }">
                <path d="M23 4v6h-6M1 20v-6h6"/>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
              </svg>
            </Button>
          </template>
        </SectionHeader>
        <ListGroup>
          <ActivityList
            :items="activityItems"
            :loading="isLoadingTx"
            @item-click="handleActivityClick"
          />
        </ListGroup>
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
  background: var(--color-bg-primary);
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
  padding: 0 var(--page-pad-x);
  margin-bottom: var(--stack-gap);
}

/* Ambient Glow - V27: minimal, premium clean */
.ambient-glow {
  position: absolute;
  top: -10%;
  left: -20%;
  width: 60%;
  height: 30%;
  background: rgba(255, 255, 255, 0.3);
  opacity: 0.02; /* Reduced from 0.05 for cleaner look */
  filter: blur(80px);
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

/* Header - V28: Premium layout */
.header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--card-pad-x);
  padding-top: var(--space-lg);
  padding-bottom: var(--space-sm);
}

/* Header right actions group (V33: aligned + balanced) */
.header-actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm); /* V33: Slightly more breathing room */
  margin-left: auto;
}

/* V33: Fullpage button - subtle background for visibility */
.header-actions :deep(.btn--icon) {
  background: rgba(255, 255, 255, 0.04);
  color: var(--color-text-muted);
}

.header-actions :deep(.btn--icon:hover:not(:disabled)) {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
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
  font-size: var(--font-size-xs);
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
  padding: var(--space-xs);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
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
  font-size: var(--font-size-5xl);
  font-weight: 900;
  color: var(--color-text-primary); /* v17: neutral balance */
  letter-spacing: -0.02em;
  line-height: 1;
}

.balance-unit {
  font-size: var(--font-size-5xl);
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
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--color-text-secondary);
}

/* Action Bar (V27 - Premium controls) */
.actions {
  padding: var(--space-sm) var(--page-pad-x);
  margin-bottom: var(--stack-gap);
  /* Subtle separator from balance */
  border-top: 1px solid rgba(255, 255, 255, 0.04);
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(255, 255, 255, 0.01);
}

/* Assets Section */
.assets-section {
  padding: 0 var(--page-pad-x);
  margin-bottom: var(--stack-gap);
}

/* Tokens Section */
.tokens-section {
  padding: 0 var(--page-pad-x);
  margin-bottom: var(--stack-gap);
}

/* Token icon styles for ListRow slot (v18: using ListRow component) */
.token-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: var(--radius-chip);
}

.token-initial {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

/* Activity Section */
.activity-section {
  padding: 0 var(--page-pad-x);
  margin-bottom: var(--stack-gap);
}

.empty-state {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-xl);
  font-size: var(--font-size-sm);
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
