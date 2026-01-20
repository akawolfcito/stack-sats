<script setup lang="ts">
/**
 * AssetDetailView - V82: Asset detail screen
 *
 * Dedicated screen for each core asset (STX, BTC, Runes, Inscriptions).
 * - STX: Full functionality (Send, Receive, Activity, Tokens)
 * - Others: Disabled actions with clear "Not available" status
 */
import { computed, ref, onBeforeMount, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import ScreenShell from '@/components/layout/ScreenShell.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import SegmentedTabs from '@/components/SegmentedTabs.vue';
import ListGroup from '@/components/list/ListGroup.vue';
import ListRow from '@/components/list/ListRow.vue';
import ReceiveModal from '@/components/ReceiveModal.vue';
import ActivityList, { type ActivityItem } from '@/components/activity/ActivityList.vue';
import { Button, ActionBar, SectionHeader } from '@/components/ui';
import type { ActionItem } from '@/components/ui';
import { getAssetById, isValidAssetId, type AssetDefinition } from '@/utils/assets/registry';
import { sessionManager } from '@/utils/security/session';
import { generateInitialAccounts } from '@/utils/accounts';
import { getAccountCount } from '@/utils/accounts/settings';
import {
  fetchStxBalance,
  fetchFungibleTokens,
  microStxToStx,
} from '@/utils/balance';
import {
  fetchAllTokenInfo,
  type TokenInfo,
} from '@/utils/tokens';
import {
  getCustomTokensForNetwork,
  getEnabledTokens,
} from '@/utils/tokens/custom';
import {
  fetchTransactions,
  formatRelativeTime,
  formatAmount,
  truncateAddress as truncateTxAddress,
  getTransactionTypeLabel,
  type Transaction,
} from '@/utils/transactions';
import {
  getSelectedNetwork,
  type NetworkName,
} from '@/utils/network';
import type { Account } from '@/utils/types';

const router = useRouter();
const route = useRoute();

// Asset state
const assetId = computed(() => route.params.assetId as string);
const asset = computed<AssetDefinition | undefined>(() => getAssetById(assetId.value));

// Account state
const ACCOUNT_STORAGE_KEY = 'selected_account_index';
const accountIndex = ref(parseInt(localStorage.getItem(ACCOUNT_STORAGE_KEY) || '0', 10));
const currentAccount = ref<Account | null>(null);
const selectedNetwork = ref<NetworkName>(getSelectedNetwork());

// Balance state
const stxBalanceMicro = ref<string>('0');
const isLoadingBalance = ref(false);

// Transaction state
const transactions = ref<Transaction[]>([]);
const isLoadingTx = ref(false);

// Token state (only for STX)
const tokens = ref<TokenInfo[]>([]);
const isLoadingTokens = ref(false);

// Tabs (only for STX)
const activeTab = ref<'activity' | 'tokens'>('activity');
const tabItems = computed(() => {
  if (asset.value?.id === 'stx') {
    return [
      { key: 'activity', label: 'Activity' },
      { key: 'tokens', label: 'Tokens' },
    ];
  }
  return [{ key: 'activity', label: 'Activity' }];
});

// Receive modal state
const showReceiveModal = ref(false);

// Computed balance display
const balanceText = computed(() => {
  if (!asset.value) return '0';
  if (asset.value.id === 'stx') {
    const num = microStxToStx(stxBalanceMicro.value);
    if (num === 0) return '0.00';
    if (num < 0.01) return num.toFixed(6);
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  // For unavailable assets, show placeholder
  return asset.value.id === 'btc' ? '0.00' : '0';
});

// Header title
const headerTitle = computed(() => {
  if (!asset.value) return 'Asset';
  return `${asset.value.symbol} / ${asset.value.name}`;
});

// Action items for ActionBar
const actionItems = computed<ActionItem[]>(() => {
  const isAvailable = asset.value?.available ?? false;
  return [
    { key: 'send', label: 'Send', variant: 'primary', disabled: !isAvailable },
    { key: 'receive', label: 'Receive', variant: 'secondary', disabled: !isAvailable },
  ];
});

// Activity items
const activityItems = computed<ActivityItem[]>(() => {
  if (!currentAccount.value) return [];

  return transactions.value.map((tx) => {
    const ftSender = tx.ftTransfer?.sender;
    const ftRecipient = tx.ftTransfer?.recipient;
    const isOutgoing = tx.ftTransfer
      ? ftSender === currentAccount.value?.stxAddress
      : tx.sender === currentAccount.value?.stxAddress;

    let title = '';
    let subtitle = '';
    let amountText: string | undefined;

    if (tx.ftTransfer) {
      const tokenName = tx.ftTransfer.tokenName || 'Token';
      title = `${tokenName} Transfer`;
      subtitle = isOutgoing
        ? `To ${truncateTxAddress(ftRecipient || '', 4)}`
        : `From ${truncateTxAddress(ftSender || '', 4)}`;
      const ftAmount = Number(tx.ftTransfer.amount) / 1_000_000;
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

// Navigation handlers
function goBack() {
  router.push({ path: '/user' });
}

function handleAction(key: string) {
  if (!asset.value?.available) return;

  if (key === 'send') {
    router.push({ path: '/send' });
  } else if (key === 'receive') {
    showReceiveModal.value = true;
  }
}

function handleActivityClick(txId: string) {
  router.push({ path: `/transaction/${txId}` });
}

function handleTokenClick(token: TokenInfo) {
  const tokenKey = `${selectedNetwork.value}:${token.contractId}`;
  router.push({ path: `/send-token/${encodeURIComponent(tokenKey)}` });
}

function handleManageTokens() {
  router.push({ path: '/manage-tokens' });
}

function closeReceiveModal() {
  showReceiveModal.value = false;
}

// Data loading
async function loadAccount() {
  if (!sessionManager.hasWallet || sessionManager.isLocked) {
    router.push({ path: '/unlock' });
    return;
  }

  const mnemonic = sessionManager.getMnemonic();
  if (!mnemonic) {
    router.push({ path: '/unlock' });
    return;
  }

  const count = await getAccountCount();
  const accounts = await generateInitialAccounts(mnemonic, count, selectedNetwork.value);
  currentAccount.value = accounts[accountIndex.value] || accounts[0];
}

async function loadBalance() {
  if (!currentAccount.value?.stxAddress || asset.value?.id !== 'stx') return;

  isLoadingBalance.value = true;
  try {
    const balance = await fetchStxBalance(currentAccount.value.stxAddress, selectedNetwork.value);
    if (balance !== null) {
      stxBalanceMicro.value = balance;
    }
  } catch (error) {
    console.error('Failed to load balance:', error);
  }
  isLoadingBalance.value = false;
}

async function loadTransactions() {
  if (!currentAccount.value?.stxAddress || asset.value?.id !== 'stx') return;

  isLoadingTx.value = true;
  try {
    const txs = await fetchTransactions(currentAccount.value.stxAddress, 20, 0, selectedNetwork.value);
    if (txs !== null) {
      transactions.value = txs;
    }
  } catch (error) {
    console.error('Failed to load transactions:', error);
  }
  isLoadingTx.value = false;
}

async function loadTokens() {
  if (!currentAccount.value?.stxAddress || asset.value?.id !== 'stx') return;

  isLoadingTokens.value = true;
  try {
    const fungibleTokens = await fetchFungibleTokens(currentAccount.value.stxAddress, selectedNetwork.value);
    const customTokens = getCustomTokensForNetwork(selectedNetwork.value);
    const enabledTokens = getEnabledTokens();

    let tokenInfos: TokenInfo[] = [];
    if (fungibleTokens && Object.keys(fungibleTokens).length > 0) {
      tokenInfos = await fetchAllTokenInfo(fungibleTokens, selectedNetwork.value);
    }

    const tokenMap = new Map<string, TokenInfo>();
    for (const t of tokenInfos) {
      tokenMap.set(t.contractId, t);
    }

    for (const custom of customTokens) {
      if (!enabledTokens.has(custom.contractId)) continue;
      if (tokenMap.has(custom.contractId)) continue;

      const customTokenInfo: TokenInfo = {
        contractId: custom.contractId,
        name: custom.name,
        symbol: custom.symbol,
        decimals: custom.decimals,
        balance: '0',
        formattedBalance: '0',
        imageUri: custom.image,
      };
      tokenMap.set(custom.contractId, customTokenInfo);
    }

    tokens.value = Array.from(tokenMap.values())
      .filter(t => enabledTokens.has(t.contractId) || enabledTokens.has('STX'))
      .filter(t => t.balance !== '0' || customTokens.some(c => c.contractId === t.contractId));
  } catch (error) {
    console.error('Failed to load tokens:', error);
    tokens.value = [];
  }
  isLoadingTokens.value = false;
}

 
async function _refreshData() {
  await loadBalance();
  loadTransactions();
  loadTokens();
}

// Lifecycle
onBeforeMount(async () => {
  // Validate asset ID
  if (!isValidAssetId(assetId.value)) {
    router.push({ path: '/user' });
    return;
  }

  await loadAccount();

  // Only load data for STX (available asset)
  if (asset.value?.id === 'stx') {
    await loadBalance();
    loadTransactions();
    loadTokens();
  }
});

// Watch for asset changes (if navigating between assets)
watch(assetId, async (newId) => {
  if (!isValidAssetId(newId)) {
    router.push({ path: '/user' });
    return;
  }

  activeTab.value = 'activity';
  transactions.value = [];
  tokens.value = [];

  if (asset.value?.id === 'stx') {
    await loadBalance();
    loadTransactions();
    loadTokens();
  }
});
</script>

<template>
  <ScreenShell :padded="false" data-roi="asset-detail">
    <template #header>
      <AppHeader :title="headerTitle" left="back" @left-click="goBack" />
    </template>

    <div v-if="!asset" class="loading-state">Loading...</div>

    <template v-else>
      <div class="asset-detail">
        <!-- Asset Icon -->
        <div class="asset-icon" :style="{ background: asset.iconColor }">
          <span class="asset-icon-text">{{ asset.symbol.charAt(0) }}</span>
        </div>

        <!-- Balance Display -->
        <div class="balance-display">
          <span class="balance-amount">{{ balanceText }}</span>
          <span class="balance-symbol">{{ asset.symbol }}</span>
        </div>

        <!-- Unavailable Status (for BTC/Runes/Inscriptions) -->
        <div v-if="!asset.available" class="unavailable-status">
          <span class="unavailable-badge">Not available</span>
          <p class="unavailable-message">{{ asset.unavailableMessage }}</p>
        </div>

        <!-- Action Bar -->
        <section class="actions-section">
          <ActionBar :items="actionItems" @action="handleAction">
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

        <!-- Tabs (only for available assets with multiple tabs) -->
        <div v-if="asset.available && tabItems.length > 1" class="tabs-container">
          <SegmentedTabs v-model="activeTab" :items="tabItems" />
        </div>

        <!-- Activity Section -->
        <section v-if="activeTab === 'activity'" class="activity-section">
          <SectionHeader :title="asset.available ? 'Activity' : 'Activity'">
            <template v-if="asset.available" #actions>
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

          <ListGroup v-if="asset.available">
            <ActivityList
              :items="activityItems"
              :loading="isLoadingTx"
              @item-click="handleActivityClick"
            />
          </ListGroup>

          <div v-else class="empty-state">
            <p>Activity will appear here when this asset is supported.</p>
          </div>
        </section>

        <!-- Tokens Section (only for STX) -->
        <section v-if="asset.id === 'stx' && activeTab === 'tokens'" class="tokens-section">
          <SectionHeader title="Tokens" :subtitle="`(${tokens.length})`">
            <template #actions>
              <Button variant="ghost" size="sm" @click="handleManageTokens">
                Manage
              </Button>
            </template>
          </SectionHeader>

          <ListGroup>
            <div v-if="isLoadingTokens" class="empty-state">Loading tokens...</div>

            <template v-else-if="tokens.length === 0">
              <div class="empty-state">No tokens found</div>
            </template>

            <template v-else>
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
          </ListGroup>
        </section>
      </div>
    </template>

    <!-- Receive Modal -->
    <ReceiveModal
      v-if="currentAccount"
      :visible="showReceiveModal"
      :stx-address="currentAccount.stxAddress || ''"
      :btc-p2-p-k-h-address="currentAccount.btcP2PKHAddress || ''"
      :btc-p2-t-r-address="currentAccount.btcP2TRAddress || ''"
      @close="closeReceiveModal"
    />
  </ScreenShell>
</template>

<style scoped>
.asset-detail {
  display: flex;
  flex-direction: column;
  padding: var(--space-lg) var(--page-pad-x);
}

/* Asset Icon */
.asset-icon {
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto var(--space-md);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    0 2px 8px rgba(0, 0, 0, 0.15);
}

.asset-icon-text {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  text-transform: uppercase;
}

/* Balance Display */
.balance-display {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-md);
}

.balance-amount {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.02em;
}

.balance-symbol {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-text-secondary);
}

/* Unavailable Status */
.unavailable-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xs);
  margin-bottom: var(--space-md);
}

.unavailable-badge {
  font-size: 11px;
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 999px;
}

.unavailable-message {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
  opacity: 0.8;
}

/* Actions Section */
.actions-section {
  padding: var(--space-sm) 0;
  margin-bottom: var(--space-md);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  background: rgba(255, 255, 255, 0.015);
}

/* Tabs Container */
.tabs-container {
  margin-bottom: var(--space-md);
}

/* Activity Section */
.activity-section {
  margin-bottom: var(--stack-gap);
}

/* Tokens Section */
.tokens-section {
  margin-bottom: var(--stack-gap);
}

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

/* Empty State */
.empty-state {
  text-align: center;
  color: var(--color-text-muted);
  padding: var(--space-xl);
  font-size: var(--font-size-sm);
}

.empty-state p {
  margin: 0;
}

/* Loading State */
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--color-text-muted);
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
