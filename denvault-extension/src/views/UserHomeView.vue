<script setup lang="ts">
/**
 * UserHomeView - V55.2 Shell Migration
 *
 * Dashboard/home screen migrated to V55 shell system.
 *
 * V55.2 Changes:
 * - Wrapped in ScreenShell for consistent layout
 * - Added data-roi attributes for E2E testing
 * - Preserved fixed header + scrollable body pattern
 * - Ambient glow contained within shell
 *
 * Structure:
 * - Fixed header zone (menu, account switcher, network, balance, actions, tabs)
 * - Scrollable body (assets, tokens, activity)
 */
import { useRoute, useRouter } from "vue-router";
import { onBeforeMount, onBeforeUnmount, ref, watch, computed } from "vue";
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
  fetchCombinedBtcBalance,
  formatBtcBalance,
  getBtcTxExplorerUrl,
  type BtcBalance,
} from "../utils/bitcoin";
import {
  fetchAllTokenInfo,
  type TokenInfo,
} from "../utils/tokens";
import {
  getCustomTokensForNetwork,
  getEnabledTokens,
} from "../utils/tokens/custom";
import {
  getAccountCount,
  addAccount,
  getAccountName,
  DEFAULT_ACCOUNT_COUNT,
} from "../utils/accounts/settings";
import {
  getActiveAccountIndex,
  setActiveAccountIndex,
} from "../utils/accounts/active";
import {
  fetchTransactions,
  formatRelativeTime,
  formatAmount,
  truncateAddress as truncateTxAddress,
  getTransactionTypeLabel,
  type Transaction,
} from "../utils/transactions";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import ReceiveModal from "../components/ReceiveModal.vue";
import SegmentedTabs from "../components/SegmentedTabs.vue";
import { Button, ActionBar, SectionHeader } from "@/components/ui";
import type { ActionItem } from "@/components/ui";
import BalanceHeader from "../components/BalanceHeader.vue";
import AssetList, { type AssetRowModel } from "../components/AssetList.vue";
import { getAvailableAssets } from "../utils/assets/registry";
import { formatStxFromMicro } from "@/utils/balance/format";
import { startAutoRefresh } from "@/composables/useAutoRefresh";
import { fetchBtcActivity, type BtcActivityItem } from "@/utils/bitcoin/activity";
import NetworkChip from "../components/network/NetworkChip.vue";
import AccountSwitcher, { type AccountItem } from "../components/account/AccountSwitcher.vue";
import ActivityList, { type ActivityItem } from "../components/activity/ActivityList.vue";
import ListGroup from "../components/list/ListGroup.vue";
import ListRow from "../components/list/ListRow.vue";
import { useUiMode } from "../composables/useUiMode";
import { openSidePanel } from "@/composables/useSidePanel";

const router = useRouter();

// UI Mode detection
const { isPopup, isSidePanel } = useUiMode();

// Tab state for navigation (unified for popup and panel)
/**
 * Which tab opens. `?tab=activity` is how a dApp approval lands here:
 * approving used to drop the user on Assets with an unchanged balance and
 * no word about the transaction they had just authorised.
 */
const activeTab = ref<'assets' | 'activity'>(
  useRoute().query.tab === 'activity' ? 'activity' : 'assets'
);

/**
 * Anything on screen still waiting for a block.
 *
 * Drives how often the view refreshes itself: this is the state in which
 * the user is watching and wondering whether their transaction went out.
 */
const hasPendingActivity = computed(() =>
  activityItems.value.some((item) => item.status === 'pending')
);

/** Undone on unmount; installed once the first load has run. */
let stopAutoRefresh: (() => void) | null = null;
const tabItems = [
  { key: 'assets', label: 'Assets' },
  { key: 'activity', label: 'Activity' },
];

const userAccounts = ref<Account[]>([]);
const isLoading = ref(true);
const selectedNetwork = ref<NetworkName>(getSelectedNetwork());
const currentMnemonic = ref<string | null>(null);

// Persistent account selection. Shared with the dApp approval screen so
// both agree on which account signs. Resolved against the real account
// count once it loads, instead of a hardcoded ceiling of 20 that ignored
// MAX_ACCOUNT_COUNT.
const accountIndexToDisplay = ref(0);

// Balance state
const stxBalanceMicro = ref<string>("0");
const isLoadingBalance = ref(false);
/**
 * Fiat conversion rate. Zero means "unknown", which hides the fiat line
 * rather than showing a fabricated $0.00 next to a real balance.
 *
 * utils/prices/index.ts implements the fetch against CoinGecko and is
 * ready to plug in here, but wiring it needs api.coingecko.com added to
 * host_permissions and declared as a third party in the store's privacy
 * tab. Deliberately deferred until after the CWS resubmit.
 */
const stxPriceUsd = ref(0);

// BTC Balance state
const btcBalance = ref<BtcBalance>({ confirmed: 0, unconfirmed: 0, total: 0, txCount: 0 });
const isLoadingBtcBalance = ref(false);
/**
 * True when the Bitcoin indexer could not be reached. Kept apart from the
 * balance itself: reporting zero for an unknown balance is the wallet
 * telling the user something it does not know.
 */
const isBtcBalanceUnknown = ref(false);

/** Bitcoin history, merged into the same Activity list as Stacks. */
const btcActivity = ref<BtcActivityItem[]>([]);

// Account count state
const accountCount = ref(DEFAULT_ACCOUNT_COUNT);

// Account naming state
const accountNames = ref<Record<number, string>>({});

// Transaction history state
const transactions = ref<Transaction[]>([]);
const isLoadingTx = ref(false);

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

/**
 * Short balance, truncated rather than rounded.
 *
 * toLocaleString rounds, so 499.995501 STX rendered as "500.00": a
 * balance the account does not hold, and a deploy that had just cost
 * 0.004499 looked like it never happened. A wallet may show fewer digits
 * than it has; it may not show more money than it has.
 */
const shortBalance = computed(() => formatStxFromMicro(stxBalanceMicro.value));

const totalValueUsd = computed(() => {
  if (stxPriceUsd.value === 0) return null;
  return formatUsdValue(stxBalanceNumber.value * stxPriceUsd.value);
});

// Current account display name
const currentAccountName = computed(() => {
  return accountNames.value[accountIndexToDisplay.value] || `Account ${accountIndexToDisplay.value + 1}`;
});

// Current account address (short)
/** Full address of the account on screen, for the copy button. */
const currentStxAddress = computed(
  () => userAccounts.value[accountIndexToDisplay.value]?.stxAddress ?? ''
);

const addressCopied = ref(false);

/**
 * Copy the address shown in the header.
 *
 * The most repeated action in a wallet used to live two taps away, inside
 * the Receive screen, with no affordance where the user is actually
 * looking at their address.
 */
async function copyCurrentAddress() {
  const address = currentStxAddress.value;
  if (!address) return;

  try {
    await navigator.clipboard.writeText(address);
    addressCopied.value = true;
    setTimeout(() => {
      addressCopied.value = false;
    }, 2000);
  } catch (error) {
    secureLog('Failed to copy address', error);
  }
}

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
//
// Driven by ASSETS_REGISTRY via getAvailableAssets(), so the Home list shows
// only assets the wallet actually queries. Unimplemented ones stay declared in
// the registry with `available: false` and reappear here the moment that flips.
//
// This list used to be hand-written, which let it drift from the registry: it
// declared Inscriptions as `ordinals` while the registry called it
// `inscriptions`, so tapping the row failed isValidAssetId() in AssetDetailView
// and bounced straight back to /user. It also hard-coded `balanceText: '0'` for
// assets no code ever fetches, telling the user they held none of something the
// wallet had never looked for.
const assetBalanceText: Record<string, () => string> = {
  stx: () => shortBalance.value,
  btc: () => (isBtcBalanceUnknown.value ? 'Unavailable' : formatBtcBalance(btcBalance.value.total)),
};

const assetItems = computed<AssetRowModel[]>(() => {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount) return [];

  return getAvailableAssets().map((asset) => ({
    id: asset.id,
    symbol: asset.symbol,
    name: asset.name,
    balanceText: assetBalanceText[asset.id]?.() ?? '0',
    // TODO: BTC price API. Only STX has a fiat figure today.
    fiatText: asset.id === 'stx' ? totalValueUsd.value || undefined : undefined,
    iconColor: asset.iconColor,
    available: asset.available,
  }));
});

// V82: Handle asset item click - navigate to asset detail
const handleAssetClick = (item: AssetRowModel) => {
  router.push({ path: `/asset/${item.id}` });
};

/** Bitcoin history in the shape the shared Activity list renders. */
const btcActivityItems = computed<ActivityItem[]>(() =>
  btcActivity.value.map((item) => ({
    txId: item.txid,
    status: item.confirmed ? ('success' as const) : ('pending' as const),
    title: 'Bitcoin Transfer',
    subtitle: item.counterparty
      ? `${item.isOutgoing ? 'To' : 'From'} ${truncateTxAddress(item.counterparty, 4)}`
      : undefined,
    amountText: `${formatBtcBalance(item.amountSats)} BTC`,
    // Seconds, not milliseconds: formatRelativeTime compares against
    // Date.now() / 1000. Multiplying made every Bitcoin row read "Just
    // now", including one from hours earlier.
    timeText: item.blockTime ? formatRelativeTime(item.blockTime) : 'Pending',
    isOutgoing: item.isOutgoing,
  }))
);

// Activity items for ActivityList component
const stxActivityItems = computed<ActivityItem[]>(() => {
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

/**
 * One list for both chains. Pending first, because that is what the user
 * just did and what they came back to check.
 */
const activityItems = computed<ActivityItem[]>(() => {
  const merged = [...stxActivityItems.value, ...btcActivityItems.value];
  return merged.sort((a, b) => {
    if (a.status !== b.status) {
      if (a.status === 'pending') return -1;
      if (b.status === 'pending') return 1;
    }
    return 0;
  });
});

// Handle activity item click (navigate to transaction details)
const handleActivityClick = (txId: string) => {
  // The detail screen reads the Stacks API, so a Bitcoin txid would land
  // on a page that can never load. Send those to a Bitcoin explorer.
  if (btcActivity.value.some((item) => item.txid === txId)) {
    window.open(getBtcTxExplorerUrl(txId, selectedNetwork.value), '_blank');
    return;
  }

  router.push({ path: `/transaction/${txId}` });
};

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

async function loadBtcBalance() {
  const currentAccount = userAccounts.value[accountIndexToDisplay.value];
  if (!currentAccount) return;

  // Get both BTC addresses (P2PKH + P2TR)
  const addresses: string[] = [];
  if (currentAccount.btcP2PKHAddress) addresses.push(currentAccount.btcP2PKHAddress);
  if (currentAccount.btcP2TRAddress) addresses.push(currentAccount.btcP2TRAddress);

  if (addresses.length === 0) return;

  isLoadingBtcBalance.value = true;
  try {
    const balance = await fetchCombinedBtcBalance(addresses, selectedNetwork.value);
    btcBalance.value = balance;
    isBtcBalanceUnknown.value = false;
    secureLog("BTC balance loaded", { total: balance.total });

    // A Bitcoin send used to disappear from the wallet the moment its
    // result screen was dismissed: on chain, but nowhere in the app.
    btcActivity.value = await fetchBtcActivity(addresses, selectedNetwork.value);
  } catch (error) {
    // Say so, rather than leaving the last figure or a zero on screen.
    isBtcBalanceUnknown.value = true;
    secureLog("Failed to load BTC balance", error);
  }
  isLoadingBtcBalance.value = false;
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

async function refreshBalance() {
  await loadBalance();
  loadBtcBalance(); // Load in background
  loadTransactions(); // Load in background
  loadTokens(); // Load in background
}

onBeforeMount(async () => {
  // Load account settings
  accountCount.value = await getAccountCount();
  accountIndexToDisplay.value = getActiveAccountIndex(accountCount.value);
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
      loadBtcBalance(); // Don't await, load in background
      loadTransactions(); // Don't await, load in background
      loadTokens(); // Don't await, load in background

      // Nothing refreshed on its own until now, so a transaction that had
      // already been mined left no trace on screen and users sent it
      // again. See utils/composables/useAutoRefresh.
      stopAutoRefresh = startAutoRefresh({
        hasPending: hasPendingActivity,
        onRefresh: () => {
          loadBalance();
          loadBtcBalance();
          loadTransactions();
        },
      });
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
  setActiveAccountIndex(newIndex);
  transactions.value = []; // Clear transactions on account change
  tokens.value = []; // Clear tokens on account change
  await loadBalance();
  loadTransactions();
  loadTokens();
});

onBeforeUnmount(() => {
  stopAutoRefresh?.();
  stopAutoRefresh = null;
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

/**
 * Open the wallet in Chrome's side panel.
 *
 * More than a convenience: a panel open in the same window as a dApp is
 * where background delivers the approval, and it is usually already
 * unlocked. Until now the only way to open it was Chrome's extensions
 * menu, which no one finds.
 */
const handleOpenSidePanel = async () => {
  const outcome = await openSidePanel();
  // The toolbar popup cannot survive the panel taking focus, and leaving
  // two copies of the wallet on screen is confusing anyway.
  if (outcome === "sidepanel" && isPopup.value) {
    window.close();
  }
};

const truncateAddress = (address: string) => {
  return address.slice(0, 7) + "..." + address.slice(-7);
};

// Receive modal state
const showReceiveModal = ref(false);

// V57: Component refs for snapshot hooks
const accountSwitcherRef = ref<InstanceType<typeof AccountSwitcher> | null>(null);
const networkChipRef = ref<InstanceType<typeof NetworkChip> | null>(null);

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

// V35/V57: Expose snapshot hooks for UI testing
// Only available in development builds
if (__DEV__ && typeof window !== 'undefined' && localStorage.getItem('__UI_SNAPSHOT_MODE__')) {
  (window as unknown as Record<string, unknown>).__UI_SNAPSHOT__ = {
    openReceiveModal: () => {
      showReceiveModal.value = true;
    },
    closeReceiveModal: () => {
      showReceiveModal.value = false;
    },
    // V57: Dropdown snapshot hooks
    openAccountSwitcher: () => {
      accountSwitcherRef.value?.open();
    },
    closeAccountSwitcher: () => {
      accountSwitcherRef.value?.close();
    },
    openNetworkChip: () => {
      networkChipRef.value?.open();
    },
    closeNetworkChip: () => {
      networkChipRef.value?.close();
    },
  };
}

// Handle token click - navigate to send token view
const handleTokenClick = (token: TokenInfo) => {
  const tokenKey = `${selectedNetwork.value}:${token.contractId}`;
  router.push({ path: `/send-token/${encodeURIComponent(tokenKey)}` });
};

const handleManageTokens = () => {
  router.push({ path: "/manage-tokens" });
};

// V68: Navigate to accounts management screen
const handleManageAccounts = () => {
  router.push({ path: "/accounts" });
};
</script>

<template>
  <ScreenShell :padded="false" :scroll="false" data-roi="home-screen">
    <!-- V55.2: Custom home layout within shell -->
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
              ref="accountSwitcherRef"
              :current-label="currentAccountName"
              :accounts="accountItems"
              :can-add-account="accountCount < 100"
              @select="handleAccountSelect"
              @add-account="handleAddAccount"
              @manage="handleManageAccounts"
            />

            <!-- Header Right Actions -->
            <div class="header-actions">
              <!-- Network Chip -->
              <NetworkChip
                ref="networkChipRef"
                :network="selectedNetwork"
                :label="NETWORKS[selectedNetwork].name"
                @select="handleNetworkSelect"
              />

              <!-- Side panel entry: hidden when this already is the panel -->
              <Button
                v-if="!isSidePanel"
                variant="icon"
                data-roi="home-sidepanel"
                title="Open in side panel"
                @click="handleOpenSidePanel"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <line x1="15" y1="3" x2="15" y2="21"/>
                </svg>
              </Button>

              <!-- Full page moved to the menu: an occasional exit, and two
                   window icons side by side were indistinguishable at 16px.
                   The side panel stays because approvals are delivered
                   there, so it cannot be the one that hides. -->
            </div>
          </header>

          <!-- V55.2: Balance Card with data-roi -->
          <BalanceHeader
            :amount-text="isLoadingBalance ? '...' : shortBalance"
            symbol="STX"
            :usd-text="totalValueUsd ? `${totalValueUsd} USD` : undefined"
            :is-hidden="!showBalance"
            :address-short="currentAccountAddressShort"
            address-label="STX"
            :address-copied="addressCopied"
            data-roi="home-balance-card"
            @toggle-hidden="toggleBalanceVisibility"
            @refresh="refreshBalance"
            @copy-address="copyCurrentAddress"
          />

          <!-- V55.2: Quick Actions with data-roi -->
          <section class="actions" data-roi="home-quick-actions">
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
          <!-- V55.2: Assets Section with data-roi -->
          <section v-if="activeTab === 'assets'" class="assets-section" data-roi="home-assets-list">
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
            <!-- V81: Helper microcopy -->
            <p class="assets-helper">Core assets. Tokens appear below when available.</p>
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

          <!-- V55.2: Activity Section with data-roi -->
          <section v-if="activeTab === 'activity'" class="activity-section" data-roi="home-activity-preview">
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
  </ScreenShell>
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
  /* At popup width there is no room to spare. Adding the copy button
     pushed the network chip and the two view buttons off the right edge,
     because the account pill would not give any width back. */
  min-width: 0;
}

/* The account pill is the only elastic piece: it already truncates its
   address, so it is the one that yields. */
.header :deep(.account-switcher) {
  min-width: 0;
  flex: 1 1 auto;
}

.header :deep(.account-pill) {
  max-width: 100%;
}

.header :deep(.account-pill__info) {
  min-width: 0;
}

.header :deep(.account-pill__label),
.header :deep(.account-pill__address) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Everything else keeps its size rather than being squeezed into nothing. */
.header > :deep(.btn--icon),
.header .header-actions {
  flex: 0 0 auto;
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

/* V42: Action Bar - Clean premium separator zone */
.actions {
  padding: var(--space-md) var(--page-pad-x);
  margin-bottom: var(--stack-gap);
  /* V42: Subtle but intentional separator */
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.015);
}

/* Assets Section */
.assets-section {
  padding: 0 var(--page-pad-x);
  margin-bottom: var(--stack-gap);
}

/* V81: Assets helper microcopy */
.assets-helper {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0 var(--space-xs);
  margin-bottom: 8px;
  opacity: 0.8;
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
