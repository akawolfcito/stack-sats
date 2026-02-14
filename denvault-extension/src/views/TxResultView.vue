<script setup lang="ts">
/**
 * TxResultView - V52.2 Fullscreen Transaction Result
 *
 * Design rule: Fullscreen for security-critical/irreversible steps
 * (VerifyPinView, ConfirmTxView, TxResultView)
 *
 * V52.2 Changes:
 * - Polling with exponential backoff
 * - Timeout UX with "still pending" message
 * - Coherent CTAs based on state
 * - Uses setConfirmed from draft
 *
 * V52.1 (retained):
 * - Reads from useTxDraft composable (single source of truth)
 * - No query params for tx data
 * - Guard redirect if draft has no result
 */
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { Button } from "@/components/ui";
import { NETWORKS } from "@/utils/network";
import { useTxDraft } from "@/composables/useTxDraft";

const router = useRouter();

// V52.2: Single source of truth with setConfirmed
const { draft, hasResult, isSuccess, isError, setConfirmed, clearDraft } = useTxDraft();

// V52.2: Status states - pending | confirmed | timeout | error
type TxStatus = "pending" | "confirmed" | "timeout" | "error";
const status = ref<TxStatus>("pending");

// V52.2: Polling with exponential backoff
let pollTimeout: ReturnType<typeof setTimeout> | null = null;
const POLL_TIMEOUT_MS = 60000; // 1 minute total timeout
const INITIAL_POLL_INTERVAL = 1000; // Start at 1s
const MAX_POLL_INTERVAL = 10000; // Max 10s between polls
const BACKOFF_FACTOR = 1.5;
const pollStartTime = ref(0);
let currentPollInterval = INITIAL_POLL_INTERVAL;

// V52.2: Copy feedback
const copied = ref(false);

// Computed - V52.2: Read from draft
const explorerUrl = computed(() => {
  if (!draft.txid) return "";
  const base = NETWORKS[draft.network]?.explorerUrl;
  if (!base) return "";
  const formattedTxId = draft.txid.startsWith("0x") ? draft.txid : `0x${draft.txid}`;
  const chainParam = draft.network === "mainnet" ? "" : `?chain=${draft.network}`;
  return `${base}/txid/${formattedTxId}${chainParam}`;
});

const txidShort = computed(() => {
  if (!draft.txid) return "";
  const id = draft.txid.startsWith("0x") ? draft.txid.slice(2) : draft.txid;
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}...${id.slice(-8)}`;
});

// V52.2: Header title based on status
const headerTitle = computed(() => {
  switch (status.value) {
    case "pending": return "Broadcasting...";
    case "confirmed": return "Transaction Sent";
    case "timeout": return "Transaction Pending";
    case "error": return "Transaction Failed";
    default: return "Transaction";
  }
});

const statusIconClass = computed(() => {
  switch (status.value) {
    case "pending": return "status-icon--pending";
    case "confirmed": return "status-icon--success";
    case "timeout": return "status-icon--timeout";
    case "error": return "status-icon--error";
    default: return "";
  }
});

// V52.2: Status message based on state
const statusMessage = computed(() => {
  switch (status.value) {
    case "pending": return "Broadcasting to network...";
    case "confirmed": return "Your transaction has been sent";
    case "timeout": return "Transaction broadcast, waiting for confirmation";
    case "error": return draft.error || "Transaction failed";
    default: return "";
  }
});

// Check if test/dev network (for chip warning style)
const isTestOrDev = computed(() => {
  const label = draft.networkLabel.toLowerCase();
  return label.includes("test") || label.includes("dev");
});

// V52.2: Read from draft on mount
onMounted(() => {
  // Guard: must have result data
  if (!hasResult.value) {
    router.push({ path: "/send", query: { error: "no-result" } });
    return;
  }

  // Determine initial status from draft
  if (isError.value) {
    status.value = "error";
  } else if (isSuccess.value) {
    status.value = "pending";
    startPolling();
  }
});

onUnmounted(() => {
  stopPolling();
});

// V52.2: Polling with exponential backoff
function startPolling() {
  pollStartTime.value = Date.now();
  currentPollInterval = INITIAL_POLL_INTERVAL;
  schedulePoll();
}

function schedulePoll() {
  pollTimeout = setTimeout(() => {
    const elapsed = Date.now() - pollStartTime.value;

    // V52.2: Simulated - in real implementation, this would poll the API
    // For demo, confirm after 3 seconds
    if (elapsed >= 3000) {
      status.value = "confirmed";
      setConfirmed();
      stopPolling();
      return;
    }

    // V52.2: Timeout after 1 minute - show "still pending" state
    if (elapsed >= POLL_TIMEOUT_MS) {
      status.value = "timeout";
      stopPolling();
      return;
    }

    // V52.2: Exponential backoff for next poll
    currentPollInterval = Math.min(
      currentPollInterval * BACKOFF_FACTOR,
      MAX_POLL_INTERVAL
    );
    schedulePoll();
  }, currentPollInterval);
}

function stopPolling() {
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
}

// V52.2: Copy with feedback
function handleCopyTxid() {
  if (draft.txid) {
    navigator.clipboard.writeText(draft.txid);
    copied.value = true;
    setTimeout(() => { copied.value = false; }, 2000);
  }
}

function handleOpenExplorer() {
  if (explorerUrl.value) {
    window.open(explorerUrl.value, "_blank");
  }
}

function handleDone() {
  clearDraft();
  router.push({ path: "/user" });
}

function handleTryAgain() {
  clearDraft();
  router.push({ path: "/send" });
}
</script>

<template>
  <ScreenShell :padded="false" data-roi="tx-result-screen">
    <template #header>
      <AppHeader
        :title="headerTitle"
        left="none"
        data-roi="tx-result-title"
      />
    </template>

    <div class="tx-result-view" data-roi="tx-result-root">
      <!-- Ambient glow wrapper - clips oversized glow -->
      <div class="ambient-wrapper">
        <div class="ambient-glow" :class="{ 'ambient-glow--error': status === 'error' }"></div>
      </div>

      <!-- V52.1: Network Chip (pill style) - reads from draft -->
      <div class="result-header" data-roi="tx-result-header">
        <span class="network-chip" :class="{ 'network-chip--warning': isTestOrDev }">
          <span class="network-dot" />
          <span class="network-label">{{ draft.networkLabel }}</span>
        </span>
      </div>

      <!-- V52.2: Status Icon with timeout state -->
      <div class="status-section" data-roi="tx-result-status">
        <div class="status-icon" :class="statusIconClass">
          <!-- Pending: Spinner -->
          <svg v-if="status === 'pending'" class="spinner-svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" stroke-opacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round" />
          </svg>
          <!-- Confirmed: Checkmark -->
          <svg v-else-if="status === 'confirmed'" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <!-- Timeout: Clock icon -->
          <svg v-else-if="status === 'timeout'" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <!-- Error: X -->
          <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>

        <p class="status-label">{{ statusMessage }}</p>
      </div>

      <!-- V52.1: Summary Card (success/pending states) - reads from draft -->
      <div v-if="status !== 'error'" class="summary-card" data-roi="tx-result-summary">
        <!-- Amount Block -->
        <div class="summary-block">
          <div class="summary-row">
            <span class="row-label">Amount</span>
            <span class="row-value row-value--amount">{{ draft.amountDisplay }}</span>
          </div>
          <div class="summary-row">
            <span class="row-label">To</span>
            <span class="row-value row-value--address">{{ draft.recipientShort }}</span>
          </div>
        </div>

        <!-- Divider -->
        <div class="block-divider" />

        <!-- TxId Block -->
        <div class="summary-block">
          <div class="summary-row summary-row--txid" data-roi="tx-result-txid">
            <span class="row-label">Tx ID</span>
            <div class="row-value row-value--txid">
              <span class="txid-text">{{ txidShort }}</span>
              <button class="icon-btn icon-btn--ghost" @click="handleCopyTxid" aria-label="Copy transaction ID">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Error Card -->
      <div v-else class="error-card" data-roi="tx-result-error">
        <p class="error-text">{{ draft.error || 'An unknown error occurred' }}</p>
      </div>

      <!-- V52.2: Hint based on state -->
      <div v-if="status === 'confirmed' || status === 'timeout'" class="hint-text" data-roi="tx-result-hint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4M12 8h.01" />
        </svg>
        <span v-if="status === 'confirmed'">Transaction confirmation may take a few minutes.</span>
        <span v-else>Check explorer for confirmation status.</span>
      </div>
    </div>

    <!-- V52.2: CTA Rail with coherent actions per state -->
    <div class="cta-rail" data-roi="tx-result-cta-rail">
      <!-- Pending: Disabled Done (wait) -->
      <template v-if="status === 'pending'">
        <Button v-if="explorerUrl" variant="ghost" full-width @click="handleOpenExplorer">
          View in Explorer
        </Button>
        <Button variant="primary" full-width disabled>
          Please wait...
        </Button>
      </template>
      <!-- Confirmed/Timeout: Explorer + Done -->
      <template v-else-if="status === 'confirmed' || status === 'timeout'">
        <Button v-if="explorerUrl" variant="ghost" full-width @click="handleOpenExplorer">
          View in Explorer
        </Button>
        <Button variant="primary" full-width @click="handleDone">
          Done
        </Button>
      </template>
      <!-- Error: Cancel + Try Again -->
      <template v-else>
        <Button variant="ghost" full-width @click="handleDone">
          Cancel
        </Button>
        <Button variant="primary" full-width @click="handleTryAgain">
          Try Again
        </Button>
      </template>
    </div>
  </ScreenShell>
</template>

<style scoped>
/* V52: Universal box-sizing for this component */
.tx-result-view,
.tx-result-view *,
.tx-result-view *::before,
.tx-result-view *::after,
.cta-rail,
.cta-rail * {
  box-sizing: border-box;
}

/* V52: Fullscreen result view layout - ZERO overflow without hacks */
.tx-result-view {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  padding: 0 var(--space-lg);
  padding-bottom: 120px;
  overflow-y: auto;
  width: 100%;
  max-width: 100%;
}

/* Ambient glow wrapper - clips the oversized glow element */
.ambient-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 200px;
  overflow: hidden;
  pointer-events: none;
}

/* Ambient Glow - safely clipped by wrapper */
.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 100%;
  background: var(--color-success);
  opacity: 0.04;
  filter: blur(100px);
  border-radius: 50%;
  transition: background 0.3s ease;
}

.ambient-glow--error {
  background: var(--color-error);
}

/* === Network Chip === */
.result-header {
  display: flex;
  justify-content: center;
  padding: var(--space-md) 0;
  position: relative;
  z-index: 1;
}

.network-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px var(--space-sm);
  background: var(--color-success-muted);
  border-radius: var(--radius-pill);
}

.network-chip--warning {
  background: var(--color-warning-muted);
}

.network-dot {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--color-success);
}

.network-chip--warning .network-dot {
  background: var(--color-warning);
}

.network-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

/* === Status Section === */
.status-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  margin: var(--space-xl) 0;
  position: relative;
  z-index: 1;
}

.status-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0a0a0a;
}

.status-icon--pending {
  background: var(--surface-hover);
  color: var(--color-text-muted);
}

.status-icon--success {
  background: var(--color-success);
  box-shadow: var(--shadow-success-lg);
}

.status-icon--error {
  background: var(--color-error);
  color: var(--color-text-primary);
  box-shadow: var(--shadow-error-lg);
}

/* V52.2: Timeout state - warning color */
.status-icon--timeout {
  background: var(--color-warning);
  color: #0a0a0a;
  box-shadow: var(--shadow-warning-lg, 0 4px 24px rgba(234, 179, 8, 0.3));
}

/* Spinner animation */
.spinner-svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.status-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  text-align: center;
  margin: 0;
}

/* === Summary Card === */
.summary-card {
  padding: var(--space-md);
  background: var(--surface-hover);
  border: 1px solid var(--textfield-border);
  border-radius: var(--radius-control);
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 100%;
}

.summary-block {
  display: flex;
  flex-direction: column;
}

.block-divider {
  height: 1px;
  background: var(--textfield-border);
  margin: var(--space-sm) 0;
  opacity: 0.6;
}

/* Summary rows - 2-column CSS Grid */
.summary-row {
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr);
  column-gap: var(--space-md);
  align-items: center;
  min-height: 32px;
  padding: 4px 0;
}

.summary-row--txid {
  min-height: 36px;
}

/* Row labels */
.row-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  min-width: 0;
}

/* Row values */
.row-value {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
  text-align: right;
  justify-self: end;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-value--amount {
  font-weight: var(--font-weight-semibold);
}

.row-value--address {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
  letter-spacing: 0.01em;
}

.row-value--txid {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--space-xs);
  overflow: visible;
}

.txid-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-normal);
  color: var(--color-text-muted);
  letter-spacing: 0.01em;
}

/* Ghost icon button */
.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex: 0 0 auto;
  background: transparent;
  border: none;
  border-radius: var(--radius-xs);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  line-height: 0;
  padding: 0;
}

.icon-btn--ghost:hover {
  background: var(--surface-pressed);
  color: var(--color-text-primary);
}

.icon-btn--ghost:active {
  background: var(--surface-pressed);
}

.icon-btn svg {
  display: block;
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

/* === Error Card === */
.error-card {
  padding: var(--space-lg);
  background: rgba(255, 82, 82, 0.08);
  border: 1px solid rgba(255, 82, 82, 0.2);
  border-radius: var(--radius-control);
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 100%;
}

.error-text {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-error);
  text-align: center;
  margin: 0;
  word-break: break-word;
}

/* === Hint Text === */
.hint-text {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  position: relative;
  z-index: 1;
}

.hint-text svg {
  flex-shrink: 0;
  opacity: 0.6;
}

/* === CTA Rail === */
.cta-rail {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-lg);
  background: var(--color-bg-primary);
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  z-index: 10;
  padding-bottom: max(var(--space-lg), env(safe-area-inset-bottom));
  width: 100%;
  max-width: 100%;
}
</style>
