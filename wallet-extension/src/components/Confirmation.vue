<script setup lang="ts">
import { onBeforeMount, ref, computed } from "vue";
import {
  handleSignMessage,
  handleGetAddresses,
  handleCallContract,
  handleTransferStx,
} from "../utils/stxmethods";
import type { JsonRpcRequest, Result } from "@/utils/types";
import PinInput from "@/components/PinInput.vue";
import { sessionManager } from "@/utils/security/session";
import { secureLog, secureWarn } from "@/utils/security/logger";

const isUnlocked = ref(false);
const pinError = ref("");
const isProcessing = ref(false);

onBeforeMount(() => {
  // Check if session is already unlocked
  isUnlocked.value = !sessionManager.isLocked;
});

const props = defineProps<{
  payload: JsonRpcRequest;
  tabId: string;
  origin?: string;
}>();

// Extract origin for display
const displayOrigin = computed(() => {
  if (props.origin) {
    try {
      const url = new URL(decodeURIComponent(props.origin));
      return url.hostname + (url.port ? ":" + url.port : "");
    } catch {
      return props.origin;
    }
  }
  return "Unknown origin";
});

// Get human-readable method description
const methodDescription = computed(() => {
  const descriptions: Record<string, string> = {
    getAddresses: "Request wallet addresses",
    stx_getAddresses: "Request wallet addresses",
    stx_signMessage: "Sign a message",
    stx_callContract: "Call a smart contract",
    stx_transferStx: "Transfer STX",
    stx_transferSip10Ft: "Transfer fungible token",
    stx_signTransaction: "Sign a transaction",
    stx_signStructuredMessage: "Sign structured message",
    stx_deployContract: "Deploy contract",
    signPsbt: "Sign PSBT (Bitcoin)",
    sendTransfer: "Send transfer",
  };
  return descriptions[props.payload.method] || props.payload.method;
});

// Format params for display
const formattedParams = computed(() => {
  if (!props.payload.params) return null;

  const params = props.payload.params as Record<string, unknown>;
  const formatted: Record<string, string> = {};

  // Show relevant fields based on method
  if (params.message) {
    formatted["Message"] = String(params.message).substring(0, 100);
  }
  if (params.contract) {
    formatted["Contract"] = String(params.contract);
  }
  if (params.contractAddress) {
    formatted["Contract Address"] = String(params.contractAddress);
  }
  if (params.contractName) {
    formatted["Contract Name"] = String(params.contractName);
  }
  if (params.functionName) {
    formatted["Function"] = String(params.functionName);
  }
  if (params.amount !== undefined) {
    formatted["Amount"] = String(params.amount) + " microSTX";
  }
  if (params.recipient) {
    formatted["Recipient"] = String(params.recipient);
  }

  return Object.keys(formatted).length > 0 ? formatted : null;
});

secureLog("Incoming request", { method: props.payload.method, tabId: props.tabId });

// Close window/tab based on context (popup vs full-page)
function closeWindow() {
  // Full-page mode: viewport is larger than popup dimensions
  if (window.innerWidth > 400 || window.innerHeight > 650) {
    chrome.tabs.getCurrent((tab) => {
      if (tab?.id) {
        chrome.tabs.remove(tab.id);
      } else {
        window.close();
      }
    });
  } else {
    window.close();
  }
}

async function handlePinComplete(pin: string) {
  const success = await sessionManager.unlock(pin);
  if (success) {
    isUnlocked.value = true;
    pinError.value = "";
  } else {
    const remaining = 3 - sessionManager.failedAttempts;
    pinError.value = `Incorrect PIN. Attempts remaining: ${remaining}`;
    if (remaining <= 0) {
      handleReject("Too many failed attempts");
    }
  }
}

async function handleConfirm() {
  if (!props.tabId || isProcessing.value) return;

  isProcessing.value = true;

  let result: Result = {
    method: "",
    status: "",
    data: {},
  };

  // Get mnemonic from session
  const mnemonic = sessionManager.getMnemonic();
  if (!mnemonic) {
    secureWarn("No mnemonic available in session");
    handleReject("Invalid session");
    return;
  }

  const accountIndex = 0; // TODO: get from user selection

  try {
    switch (props.payload.method) {
      case "getAddresses":
      case "stx_getAddresses":
        result = await handleGetAddresses(props.payload, mnemonic, accountIndex);
        break;
      case "stx_signMessage":
        result = await handleSignMessage(props.payload, mnemonic, accountIndex);
        break;
      case "stx_callContract":
        result = await handleCallContract(props.payload, mnemonic, accountIndex);
        break;
      case "stx_transferStx":
        result = await handleTransferStx(props.payload, mnemonic, accountIndex);
        break;
      case "stx_transferSip10Ft":
        // TODO: implement
        break;
      case "stx_signTransaction":
        // TODO: implement
        break;
      case "stx_signStructuredMessage":
        // TODO: implement
        break;
      case "stx_deployContract":
        // TODO: implement
        break;
      case "signPsbt":
        // TODO: implement
        break;
      case "sendTransfer":
        // TODO: implement
        break;
      default:
        secureWarn("Unknown method", { method: props.payload.method });
        break;
    }

    if (result.status === "COMPLETE") {
      await chrome.tabs.sendMessage(parseInt(props.tabId), result.data);
      secureLog("Response sent successfully", { method: props.payload.method });

      // Cache getAddresses response for auto-approval
      if (props.payload.method === "getAddresses" || props.payload.method === "stx_getAddresses") {
        try {
          const cacheKey = `approved_${props.origin}`;
          await chrome.storage.session.set({ [cacheKey]: result.data });
          secureLog("Cached addresses for origin", { origin: props.origin });
        } catch (error) {
          secureLog("Failed to cache addresses", { error: String(error) });
        }
      }
    } else {
      await chrome.tabs.sendMessage(parseInt(props.tabId), {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal Error",
        },
        id: props.payload.id,
      });
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    secureWarn("Error processing request", { error: errorMsg });
    await chrome.tabs.sendMessage(parseInt(props.tabId), {
      jsonrpc: "2.0",
      error: {
        code: -32603,
        message: errorMsg,
      },
      id: props.payload.id,
    });
  }

  // Delay to ensure message is sent before closing
  setTimeout(() => closeWindow(), 150);
}

function handleReject(reason?: string) {
  if (!props.tabId) {
    closeWindow();
    return;
  }

  chrome.tabs.sendMessage(parseInt(props.tabId), {
    jsonrpc: "2.0",
    error: {
      code: 4001,
      message: reason || "User rejected the request",
    },
    id: props.payload.id,
  });

  closeWindow();
}
</script>

<template>
  <section class="confirmation-page">
    <!-- Header -->
    <div class="confirmation-header">
      <button class="close-btn" @click="handleReject()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <h2>CONFIRM ACTION</h2>
      <div class="header-spacer"></div>
    </div>

    <!-- Origin badge -->
    <div class="origin-badge">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <span>Requested by: <strong>{{ displayOrigin }}</strong></span>
    </div>

    <!-- Method icon and description -->
    <div class="method-section">
      <div class="method-icon">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 12l2 2 4-4"/>
        </svg>
      </div>
      <h3 class="method-title">{{ methodDescription }}</h3>
      <p class="method-subtitle">This action will allow the app to view your balances and activity.</p>
    </div>

    <!-- Transaction details -->
    <div v-if="formattedParams" class="params-section">
      <div class="params-list">
        <div v-for="(value, key) in formattedParams" :key="key" class="param-row">
          <span class="param-key">{{ key }}</span>
          <span class="param-value">{{ value }}</span>
        </div>
      </div>
    </div>

    <!-- Raw payload (collapsible) -->
    <details class="raw-details">
      <summary>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
        <span>View full data</span>
        <svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </summary>
      <pre class="raw-payload">{{ JSON.stringify(props.payload, null, 2) }}</pre>
    </details>

    <!-- PIN input if not unlocked -->
    <div v-if="!isUnlocked" class="pin-section">
      <p class="pin-required">ENTER YOUR PIN TO CONFIRM</p>
      <PinInput mode="unlock" @complete="handlePinComplete" />
      <p v-if="pinError" class="error-text">{{ pinError }}</p>
    </div>

    <!-- Action buttons -->
    <div class="action-buttons">
      <button class="reject-btn" @click="handleReject()" :disabled="isProcessing">
        Reject
      </button>
      <button
        class="confirm-btn"
        @click="handleConfirm"
        :disabled="!isUnlocked || isProcessing"
      >
        {{ isProcessing ? "Processing..." : "Confirm" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.confirmation-page {
  padding: var(--space-lg);
  max-width: 360px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  min-height: 100vh;
  box-sizing: border-box;
}

.confirmation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.close-btn {
  width: 40px;
  height: 40px;
  background: none;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.close-btn:hover {
  opacity: 0.7;
}

.header-spacer {
  width: 40px;
}

.confirmation-header h2 {
  margin: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  letter-spacing: 1px;
  color: var(--color-text-primary);
}

.origin-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.origin-badge svg {
  stroke: var(--color-accent-primary);
}

.origin-badge strong {
  color: var(--color-text-primary);
}

.method-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-md);
}

.method-icon {
  width: 72px;
  height: 72px;
  background: var(--color-accent-primary);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.method-icon svg {
  stroke: var(--color-bg-primary);
}

.method-title {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  font-style: italic;
}

.method-subtitle {
  margin: 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.params-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg);
}

.params-list {
  display: flex;
  flex-direction: column;
}

.param-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: var(--space-sm) 0;
  border-bottom: 1px solid var(--color-border);
}

.param-row:last-child {
  border-bottom: none;
}

.param-key {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
}

.param-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  text-align: right;
  word-break: break-all;
  max-width: 60%;
}

.raw-details {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.raw-details summary {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-lg);
  cursor: pointer;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.raw-details summary::-webkit-details-marker {
  display: none;
}

.raw-details summary .chevron {
  margin-left: auto;
  transition: transform var(--transition-base);
}

.raw-details[open] summary .chevron {
  transform: rotate(180deg);
}

.raw-payload {
  margin: 0;
  padding: var(--space-md) var(--space-lg);
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  overflow-x: auto;
  max-height: 150px;
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
}

.pin-section {
  text-align: center;
}

.pin-required {
  margin: 0 0 var(--space-lg) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  letter-spacing: 1px;
}

.action-buttons {
  display: flex;
  gap: var(--space-md);
  margin-top: auto;
  padding-top: var(--space-lg);
}

.reject-btn {
  flex: 1;
  padding: var(--space-lg);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.reject-btn:hover:not(:disabled) {
  border-color: var(--color-border-hover);
  background: var(--color-bg-card-hover);
}

.reject-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.confirm-btn {
  flex: 1;
  padding: var(--space-lg);
  background: var(--color-accent-primary);
  color: var(--color-bg-primary);
  border: none;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
}

.confirm-btn:hover:not(:disabled) {
  background: var(--color-accent-primary-hover);
}

.confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
