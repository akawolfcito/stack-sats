<script setup lang="ts">
import { RouterView, useRouter } from "vue-router";
import { onBeforeMount, onBeforeUnmount, ref, watch, computed } from "vue";
import Confirmation from "./components/Confirmation.vue";
import type { JsonRpcRequest } from "@/utils/types";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import { useUiMode } from "@/composables/useUiMode";
import { emitSessionStarted, emitSessionEnded } from "@/denlabs/emit";

// UI Mode detection (popup vs panel)
const { mode } = useUiMode();
const appRootClass = computed(() => `app-root mode-${mode.value}`);

const router = useRouter();

const payload = ref<JsonRpcRequest>();
const tabId = ref<string>("");
const origin = ref<string>("");
const hasWallet = ref(false);
const isLocked = ref(true);
const isInitializing = ref(true);

// Queue mode state
const isQueueMode = ref(false);
const currentRequestId = ref<string>("");

// Check wallet state
const checkWalletState = () => {
  hasWallet.value = sessionManager.hasWallet;
  isLocked.value = sessionManager.isLocked;
};

// Watch for session lock changes
watch(
  () => sessionManager.state.isLocked.value,
  (locked) => {
    isLocked.value = locked;
    if (locked && hasWallet.value) {
      secureLog("Session locked, redirecting to unlock");
      router.push({ path: "/unlock" });
    }
  }
);

// Watch for initialization completion
watch(
  () => sessionManager.state.isInitialized.value,
  (initialized) => {
    if (initialized) {
      isInitializing.value = false;
      checkWalletState();
    }
  }
);

// Handle DAPP_REQUEST messages from background (queue mode)
function handleDappRequest(request: { id: string; method: string; params: unknown; origin: string }) {
  secureLog("Received DAPP_REQUEST", { method: request.method });
  payload.value = {
    jsonrpc: "2.0",
    id: request.id,
    method: request.method,
    params: request.params,
  };
  currentRequestId.value = request.id;
  origin.value = request.origin;
  tabId.value = "queue"; // Special marker for queue mode
}

// Listen for messages from background (only in extension context)
if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message): undefined => {
    if (message.type === "DAPP_REQUEST" && isQueueMode.value) {
      handleDappRequest(message.payload);
    }
    return undefined;
  });
}

// Checking if popup was opened from a webpage with a payload, or via the extension icon.
// The `tabId` and `payload` are passed as query params from the openPopupConfirmation function of background.js.
onBeforeMount(async () => {
  // Initialize session manager (handles migration from localStorage to chrome.storage.local)
  try {
    await sessionManager.initialize();
    isInitializing.value = false;

    // DenLabs: Emit session started event
    emitSessionStarted();
  } catch (error) {
    secureLog("Session initialization error", error);
    isInitializing.value = false;
  }

  checkWalletState();

  const capturedSearchParams = new URLSearchParams(document.location.search);

  // Check if this is queue mode
  if (capturedSearchParams.get("mode") === "queue") {
    isQueueMode.value = true;
    secureLog("Queue mode enabled, sending UI_READY");
    // Signal to background that UI is ready (only in extension context)
    if (typeof chrome !== "undefined" && chrome.runtime?.sendMessage) {
      chrome.runtime.sendMessage({ type: "UI_READY" });
    }
    return;
  }

  // Legacy mode: payload in URL params
  if (capturedSearchParams.size > 0) {
    const tabIdString = capturedSearchParams.get("tabId") || "0";
    const payloadString = capturedSearchParams.get("payload") || "";
    const originString = capturedSearchParams.get("origin") || "";

    if (payloadString) {
      try {
        const payloadObject = JSON.parse(decodeURIComponent(payloadString));
        payload.value = payloadObject;
        tabId.value = tabIdString;
        origin.value = originString;
        secureLog("Received RPC request (legacy)", { method: payloadObject.method });
      } catch (error) {
        secureLog("Failed to parse payload", error);
      }
    }
  }
});

// Determine if we can show confirmation
// Show confirmation if we have a payload and a wallet exists
// Confirmation component handles its own PIN unlock flow
const canShowConfirmation = () => {
  if (!payload.value) return false;
  return hasWallet.value;
};

// DenLabs: Session end handler
const handleSessionEnd = () => {
  emitSessionEnded("normal");
};

// Register beforeunload to emit session ended
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", handleSessionEnd);
}

onBeforeUnmount(() => {
  if (typeof window !== "undefined") {
    window.removeEventListener("beforeunload", handleSessionEnd);
  }
});
</script>

<template>
  <div :class="appRootClass">
    <!-- Show loading while initializing -->
    <div v-if="isInitializing" class="initializing">
      <div class="loader"></div>
      <p>Initializing...</p>
    </div>

    <!-- If payload is present and wallet is available, show Confirmation -->
    <div v-else-if="payload && canShowConfirmation()" class="app-content">
      <Confirmation
        :payload="payload"
        :tabId="tabId"
        :origin="origin"
        :isQueueMode="isQueueMode"
        :requestId="currentRequestId"
      />
    </div>

    <!-- If payload but wallet is locked, show unlock prompt message -->
    <div v-else-if="payload && hasWallet && isLocked" class="unlock-prompt">
      <img src="/denvault-i.png" width="80px" alt="DenVault" />
      <h2>Wallet Locked</h2>
      <p>Please unlock your wallet to continue</p>
      <button @click="router.push('/unlock')" class="btn-primary">
        Unlock Wallet
      </button>
    </div>

    <!-- Normal router view -->
    <div class="app-content" v-else>
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
/* App Root - Full viewport flex container */
.app-root {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
  background: var(--color-bg-primary);
}

.app-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.unlock-prompt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 20px;
  text-align: center;
  gap: 16px;
}

.unlock-prompt h2 {
  margin: 0;
  font-weight: 700;
}

.unlock-prompt p {
  margin: 0;
  color: #888;
  font-size: 0.9rem;
}

.btn-primary {
  background: #646cff;
  color: white;
  border: none;
  padding: 12px 32px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.btn-primary:hover {
  background: #535bf2;
}

.initializing {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
}

.initializing p {
  color: #888;
  font-size: 0.9rem;
}

.loader {
  width: 40px;
  height: 40px;
  border: 3px solid #333;
  border-top-color: #646cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
