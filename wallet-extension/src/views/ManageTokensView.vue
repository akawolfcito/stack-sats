<script setup lang="ts">
import { ref, computed, onBeforeMount } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

// Token interface
interface Token {
  contractId: string;
  symbol: string;
  name: string;
  color: string;
}

// Known tokens list (can be expanded)
const KNOWN_TOKENS: Token[] = [
  { contractId: "STX", symbol: "STX", name: "Stacks", color: "#7c3aed" },
  { contractId: "SP3K8BC0PPEVCV7NZ6QSRWPQ2JE9E5B6N3PA0KBR9.token-alex::alex", symbol: "ALEX", name: "Alex Lab", color: "#f97316" },
  { contractId: "SP3NE50GEXFG9SZGTT51P40X2CKYSZ5CC4ZTZ7A2G.welshcorgicoin-token::welshcorgicoin", symbol: "WELSH", name: "Welshcorgicoin", color: "#eab308" },
  { contractId: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.arkadiko-token::diko", symbol: "DIKO", name: "Arkadiko", color: "#3b82f6" },
  { contractId: "SP2C2YFP12AJZB4MABJBAJ55XECVS7E4PMMZ89YZR.usda-token::usda", symbol: "USDA", name: "Arkadiko Stablecoin", color: "#22c55e" },
  { contractId: "SP1H1733V5MZ3SZ9XRW9FKYGEZT0JDGEB8Y634C7R.miamicoin-token-v2::miamicoin", symbol: "MIA", name: "MiamiCoin", color: "#ec4899" },
  { contractId: "SPSCWDV3RKV5ZRN1FQD84YE1NQFEDJ9R1F4DYQ11.newyorkcitycoin-token-v2::newyorkcitycoin", symbol: "NYC", name: "NewYorkCityCoin", color: "#06b6d4" },
  { contractId: "SP3DX3H4FEYZJZ586MFBS25ZW3HZDMEW92260R2PR.Wrapped-Bitcoin::wrapped-bitcoin", symbol: "xBTC", name: "Wrapped Bitcoin", color: "#f7931a" },
];

// Storage key
const ENABLED_TOKENS_KEY = "enabled_tokens";

// State
const searchQuery = ref("");
const enabledTokens = ref<Set<string>>(new Set());
const isLoading = ref(true);

// Load enabled tokens from localStorage
onBeforeMount(() => {
  const stored = localStorage.getItem(ENABLED_TOKENS_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as string[];
      enabledTokens.value = new Set(parsed);
    } catch {
      // Default: enable STX only
      enabledTokens.value = new Set(["STX"]);
    }
  } else {
    // Default: enable STX only
    enabledTokens.value = new Set(["STX"]);
  }
  isLoading.value = false;
});

// Save enabled tokens to localStorage
function saveEnabledTokens() {
  const arr = Array.from(enabledTokens.value);
  localStorage.setItem(ENABLED_TOKENS_KEY, JSON.stringify(arr));
}

// Filter tokens by search query
const filteredTokens = computed(() => {
  const query = searchQuery.value.toLowerCase().trim();
  if (!query) return KNOWN_TOKENS;

  return KNOWN_TOKENS.filter(
    (t) =>
      t.symbol.toLowerCase().includes(query) ||
      t.name.toLowerCase().includes(query) ||
      t.contractId.toLowerCase().includes(query)
  );
});

// Separate active and available tokens
const activeTokens = computed(() => {
  return filteredTokens.value.filter((t) => enabledTokens.value.has(t.contractId));
});

const availableTokens = computed(() => {
  return filteredTokens.value.filter((t) => !enabledTokens.value.has(t.contractId));
});

// Check if token is enabled
function isEnabled(contractId: string): boolean {
  return enabledTokens.value.has(contractId);
}

// Toggle token
function toggleToken(contractId: string) {
  if (enabledTokens.value.has(contractId)) {
    // Don't allow disabling STX
    if (contractId === "STX") return;
    enabledTokens.value.delete(contractId);
  } else {
    enabledTokens.value.add(contractId);
  }
  // Trigger reactivity
  enabledTokens.value = new Set(enabledTokens.value);
  saveEnabledTokens();
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
  <div class="manage-tokens-view">
    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="handleBack">
        <span class="back-arrow">&larr;</span>
      </button>
      <h1 class="title">Manage Tokens</h1>
      <div class="header-spacer"></div>
    </header>

    <!-- Search Bar -->
    <div class="search-container">
      <div class="search-wrapper">
        <span class="search-icon">&#128269;</span>
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search tokens or add by contract"
        />
      </div>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading tokens...</p>
    </div>

    <!-- Content -->
    <main v-else class="content">
      <!-- Active Assets Section -->
      <div v-if="activeTokens.length > 0" class="section">
        <h3 class="section-title">Active Assets</h3>
        <div class="token-list">
          <div
            v-for="token in activeTokens"
            :key="token.contractId"
            class="token-item"
          >
            <div class="token-info">
              <div
                class="token-icon"
                :style="{ backgroundColor: token.color + '20', borderColor: token.color + '40' }"
              >
                <span class="token-letter" :style="{ color: token.color }">
                  {{ token.symbol.charAt(0) }}
                </span>
              </div>
              <div class="token-details">
                <span class="token-symbol">{{ token.symbol }}</span>
                <span class="token-name">{{ token.name }}</span>
              </div>
            </div>
            <label class="toggle" :class="{ disabled: token.contractId === 'STX' }">
              <input
                type="checkbox"
                :checked="isEnabled(token.contractId)"
                :disabled="token.contractId === 'STX'"
                @change="toggleToken(token.contractId)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- Available Tokens Section -->
      <div v-if="availableTokens.length > 0" class="section">
        <h3 class="section-title">Available Tokens</h3>
        <div class="token-list">
          <div
            v-for="token in availableTokens"
            :key="token.contractId"
            class="token-item"
          >
            <div class="token-info">
              <div
                class="token-icon"
                :style="{ backgroundColor: token.color + '20', borderColor: token.color + '40' }"
              >
                <span class="token-letter" :style="{ color: token.color }">
                  {{ token.symbol.charAt(0) }}
                </span>
              </div>
              <div class="token-details">
                <span class="token-symbol">{{ token.symbol }}</span>
                <span class="token-name">{{ token.name }}</span>
              </div>
            </div>
            <label class="toggle">
              <input
                type="checkbox"
                :checked="isEnabled(token.contractId)"
                @change="toggleToken(token.contractId)"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </div>

      <!-- No Results -->
      <div v-if="filteredTokens.length === 0" class="no-results">
        <p class="no-results-text">No tokens found</p>
        <p class="no-results-hint">Try a different search or add a custom token</p>
      </div>

      <!-- Add Token Hint -->
      <div class="add-hint">
        <p class="hint-text">Don't see your token?</p>
        <p class="hint-subtext">Add it manually via contract address</p>
      </div>
    </main>

    <!-- Floating Add Button -->
    <button class="fab" @click="handleAddToken">
      <span class="fab-icon">+</span>
    </button>
  </div>
</template>

<style scoped>
.manage-tokens-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
  position: relative;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-lg);
  padding-top: var(--space-xl);
  padding-bottom: var(--space-sm);
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--color-bg-primary);
}

.back-btn {
  background: none;
  border: none;
  color: var(--color-text-primary);
  font-size: 1.25rem;
  cursor: pointer;
  padding: var(--space-sm);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-pill);
}

.back-btn:hover {
  background: var(--color-bg-card);
}

.title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.header-spacer {
  width: 40px;
}

/* Search */
.search-container {
  padding: var(--space-sm) var(--space-lg) var(--space-lg);
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: var(--space-lg);
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  pointer-events: none;
}

.search-input {
  width: 100%;
  height: 48px;
  padding: 0 var(--space-lg) 0 48px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-input:focus {
  border-color: var(--color-accent-primary);
  box-shadow: 0 0 0 2px var(--color-accent-primary-muted);
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
  width: 40px;
  height: 40px;
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
  padding: 0 var(--space-lg) 100px;
}

/* Section */
.section {
  margin-bottom: var(--space-xl);
}

.section-title {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0 0 var(--space-md) var(--space-sm);
}

/* Token List */
.token-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.token-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
}

.token-item:hover {
  border-color: var(--color-border-hover);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.token-info {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.token-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid;
  flex-shrink: 0;
}

.token-letter {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.token-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.token-symbol {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.token-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Toggle Switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-elevated);
  border-radius: 24px;
  transition: all var(--transition-base);
}

.toggle-slider::before {
  position: absolute;
  content: "";
  height: 20px;
  width: 20px;
  left: 2px;
  bottom: 2px;
  background-color: var(--color-text-muted);
  border-radius: 50%;
  transition: all var(--transition-base);
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-accent-primary);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(20px);
  background-color: var(--color-bg-primary);
}

.toggle input:focus + .toggle-slider {
  box-shadow: 0 0 0 2px var(--color-accent-primary-muted);
}

.toggle.disabled .toggle-slider {
  cursor: not-allowed;
}

/* No Results */
.no-results {
  text-align: center;
  padding: var(--space-2xl) var(--space-lg);
}

.no-results-text {
  color: var(--color-text-secondary);
  font-size: var(--font-size-base);
  margin: 0 0 var(--space-sm);
}

.no-results-hint {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}

/* Add Hint */
.add-hint {
  text-align: center;
  padding: var(--space-xl) var(--space-lg);
  margin-top: var(--space-lg);
}

.hint-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0 0 var(--space-xs);
}

.hint-subtext {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  margin: 0;
}

/* FAB */
.fab {
  position: fixed;
  bottom: var(--space-xl);
  right: var(--space-xl);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--color-accent-primary);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px var(--color-accent-primary-muted);
  transition: all var(--transition-base);
  z-index: 30;
}

.fab:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 16px var(--color-accent-primary-muted);
}

.fab:active {
  transform: scale(0.95);
}

.fab-icon {
  font-size: 32px;
  font-weight: var(--font-weight-bold);
  color: var(--color-bg-primary);
  line-height: 1;
}
</style>
