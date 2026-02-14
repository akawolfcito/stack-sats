<script setup lang="ts">
/**
 * Confirmation.vue - V55.2 Shell Migration
 *
 * dApp approval screen migrated to V55 shell system.
 *
 * V55.2 Changes:
 * - Migrated to ScreenShell + AppHeader + StickyCTA pattern
 * - Added data-roi attributes for E2E testing
 * - Reserved error slot height (anti-layout-shift)
 * - Normalized header to V55 contract (close button left)
 * - Primary CTA always visible in sticky footer
 *
 * Trust-critical flow: Users approve dApp requests here.
 */
import { onBeforeMount, onMounted, ref, computed } from "vue";
import {
  handleSignMessage,
  handleGetAddresses,
  handleCallContract,
  handleTransferStx,
  handleSignStructuredData,
  handleDeployContract,
} from "../utils/stxmethods";
import type { JsonRpcRequest, Result } from "@/utils/types";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import StickyCTA from "@/components/layout/StickyCTA.vue";
import PinInput from "@/components/PinInput.vue";
import "@/components/ui"; // Button used in template
import { sessionManager } from "@/utils/security/session";
import { secureLog, secureWarn } from "@/utils/security/logger";
import { emitTxSignRequested, emitTxSignResult } from "@/denlabs/emit";

const isUnlocked = ref(false);
const pinError = ref("");
const isProcessing = ref(false);

// Account selector state
const selectedAccountIndex = ref(0);
const availableAccounts = ref<Array<{ index: number; label: string }>>([
  { index: 0, label: "Account 1" },
  { index: 1, label: "Account 2" },
  { index: 2, label: "Account 3" },
]);

// DenLabs: Track sign request for latency measurement
const txSignStartTime = ref<number>(0);

const props = defineProps<{
  payload: JsonRpcRequest;
  tabId: string;
  origin?: string;
  isQueueMode?: boolean;
  requestId?: string;
}>();

onBeforeMount(() => {
  // Check if session is already unlocked
  isUnlocked.value = !sessionManager.isLocked;
});

onMounted(() => {
  // DenLabs: Emit TX sign requested event
  txSignStartTime.value = Date.now();
  const walletId = sessionManager.activeWalletId || "unknown";
  emitTxSignRequested(
    walletId,
    "stacks-mainnet", // Default chain for Stacks wallet
    "stacks",
    props.origin || "unknown"
  );
});

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
    stx_getAccounts: "Request wallet accounts",
    stx_signMessage: "Sign a message",
    stx_callContract: "Call a smart contract",
    stx_transferStx: "Transfer STX",
    stx_transferSip10Ft: "Transfer fungible token",
    stx_signTransaction: "Sign a transaction",
    stx_signStructuredMessage: "Sign structured data (SIP-018)",
    stx_deployContract: "Deploy smart contract",
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
    try {
      const microStx = BigInt(params.amount as string | number);
      const stx = Number(microStx) / 1_000_000;
      formatted["Amount"] = `${stx.toFixed(6)} STX`;
    } catch {
      formatted["Amount"] = String(params.amount) + " microSTX";
    }
  }
  if (params.recipient) {
    formatted["Recipient"] = String(params.recipient);
  }
  if (params.name && props.payload.method === "stx_deployContract") {
    formatted["Contract Name"] = String(params.name);
  }
  if (params.clarityCode) {
    formatted["Code Size"] = `${String(params.clarityCode).length} chars`;
  }
  if (params.clarityVersion !== undefined && params.clarityVersion !== null) {
    formatted["Clarity Version"] = String(params.clarityVersion);
  }
  if (params.domain) {
    formatted["Domain"] = "SIP-018 structured data";
  }

  return Object.keys(formatted).length > 0 ? formatted : null;
});

// Dynamic subtitle per method type
const methodSubtitle = computed(() => {
  const method = props.payload?.method;
  switch (method) {
    case "getAddresses":
    case "stx_getAddresses":
      return "Share your wallet addresses with this app";
    case "stx_getAccounts":
      return "Share your wallet accounts with this app";
    case "stx_transferStx":
      return "Send STX to a recipient address";
    case "stx_callContract":
      return "Execute a smart contract function";
    case "stx_signMessage":
      return "Sign a message for verification";
    case "stx_signStructuredMessage":
      return "Sign structured data per SIP-018 for verification";
    case "stx_deployContract":
      return "Deploy a Clarity smart contract on-chain";
    default:
      return "Review this request from the app";
  }
});

// Show account selector for methods that operate on a single account
const showAccountSelector = computed(() => {
  const method = props.payload?.method;
  return method !== "getAddresses" && method !== "stx_getAddresses" && method !== "stx_getAccounts";
});

secureLog("Incoming request", { method: props.payload.method, tabId: props.tabId, queueMode: props.isQueueMode });

// Queue mode: send response via background message
function sendQueueApprove(result: object) {
  chrome.runtime.sendMessage({
    type: "DAPP_APPROVE",
    id: props.requestId,
    result: result,
  });
}

function sendQueueReject(error?: { code: number; message: string }) {
  chrome.runtime.sendMessage({
    type: "DAPP_REJECT",
    id: props.requestId,
    error: error,
  });
}

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

  const accountIndex = selectedAccountIndex.value;

  try {
    switch (props.payload.method) {
      case "getAddresses":
      case "stx_getAddresses":
      case "stx_getAccounts":
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
      case "stx_signStructuredMessage":
        result = await handleSignStructuredData(props.payload, mnemonic, accountIndex);
        break;
      case "stx_deployContract":
        result = await handleDeployContract(props.payload, mnemonic, accountIndex);
        break;
      case "stx_transferSip10Ft":
        // TODO: implement
        break;
      case "stx_signTransaction":
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
      // Send response based on mode
      if (props.isQueueMode) {
        sendQueueApprove(result.data);
      } else {
        await chrome.tabs.sendMessage(parseInt(props.tabId), result.data);
      }
      secureLog("Response sent successfully", { method: props.payload.method, queueMode: props.isQueueMode });

      // DenLabs: Emit TX sign result (approved)
      const walletId = sessionManager.activeWalletId || "unknown";
      emitTxSignResult(
        walletId,
        "stacks-mainnet",
        "stacks",
        props.origin || "unknown",
        "approved",
        txSignStartTime.value
      );

      // Cache getAddresses response for auto-approval
      if (props.payload.method === "getAddresses" || props.payload.method === "stx_getAddresses" || props.payload.method === "stx_getAccounts") {
        try {
          const cacheKey = `approved_${props.origin}`;
          await chrome.storage.session.set({ [cacheKey]: result.data });
          secureLog("Cached addresses for origin", { origin: props.origin });
        } catch (error) {
          secureLog("Failed to cache addresses", { error: String(error) });
        }
      }
    } else {
      const errorResponse = {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal Error",
        },
        id: props.payload.id,
      };
      if (props.isQueueMode) {
        sendQueueReject({ code: -32603, message: "Internal Error" });
      } else {
        await chrome.tabs.sendMessage(parseInt(props.tabId), errorResponse);
      }

      // DenLabs: Emit TX sign result (failed)
      const walletId = sessionManager.activeWalletId || "unknown";
      emitTxSignResult(
        walletId,
        "stacks-mainnet",
        "stacks",
        props.origin || "unknown",
        "failed",
        txSignStartTime.value,
        "INTERNAL_ERROR"
      );
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    secureWarn("Error processing request", { error: errorMsg });
    if (props.isQueueMode) {
      sendQueueReject({ code: -32603, message: errorMsg });
    } else {
      await chrome.tabs.sendMessage(parseInt(props.tabId), {
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: errorMsg,
        },
        id: props.payload.id,
      });
    }

    // DenLabs: Emit TX sign result (failed)
    const walletId = sessionManager.activeWalletId || "unknown";
    emitTxSignResult(
      walletId,
      "stacks-mainnet",
      "stacks",
      props.origin || "unknown",
      "failed",
      txSignStartTime.value,
      errorMsg
    );
  }

  // Delay to ensure message is sent before closing
  setTimeout(() => closeWindow(), 150);
}

function handleReject(reason?: string) {
  const error = {
    code: 4001,
    message: reason || "User rejected the request",
  };

  if (props.isQueueMode) {
    sendQueueReject(error);
  } else if (props.tabId) {
    chrome.tabs.sendMessage(parseInt(props.tabId), {
      jsonrpc: "2.0",
      error: error,
      id: props.payload.id,
    });
  }

  // DenLabs: Emit TX sign result (rejected)
  const walletId = sessionManager.activeWalletId || "unknown";
  emitTxSignResult(
    walletId,
    "stacks-mainnet",
    "stacks",
    props.origin || "unknown",
    "rejected",
    txSignStartTime.value,
    reason
  );

  closeWindow();
}
</script>

<template>
  <ScreenShell :padded="false" data-roi="confirm-screen">
    <!-- V55.2: Normalized header with close button -->
    <template #header>
      <AppHeader
        title="Confirm Action"
        left="close"
        data-roi="confirm-title"
        @left-click="handleReject()"
      />
    </template>

    <!-- Main Content -->
    <main class="confirm-content">
      <!-- Origin badge -->
      <div class="origin-badge" data-roi="confirm-origin">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <span>From: <strong>{{ displayOrigin }}</strong></span>
      </div>

      <!-- Method icon and description -->
      <div class="method-section" data-roi="confirm-summary">
        <div class="method-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
        </div>
        <h3 class="method-title">{{ methodDescription }}</h3>
        <p class="method-subtitle">{{ methodSubtitle }}</p>
      </div>

      <!-- Transaction details / params -->
      <div v-if="formattedParams" class="params-section" data-roi="confirm-account">
        <div class="params-list">
          <div v-for="(value, key) in formattedParams" :key="key" class="param-row">
            <span class="param-key">{{ key }}</span>
            <span class="param-value">{{ value }}</span>
          </div>
        </div>
      </div>

      <!-- Account selector (not needed for getAddresses methods) -->
      <div v-if="showAccountSelector" class="account-selector" data-roi="confirm-account-select">
        <label class="selector-label">Account</label>
        <select v-model="selectedAccountIndex" class="account-select">
          <option v-for="account in availableAccounts" :key="account.index" :value="account.index">
            {{ account.label }}
          </option>
        </select>
      </div>

      <!-- Raw payload (collapsible) -->
      <details class="raw-details" data-roi="confirm-details-toggle">
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
        <pre class="raw-payload" data-roi="confirm-details-panel">{{ JSON.stringify(props.payload, null, 2) }}</pre>
      </details>

      <!-- PIN input if not unlocked -->
      <div v-if="!isUnlocked" class="pin-section">
        <p class="pin-required">Enter PIN to confirm</p>
        <PinInput mode="unlock" @complete="handlePinComplete" />
      </div>

      <!-- V55.2: Reserved error slot (anti-layout-shift) -->
      <div class="error-slot" data-roi="confirm-error-slot" aria-live="polite">
        <p v-if="pinError" class="error-text">{{ pinError }}</p>
      </div>
    </main>

    <!-- V55.2: Sticky CTA footer with Deny/Approve -->
    <template #footer>
      <StickyCTA
        primary-text="Approve"
        :primary-disabled="!isUnlocked || isProcessing"
        secondary-text="Deny"
        :show-arrow="false"
        roi-prefix="confirm"
        data-roi="confirm-cta-rail"
        @primary="handleConfirm"
        @secondary="handleReject()"
      >
        <!-- V55.2: Processing indicator in CTA slot -->
        <p v-if="isProcessing" class="processing-hint">Processing request...</p>
      </StickyCTA>
    </template>
  </ScreenShell>
</template>

<style scoped>
/* V55.2: Main content area with proper padding */
.confirm-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-lg);
  padding: var(--space-md) var(--space-lg);
  padding-bottom: 140px; /* Space for sticky CTA */
  overflow-y: auto;
}

/* V55.2: Origin badge - pill style */
.origin-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-lg);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.origin-badge svg {
  stroke: var(--color-text-muted);
  flex-shrink: 0;
}

.origin-badge strong {
  color: var(--color-text-primary);
}

/* Method section - centered hero */
.method-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-md);
}

.method-icon {
  width: 64px;
  height: 64px;
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
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.method-subtitle {
  margin: 0;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

/* Params section - card style */
.params-section {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-md);
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
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.param-value {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  text-align: right;
  word-break: break-all;
  max-width: 60%;
}

/* Account selector */
.account-selector {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
}

.selector-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
}

.account-select {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  cursor: pointer;
}

/* Raw details - collapsible card */
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
  padding: var(--space-md);
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
  padding: var(--space-md);
  font-size: var(--font-size-xs);
  font-family: var(--font-mono);
  overflow-x: auto;
  max-height: 150px;
  color: var(--color-text-muted);
  background: var(--color-bg-elevated);
  border-top: 1px solid var(--color-border);
}

/* PIN section */
.pin-section {
  text-align: center;
  padding: var(--space-md) 0;
}

.pin-required {
  margin: 0 0 var(--space-md) 0;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

/* V55.2: Reserved error slot (anti-layout-shift) */
.error-slot {
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

/* V55.2: Processing hint in CTA */
.processing-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0 0 var(--space-sm) 0;
}

/* V55.2: Ensure StickyCTA data-roi is applied */
:deep([data-roi="confirm-cta-rail"]) .sticky-cta {
  /* StickyCTA styles preserved */
}
</style>
