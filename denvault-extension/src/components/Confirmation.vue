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
import { onBeforeMount, onBeforeUnmount, onMounted, ref, computed, watch } from "vue";
import {
  handleSignMessage,
  handleGetAddresses,
  handleCallContract,
  handleTransferStx,
  handleSignStructuredData,
  handleDeployContract,
} from "../utils/stxmethods";
import { toQueueApproveResult, isRpcErrorEnvelope } from "@/utils/stxmethods/queue";
import { decodeBigInts } from "@/utils/stxmethods/wire";
import type { JsonRpcRequest, Result } from "@/utils/types";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import StickyCTA from "@/components/layout/StickyCTA.vue";
import PinInput from "@/components/PinInput.vue";
import "@/components/ui"; // Button used in template
import { sessionManager } from "@/utils/security/session";
import { secureLog, secureWarn } from "@/utils/security/logger";
import { emitTxSignRequested, emitTxSignResult } from "@/denlabs/emit";
import { fetchCanonicalRequest, resolveDisplayPayload } from "@/composables/useCanonicalRequest";
import { getAccountCount, getAllAccountNames } from "@/utils/accounts/settings";
import {
  buildAccountOptions,
  getActiveAccountIndex,
  type AccountOption,
} from "@/utils/accounts/active";
import { describeFailure, type FailureReport } from "@/utils/dapp/failure";
import {
  assessFunding,
  fundingNeed,
  toMicro,
  type FundingAssessment,
} from "@/utils/dapp/funding";
import { fetchStxBalance } from "@/utils/balance";
import { formatStxFromMicro } from "@/utils/balance/format";
import { TRANSFER_FEE_MICRO_STX } from "@/utils/transfer";
import { generateInitialAccounts } from "@/utils/accounts";
import { getSelectedNetwork } from "@/utils/network";

const isUnlocked = ref(false);
const pinError = ref("");
const isProcessing = ref(false);

/**
 * Set when an approved request did not go through.
 *
 * The window used to forward the error to the dApp and close itself 150ms
 * later, so approving a deploy from an empty account ended with no
 * transaction, no message and no sign anything had been attempted. The
 * dApp was told; the person who pressed Approve was not, and silence
 * looks exactly like success. The reply still leaves immediately: only
 * the closing waits for the user to have read it.
 */
const failure = ref<FailureReport | null>(null);

/** Report the failure and stop, rather than reporting it and vanishing. */
function reportFailure(code: number | undefined, message: string) {
  failure.value = describeFailure(code, message);
  isProcessing.value = false;
}

/**
 * Whether the signing account can pay for this, worked out before the PIN
 * rather than after the node refuses. A deploy was approved from an empty
 * account and died on the network; the balance was knowable all along.
 *
 * Null while unknown, which is not the same as zero: an unreachable API
 * must never be read as an empty account, so nothing is blocked until
 * there is an answer.
 */
const balanceMicro = ref<bigint | null>(null);
const funding = ref<FundingAssessment | null>(null);

/** Costs nothing, so the whole section stays out of the way. */
const isFreeRequest = computed(() => fundingNeed(displayPayload.value.method) === "none");

const feeMicro = computed(() => {
  const params = (displayPayload.value.params ?? {}) as Record<string, unknown>;
  const requested = toMicro(params.fee);
  return requested > 0n ? requested : TRANSFER_FEE_MICRO_STX;
});

const blockedByBalance = computed(() => funding.value?.blocks === true);

const fundingLines = computed(() => {
  if (isFreeRequest.value || balanceMicro.value === null || !funding.value) return null;
  return {
    balance: formatStxFromMicro(balanceMicro.value.toString()),
    fee: formatStxFromMicro(feeMicro.value.toString()),
    missing:
      funding.value.shortfallMicro > 0n
        ? formatStxFromMicro(funding.value.shortfallMicro.toString())
        : null,
  };
});

/**
 * Look up the balance of the account that would sign, and judge it.
 *
 * Needs an unlocked session to derive the address, so it runs on mount
 * when the wallet is already open and again the moment the PIN opens it.
 * Either way it lands before Approve, which is the part that matters.
 */
async function assessBalance() {
  if (isFreeRequest.value) return;

  const mnemonic = sessionManager.getMnemonic();
  if (!mnemonic) return;

  try {
    const network = getSelectedNetwork();
    const accounts = await generateInitialAccounts(
      mnemonic,
      selectedAccountIndex.value + 1,
      network
    );
    const address = accounts[selectedAccountIndex.value]?.stxAddress;
    if (!address) return;

    const raw = await fetchStxBalance(address, network);
    if (raw === null) {
      // Unknown, so nothing is claimed and nothing is blocked.
      balanceMicro.value = null;
      funding.value = null;
      return;
    }

    const params = (displayPayload.value.params ?? {}) as Record<string, unknown>;
    balanceMicro.value = toMicro(raw);
    funding.value = assessFunding({
      method: displayPayload.value.method,
      balanceMicro: balanceMicro.value,
      feeMicro: feeMicro.value,
      amountMicro: toMicro(params.amount),
      sponsored: params.sponsored === true,
    });
  } catch (error) {
    secureWarn("Balance check failed", { error: String(error) });
    balanceMicro.value = null;
    funding.value = null;
  }
}

// Account selector state. Populated in onMounted from the accounts that
// actually exist — a fixed list of three used to hide accounts 4+ and,
// worse, ignore the account the user was operating as.
const selectedAccountIndex = ref(0);
const availableAccounts = ref<AccountOption[]>([]);

// DenLabs: Track sign request for latency measurement
const txSignStartTime = ref<number>(0);

const props = defineProps<{
  payload: JsonRpcRequest;
  tabId: string;
  origin?: string;
  isQueueMode?: boolean;
  /**
   * True when this screen is an overlay inside a surface the user keeps
   * open, such as the side panel. Closing the window there would take the
   * whole wallet with it, so the screen is dismissed instead.
   */
  dismissOnly?: boolean;
  requestId?: string;
}>();

const emit = defineEmits<{ dismiss: [] }>();

/**
 * H1: every rendered field reads from here, never from `props.payload`.
 * In queue mode this holds background's canonical params, so what the
 * user reviews is byte-for-byte what handleConfirm signs. Until the
 * fetch resolves (and in legacy URL mode) it falls back to the local
 * payload, which is the only source available there.
 */
const canonicalPayload = ref<JsonRpcRequest | null>(null);
const displayPayload = computed<JsonRpcRequest>(() => canonicalPayload.value ?? props.payload);

onBeforeMount(() => {
  // Check if session is already unlocked
  isUnlocked.value = !sessionManager.isLocked;
});

onMounted(async () => {
  // DenLabs: Emit TX sign requested event
  txSignStartTime.value = Date.now();
  const walletId = sessionManager.activeWalletId || "unknown";
  emitTxSignRequested(
    walletId,
    "stacks-mainnet", // Default chain for Stacks wallet
    "stacks",
    props.origin || "unknown"
  );

  // P1-4: Subscribe to explicit error feedback from background (queue mode only).
  if (props.isQueueMode && typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener(handleResponseError);
  }

  // Offer the accounts that exist, and default to the one the user is
  // actually operating as — this index derives the signing key.
  const accountCount = await getAccountCount();
  const accountNames = await getAllAccountNames();
  availableAccounts.value = buildAccountOptions(accountCount, accountNames);
  selectedAccountIndex.value = getActiveAccountIndex(accountCount);

  // H1: pull the canonical params so the review screen renders the same
  // bytes that will be signed.
  const display = await resolveDisplayPayload({
    payload: props.payload,
    isQueueMode: props.isQueueMode,
    requestId: props.requestId,
  });
  if (display.source === "canonical") {
    canonicalPayload.value = display.payload;
  } else if (props.isQueueMode) {
    secureWarn("Canonical request unavailable for display; rendering local payload", {
      requestId: props.requestId,
    });
  }

  // After the canonical params land, so the amount and fee judged are the
  // ones that will be signed.
  void assessBalance();
});

// Signing with a different account means a different balance to check.
watch(selectedAccountIndex, () => {
  balanceMicro.value = null;
  funding.value = null;
  void assessBalance();
});

onBeforeUnmount(() => {
  if (props.isQueueMode && typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.removeListener(handleResponseError);
  }
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
  return descriptions[displayPayload.value.method] || displayPayload.value.method;
});

// Format params for display
const formattedParams = computed(() => {
  if (!displayPayload.value.params) return null;

  const params = displayPayload.value.params as Record<string, unknown>;
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
  if (params.name && displayPayload.value.method === "stx_deployContract") {
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
  const method = displayPayload.value?.method;
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
  const method = displayPayload.value?.method;
  return method !== "getAddresses" && method !== "stx_getAddresses" && method !== "stx_getAccounts";
});

secureLog("Incoming request", { method: props.payload.method, tabId: props.tabId, queueMode: props.isQueueMode });

// Queue mode: send response via background message. `result` is the inner
// JSON-RPC result, never a full envelope: background adds the envelope.
function sendQueueApprove(result: unknown) {
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

/**
 * P1-4: Listener for explicit error responses from background. Fires
 * when the popup's approve/reject decision was rejected (stale ID,
 * already resolved, etc.). Without this the user would believe their
 * decision succeeded while the dApp times out.
 */
function handleResponseError(message: unknown): undefined {
  const m = message as { type?: string; requestId?: string; error?: { code: number; message: string } };
  if (m?.type !== "DAPP_RESPONSE_ERROR") return undefined;
  if (m.requestId && m.requestId !== props.requestId) return undefined;

  isProcessing.value = false;
  pinError.value = m.error?.message || "Request error";
  secureWarn("Background rejected popup decision", { error: m.error });
  return undefined;
}

// Close window/tab based on context (popup vs full-page)
function closeWindow() {
  if (props.dismissOnly) {
    emit("dismiss");
    return;
  }

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
    // Now that there is a session, the signing address can be derived.
    void assessBalance();
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

  // P0-3: In queue mode, the canonical params live in background's
  // activeRequest. Fetch them now and sign against THOSE bytes — never
  // against props.payload, which a tampered popup could mutate between
  // display and approval. Legacy URL mode keeps using props.payload
  // because there is no background queue entry to consult.
  let signingPayload: JsonRpcRequest = props.payload;
  if (props.isQueueMode) {
    const canonical = await fetchCanonicalRequest(props.requestId);
    if (!canonical) {
      secureWarn("Canonical request unavailable; aborting approve", {
        requestId: props.requestId,
      });
      isProcessing.value = false;
      pinError.value = "Request expired or no longer active";
      handleReject("Request expired or no longer active");
      return;
    }
    signingPayload = canonical;
  }

  // Undo the tagging injection.js applies so a Clarity uint can cross a
  // JSON bridge. One place, because every method's params come through
  // here, whether from the queue or from the legacy URL payload.
  signingPayload = {
    ...signingPayload,
    params: decodeBigInts(signingPayload.params),
  };

  try {
    switch (signingPayload.method) {
      case "getAddresses":
      case "stx_getAddresses":
      case "stx_getAccounts":
        result = await handleGetAddresses(signingPayload, mnemonic, accountIndex);
        break;
      case "stx_signMessage":
        result = await handleSignMessage(signingPayload, mnemonic, accountIndex);
        break;
      case "stx_callContract":
        result = await handleCallContract(signingPayload, mnemonic, accountIndex);
        break;
      case "stx_transferStx":
        result = await handleTransferStx(signingPayload, mnemonic, accountIndex);
        break;
      case "stx_signStructuredMessage":
        result = await handleSignStructuredData(signingPayload, mnemonic, accountIndex);
        break;
      case "stx_deployContract":
        result = await handleDeployContract(signingPayload, mnemonic, accountIndex);
        break;
      // stx_transferSip10Ft, stx_signTransaction, signPsbt and sendTransfer
      // used to sit here as empty stubs while injection.js advertised them.
      // They are no longer advertised, so a dApp gets a clean "not
      // supported" before any popup opens. Re-add a case here only
      // together with its handler and its entry in SUPPORTED_METHODS.
      default:
        secureWarn("Unknown method", { method: signingPayload.method });
        break;
    }

    // A handler answers COMPLETE with an error envelope when the dApp
    // sent something invalid. That is a reply, and it belongs to the
    // dApp: forwarding it as an approval buried a precise -32602 under an
    // internal message about envelopes.
    if (result.status === "COMPLETE" && isRpcErrorEnvelope(result.data)) {
      const { error } = result.data as { error: { code: number; message: string } };
      secureWarn("Handler returned an error envelope", { code: error.code });

      if (props.isQueueMode) {
        sendQueueReject({ code: error.code, message: error.message });
      } else {
        await chrome.tabs.sendMessage(parseInt(props.tabId), result.data);
      }
      reportFailure(error.code, error.message);
      return;
    }

    if (result.status === "COMPLETE") {
      // Send response based on mode
      if (props.isQueueMode) {
        // Background wraps this in its own JSON-RPC envelope, so only the
        // inner result travels. See toQueueApproveResult.
        sendQueueApprove(toQueueApproveResult(result.data));
      } else {
        await chrome.tabs.sendMessage(parseInt(props.tabId), result.data);
      }
      secureLog("Response sent successfully", { method: signingPayload.method, queueMode: props.isQueueMode });

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
      if (signingPayload.method === "getAddresses" || signingPayload.method === "stx_getAddresses" || signingPayload.method === "stx_getAccounts") {
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
        id: signingPayload.id,
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
        id: signingPayload.id,
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

    // The dApp already has the error. Stay put so the person who pressed
    // Approve gets it too, instead of watching the window vanish.
    reportFailure(-32603, errorMsg);
    return;
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

    <!-- What happened, when it did not happen. Replaces the review, so
         nobody approves the same thing twice while reading why it failed. -->
    <main v-if="failure" class="confirm-content" data-roi="confirm-failure">
      <div class="failure-state">
        <div class="failure-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="13" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h2 class="failure-title" data-roi="confirm-failure-title">{{ failure.title }}</h2>
        <p class="failure-detail" data-roi="confirm-failure-detail">{{ failure.detail }}</p>
        <p v-if="failure.recoverable" class="failure-hint">
          Nothing was sent. You can change it and try again.
        </p>
      </div>
    </main>

    <!-- Main Content -->
    <main v-else class="confirm-content">
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
        <pre class="raw-payload" data-roi="confirm-details-panel">{{ JSON.stringify(displayPayload, null, 2) }}</pre>
      </details>

      <!-- PIN input if not unlocked -->
      <div v-if="!isUnlocked" class="pin-section">
        <p class="pin-required">Enter PIN to confirm</p>
        <PinInput mode="unlock" @complete="handlePinComplete" />
      </div>

      <!-- What this costs and whether the account can cover it. Shown
           whether or not it can: a figure that only appears when something
           is wrong teaches people to fear the screen. -->
      <div v-if="fundingLines" class="funding-card" data-roi="confirm-funding">
        <div class="funding-row">
          <span>Balance</span>
          <span class="funding-value">{{ fundingLines.balance }} STX</span>
        </div>
        <div class="funding-row">
          <span>Estimated fee</span>
          <span class="funding-value">{{ fundingLines.fee }} STX</span>
        </div>
        <div v-if="fundingLines.missing" class="funding-row funding-row--short" data-roi="confirm-funding-short">
          <span>Missing</span>
          <span class="funding-value">{{ fundingLines.missing }} STX</span>
        </div>
      </div>

      <!-- V55.2: Reserved error slot (anti-layout-shift) -->
      <div class="error-slot" data-roi="confirm-error-slot" aria-live="polite">
        <p v-if="pinError" class="error-text">{{ pinError }}</p>
        <p v-else-if="blockedByBalance" class="error-text" data-roi="confirm-blocked-reason">
          This account cannot cover the network fee. Receive STX into it, or pick another account.
        </p>
        <p v-else-if="funding?.warns" class="warn-text" data-roi="confirm-funding-warning">
          Signing costs nothing, but this account could not pay for this transaction when it is sent.
        </p>
      </div>
    </main>

    <!-- One way out when it failed: reading it and closing. Approve would
         resend what the network just refused. -->
    <template v-if="failure" #footer>
      <StickyCTA
        primary-text="Close"
        :show-arrow="false"
        roi-prefix="confirm-failure"
        data-roi="confirm-failure-cta"
        @primary="closeWindow()"
      />
    </template>

    <!-- V55.2: Sticky CTA footer with Deny/Approve -->
    <template v-else #footer>
      <StickyCTA
        primary-text="Approve"
        :primary-disabled="!isUnlocked || isProcessing || blockedByBalance"
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
  /* .confirm-content is a flex column, and `overflow: hidden` sets this
     item's automatic minimum size to zero. Without this the card was the
     one that gave way whenever the content did not fit: the summary
     flattened to a hairline and the payload, present in the DOM with its
     text, rendered at zero height. The panel looked empty. */
  flex-shrink: 0;
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

.funding-card {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-md, 12px);
  background: var(--color-surface-2, rgba(255, 255, 255, 0.04));
}

.funding-row {
  display: flex;
  justify-content: space-between;
  gap: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.funding-value {
  font-variant-numeric: tabular-nums;
  color: var(--color-text-primary);
}

.funding-row--short,
.funding-row--short .funding-value {
  color: var(--color-danger, #ef4444);
}

.warn-text {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.4;
  color: var(--color-warning, #f59e0b);
}

.failure-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-sm);
  padding: var(--space-xl) var(--space-md);
}

.failure-icon {
  color: var(--color-danger, #ef4444);
}

.failure-title {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold, 600);
  color: var(--color-text-primary);
}

.failure-detail {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
  /* The node's own words can be long and unbroken. */
  overflow-wrap: anywhere;
}

.failure-hint {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
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
