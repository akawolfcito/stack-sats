<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";

const router = useRouter();

// Storage key
const CUSTOM_NETWORKS_KEY = "custom_networks";

// Form state
const networkName = ref("");
const rpcUrl = ref("");
const chainId = ref<number | null>(null);

// UI state
const isLoading = ref(false);
const isTesting = ref(false);
const error = ref("");
const success = ref(false);
const testResult = ref<"success" | "error" | null>(null);

// Custom network interface
interface CustomNetwork {
  id: string;
  name: string;
  rpcUrl: string;
  chainId: number;
  addressPrefix: string;
}

// Validate URL format
const isValidUrl = computed(() => {
  if (!rpcUrl.value.trim()) return false;

  try {
    const url = new URL(rpcUrl.value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
});

// Check if form is valid
const isFormValid = computed(() => {
  return (
    networkName.value.trim().length > 0 &&
    isValidUrl.value &&
    chainId.value !== null &&
    chainId.value > 0
  );
});

// Generate unique ID for network
function generateNetworkId(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const timestamp = Date.now().toString(36);
  return `custom-${slug}-${timestamp}`;
}

// Load custom networks from localStorage
function getCustomNetworks(): CustomNetwork[] {
  const stored = localStorage.getItem(CUSTOM_NETWORKS_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as CustomNetwork[];
  } catch {
    return [];
  }
}

// Save custom networks to localStorage
function saveCustomNetworks(networks: CustomNetwork[]): void {
  localStorage.setItem(CUSTOM_NETWORKS_KEY, JSON.stringify(networks));
}

// Test network connection
async function handleTestConnection() {
  if (!isValidUrl.value) return;

  isTesting.value = true;
  testResult.value = null;
  error.value = "";

  try {
    const url = rpcUrl.value.trim();
    // Try to fetch node info from the RPC endpoint
    const response = await fetch(`${url}/v2/info`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (response.ok) {
      testResult.value = "success";
    } else {
      testResult.value = "error";
      error.value = `Connection failed: HTTP ${response.status}`;
    }
  } catch (err) {
    testResult.value = "error";
    error.value = "Failed to connect. Check the URL and try again.";
  } finally {
    isTesting.value = false;
  }
}

// Save network
async function handleSaveNetwork() {
  if (!isFormValid.value) return;

  error.value = "";
  isLoading.value = true;

  try {
    const name = networkName.value.trim();

    // Check if network name already exists
    const customNetworks = getCustomNetworks();
    const exists = customNetworks.some(
      (n) => n.name.toLowerCase() === name.toLowerCase()
    );

    if (exists) {
      error.value = "A network with this name already exists";
      isLoading.value = false;
      return;
    }

    // Determine address prefix based on chain ID
    // Chain ID 1 = mainnet (SP), others = testnet (ST)
    const addressPrefix = chainId.value === 1 ? "SP" : "ST";

    // Create new network
    const newNetwork: CustomNetwork = {
      id: generateNetworkId(name),
      name,
      rpcUrl: rpcUrl.value.trim(),
      chainId: chainId.value || 1,
      addressPrefix,
    };

    // Save to custom networks
    customNetworks.push(newNetwork);
    saveCustomNetworks(customNetworks);

    // Show success and navigate back
    success.value = true;
    setTimeout(() => {
      router.back();
    }, 1000);
  } catch (err) {
    error.value = "Failed to save network. Please try again.";
  } finally {
    isLoading.value = false;
  }
}

// Navigation
function handleBack() {
  router.back();
}
</script>

<template>
  <div class="add-network-view">
    <!-- Header -->
    <header class="header">
      <button class="back-btn" @click="handleBack">
        <span class="back-arrow">&larr;</span>
      </button>
      <h1 class="title">Custom Network</h1>
      <div class="header-spacer"></div>
    </header>

    <!-- Content -->
    <main class="content">
      <!-- Network Name -->
      <div class="input-group">
        <label class="input-label" for="network-name">Network Name</label>
        <input
          id="network-name"
          v-model="networkName"
          type="text"
          class="input"
          placeholder="My Custom Node"
        />
      </div>

      <!-- RPC URL -->
      <div class="input-group">
        <label class="input-label" for="rpc-url">RPC URL</label>
        <div class="input-with-action">
          <input
            id="rpc-url"
            v-model="rpcUrl"
            type="url"
            class="input"
            :class="{ invalid: rpcUrl && !isValidUrl }"
            placeholder="https://..."
          />
          <button
            class="test-btn"
            :class="{
              testing: isTesting,
              success: testResult === 'success',
              error: testResult === 'error'
            }"
            :disabled="!isValidUrl || isTesting"
            @click="handleTestConnection"
          >
            <span v-if="isTesting" class="spinner-small"></span>
            <span v-else-if="testResult === 'success'">&#10003;</span>
            <span v-else-if="testResult === 'error'">&#10007;</span>
            <span v-else>Test</span>
          </button>
        </div>
        <p class="input-hint">Address of the custom node to connect to</p>
        <p v-if="rpcUrl && !isValidUrl" class="input-error">
          Please enter a valid URL (http:// or https://)
        </p>
      </div>

      <!-- Chain ID -->
      <div class="input-group">
        <label class="input-label" for="chain-id">Chain ID</label>
        <input
          id="chain-id"
          v-model.number="chainId"
          type="number"
          class="input"
          placeholder="1"
          min="1"
        />
        <p class="input-hint">
          Use 1 for mainnet-compatible, or 2147483648 for testnet-compatible
        </p>
      </div>

      <!-- Info Box -->
      <div class="info-box">
        <span class="info-icon">&#9432;</span>
        <div class="info-content">
          <p class="info-title">About Custom Networks</p>
          <p class="info-text">
            Custom networks allow you to connect to your own Stacks node or a third-party RPC provider.
            Make sure you trust the node you're connecting to.
          </p>
        </div>
      </div>

      <!-- Error Message -->
      <p v-if="error" class="error-message">{{ error }}</p>

      <!-- Success Message -->
      <p v-if="success" class="success-message">Network added successfully!</p>
    </main>

    <!-- Save Button -->
    <div class="footer">
      <button
        class="save-btn"
        :class="{ disabled: !isFormValid || isLoading }"
        :disabled="!isFormValid || isLoading"
        @click="handleSaveNetwork"
      >
        <span v-if="isLoading" class="spinner-small"></span>
        {{ isLoading ? 'Saving...' : 'Save Network' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.add-network-view {
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
  position: sticky;
  top: 0;
  z-index: 50;
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
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
}

.header-spacer {
  width: 40px;
}

/* Content */
.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-xl) var(--space-lg);
  padding-bottom: 120px;
  display: flex;
  flex-direction: column;
  gap: var(--space-xl);
}

/* Input Groups */
.input-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.input-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  margin-left: var(--space-xs);
  transition: color var(--transition-fast);
}

.input-group:focus-within .input-label {
  color: var(--color-accent-primary);
}

.input {
  width: 100%;
  height: 56px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 0 var(--space-lg);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  outline: none;
  transition: all var(--transition-fast);
}

.input::placeholder {
  color: var(--color-text-muted);
}

.input:focus {
  border-color: var(--color-accent-primary);
}

.input.invalid {
  border-color: var(--color-error);
}

.input-with-action {
  display: flex;
  gap: var(--space-sm);
}

.input-with-action .input {
  flex: 1;
}

.test-btn {
  height: 56px;
  padding: 0 var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
  min-width: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.test-btn:hover:not(:disabled) {
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
}

.test-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.test-btn.testing {
  border-color: var(--color-warning);
}

.test-btn.success {
  border-color: var(--color-success);
  color: var(--color-success);
  background: var(--color-success-muted);
}

.test-btn.error {
  border-color: var(--color-error);
  color: var(--color-error);
  background: var(--color-error-muted);
}

.input-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-left: var(--space-xs);
}

.input-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin-left: var(--space-xs);
}

/* Info Box */
.info-box {
  display: flex;
  gap: var(--space-md);
  padding: var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.info-icon {
  color: var(--color-accent-primary);
  font-size: var(--font-size-xl);
  flex-shrink: 0;
}

.info-content {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.info-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.info-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  line-height: 1.5;
  margin: 0;
}

/* Messages */
.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

.success-message {
  color: var(--color-success);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

/* Footer */
.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--space-lg);
  padding-bottom: var(--space-xl);
  background: linear-gradient(to top, var(--color-bg-primary) 60%, transparent);
  z-index: 40;
}

.save-btn {
  width: 100%;
  height: 56px;
  background: var(--color-accent-primary);
  border: none;
  border-radius: var(--radius-xl);
  color: var(--color-bg-primary);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  transition: all var(--transition-base);
  box-shadow: 0 4px 12px var(--color-accent-primary-muted);
}

.save-btn:hover:not(.disabled) {
  background: var(--color-accent-primary-hover);
  transform: translateY(-1px);
}

.save-btn:active:not(.disabled) {
  transform: scale(0.98);
}

.save-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.spinner-small {
  width: 20px;
  height: 20px;
  border: 2px solid var(--color-bg-primary);
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
