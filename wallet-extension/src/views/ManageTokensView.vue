<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useRouter } from "vue-router";
import TokenList, { type TokenItem } from "@/components/tokens/TokenList.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { TextField, Button } from "@/components/ui";
import { getSelectedNetwork, type NetworkName } from "@/utils/network";
import {
  getCustomTokensForNetwork,
  getEnabledTokens,
  saveEnabledTokens,
  type CustomToken,
} from "@/utils/tokens/custom";

const router = useRouter();

// Token interface
interface Token {
  contractId: string;
  symbol: string;
  name: string;
  color: string;
  isCustom?: boolean;
}

// Known tokens list for mainnet (can be expanded)
const KNOWN_TOKENS_MAINNET: Token[] = [
  { contractId: "STX", symbol: "STX", name: "Stacks", color: "#7c3aed" },
  { contractId: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex::alex", symbol: "ALEX", name: "Alex Lab", color: "#f97316" },
  { contractId: "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token::welshcorgicoin", symbol: "WELSH", name: "Welshcorgicoin", color: "#eab308" },
  { contractId: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token::diko", symbol: "DIKO", name: "Arkadiko", color: "#3b82f6" },
  { contractId: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token::usda", symbol: "USDA", name: "Arkadiko Stablecoin", color: "#22c55e" },
  { contractId: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2::miamicoin", symbol: "MIA", name: "MiamiCoin", color: "#ec4899" },
  { contractId: "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2::newyorkcitycoin", symbol: "NYC", name: "NewYorkCityCoin", color: "#06b6d4" },
  { contractId: "SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin::wrapped-bitcoin", symbol: "xBTC", name: "Wrapped Bitcoin", color: "#f7931a" },
];

// State
const searchQuery = ref("");
const enabledTokens = ref<Set<string>>(new Set());
const customTokens = ref<CustomToken[]>([]);
const currentNetwork = ref<NetworkName>("devnet");
const isLoading = ref(true);

// Get known tokens based on network (mainnet only for now)
const knownTokens = computed<Token[]>(() => {
  // STX is always available
  const stx: Token = { contractId: "STX", symbol: "STX", name: "Stacks", color: "#7c3aed" };

  if (currentNetwork.value === "mainnet") {
    return KNOWN_TOKENS_MAINNET;
  }

  // For testnet/devnet, only show STX from known tokens
  return [stx];
});

// Combine known tokens with custom tokens for current network
const allTokens = computed<Token[]>(() => {
  const known = knownTokens.value;
  const custom = customTokens.value.map((t) => ({
    contractId: t.contractId,
    symbol: t.symbol,
    name: t.name,
    color: t.color,
    isCustom: true,
  }));

  // Combine: known first, then custom
  return [...known, ...custom];
});

// Load enabled tokens and custom tokens
onBeforeMount(() => {
  currentNetwork.value = getSelectedNetwork();
  enabledTokens.value = getEnabledTokens();
  customTokens.value = getCustomTokensForNetwork(currentNetwork.value);
  isLoading.value = false;
});

// Handle saving enabled tokens
function handleSaveEnabledTokens() {
  saveEnabledTokens(enabledTokens.value);
}

// Filter tokens by search query
const filteredTokens = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return allTokens.value;

  return allTokens.value.filter(
    (t) =>
      t.symbol.toLowerCase().includes(query) ||
      t.name.toLowerCase().includes(query) ||
      t.contractId.toLowerCase().includes(query)
  );
});

// Map to TokenItem format
const activeTokenItems = computed<TokenItem[]>(() => {
  return filteredTokens.value
    .filter((t) => enabledTokens.value.has(t.contractId))
    .map((t) => ({
      ...t,
      enabled: true,
      isLocked: t.contractId === "STX",
      isCustom: t.isCustom,
    }));
});

const availableTokenItems = computed<TokenItem[]>(() => {
  return filteredTokens.value
    .filter((t) => !enabledTokens.value.has(t.contractId))
    .map((t) => ({
      ...t,
      enabled: false,
      isCustom: t.isCustom,
    }));
});

// Custom tokens section
const customTokenItems = computed<TokenItem[]>(() => {
  return filteredTokens.value
    .filter((t) => t.isCustom)
    .map((t) => ({
      ...t,
      enabled: enabledTokens.value.has(t.contractId),
      isCustom: true,
    }));
});

// Handle toggle from TokenList
function handleToggle(contractId: string, enabled: boolean) {
  // Don't allow disabling STX
  if (contractId === "STX") return;

  if (enabled) {
    enabledTokens.value.add(contractId);
  } else {
    enabledTokens.value.delete(contractId);
  }
  // Trigger reactivity
  enabledTokens.value = new Set(enabledTokens.value);
  handleSaveEnabledTokens();
}

// Navigation
function handleBack() {
  router.back();
}

function handleAddToken() {
  router.push({ path: "/add-token" });
}
</script>

<template>
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        title="Manage Tokens"
        left="back"
        @left-click="handleBack"
      />
    </template>

    <!-- Search Bar -->
    <div class="search-container">
      <TextField
        v-model="searchQuery"
        placeholder="Search tokens or add by contract"
      >
        <template #prefix>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </template>
      </TextField>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading tokens...</p>
    </div>

    <!-- Content -->
    <main v-else class="content">
      <!-- Active Assets Section -->
      <div v-if="activeTokenItems.length > 0" class="section">
        <h3 class="section-title">Active Assets</h3>
        <TokenList
          :items="activeTokenItems"
          @toggle="handleToggle"
        />
      </div>

      <!-- Available Tokens Section (non-custom) -->
      <div v-if="availableTokenItems.filter(t => !t.isCustom).length > 0" class="section">
        <h3 class="section-title">Available Tokens</h3>
        <TokenList
          :items="availableTokenItems.filter(t => !t.isCustom)"
          @toggle="handleToggle"
        />
      </div>

      <!-- Custom Tokens Section -->
      <div v-if="customTokenItems.length > 0" class="section">
        <h3 class="section-title">Custom Tokens</h3>
        <TokenList
          :items="customTokenItems"
          @toggle="handleToggle"
        />
      </div>

      <!-- Empty State: No custom tokens yet -->
      <div v-else-if="customTokens.length === 0 && !searchQuery" class="empty-state">
        <div class="empty-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 6v12M6 12h12"/>
          </svg>
        </div>
        <h4 class="empty-title">No custom tokens yet</h4>
        <p class="empty-text">Tap the + button to add tokens from other contracts</p>
      </div>

      <!-- No Results -->
      <TokenList
        v-if="filteredTokens.length === 0 && searchQuery"
        :items="[]"
        emptyText="No tokens found. Try a different search."
      />

      <!-- Add Token Hint (show only when there are custom tokens) -->
      <div v-if="customTokens.length > 0" class="add-hint">
        <button class="add-link" @click="handleAddToken">
          + Add custom token
        </button>
      </div>
    </main>

    <!-- Floating Add Button -->
    <Button class="fab" variant="primary" :pill="false" @click="handleAddToken">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/>
        <line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
    </Button>
  </ScreenShell>
</template>

<style scoped>
/* Search - uses TextField component */
.search-container {
  padding: var(--space-xs) var(--space-md) var(--space-md);
}

.search-container :deep(.textfield) {
  border-radius: var(--radius-pill);
}

.search-container :deep(.textfield__prefix) {
  color: var(--color-text-muted);
}

/* Loading */
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
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  border: 3px solid var(--color-bg-card);
  border-top-color: var(--color-accent-primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Content */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 0 var(--space-md) 72px;
}

/* Section */
.section {
  margin-bottom: var(--space-lg);
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-sm) var(--space-xs);
}

/* Empty State */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: var(--space-xl) var(--space-md);
  margin: var(--space-lg) 0;
}

.empty-icon {
  width: var(--icon-size-xl);
  height: var(--icon-size-xl);
  border-radius: 50%;
  background: rgba(168, 85, 247, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a855f7;
  margin-bottom: var(--space-lg);
}

.empty-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0 0 var(--space-sm);
}

.empty-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0 0 var(--space-lg);
  max-width: 240px;
  line-height: 1.5;
}

/* Add Hint */
.add-hint {
  text-align: center;
  padding: var(--space-md);
}

.add-link {
  background: none;
  border: none;
  color: var(--color-accent-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
}

.add-link:hover {
  background: rgba(232, 248, 89, 0.1);
}

/* FAB - uses Button component with custom positioning */
.fab {
  position: fixed;
  bottom: var(--space-lg);
  right: var(--space-lg);
  width: var(--control-h);
  height: var(--control-h);
  min-width: var(--control-h);
  padding: 0;
  border-radius: 50%;
  z-index: 30;
}
</style>
