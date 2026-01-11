<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import StickyCTA from "@/components/layout/StickyCTA.vue";

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
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        title="Custom Network"
        left="back"
        @left-click="handleBack"
      />
    </template>

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
    <template #footer>
      <StickyCTA
        :primary-text="isLoading ? 'Saving...' : 'Save Network'"
        :primary-disabled="!isFormValid || isLoading"
        @primary="handleSaveNetwork"
      />
    </template>
  </ScreenShell>
</template>

<style scoped>
/* Content */
.content {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-md) var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--section-gap);
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
  color: var(--color-text-secondary); /* v17: neutral focus */
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
  border-color: var(--color-border-hover); /* v17: neutral focus */
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
  border-color: var(--color-border-hover); /* v17: neutral hover */
  color: var(--color-text-primary);
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
  color: var(--color-text-secondary); /* v17: neutral info icon */
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

</style>
