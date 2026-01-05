<script setup lang="ts">
import { RouterView, useRouter } from "vue-router";
import { onBeforeMount, ref, watch } from "vue";
import Confirmation from "./components/Confirmation.vue";
import type { JsonRpcRequest } from "@/utils/types";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";

const router = useRouter();

const payload = ref<JsonRpcRequest>();
const tabId = ref<string>("");
const origin = ref<string>("");
const hasWallet = ref(false);
const isLocked = ref(true);
const isInitializing = ref(true);

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

// Checking if popup was opened from a webpage with a payload, or via the extension icon.
// The `tabId` and `payload` are passed as query params from the openPopupConfirmation function of background.js.
onBeforeMount(async () => {
  // Initialize session manager (handles migration from localStorage to chrome.storage.local)
  try {
    await sessionManager.initialize();
    isInitializing.value = false;
  } catch (error) {
    secureLog("Session initialization error", error);
    isInitializing.value = false;
  }

  checkWalletState();

  const capturedSearchParams = new URLSearchParams(document.location.search);

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
        secureLog("Received RPC request", { method: payloadObject.method });
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
</script>

<template>
  <!-- Show loading while initializing -->
  <div v-if="isInitializing" class="initializing">
    <div class="loader"></div>
    <p>Initializing...</p>
  </div>

  <!-- If payload is present and wallet is available, show Confirmation -->
  <div v-else-if="payload && canShowConfirmation()">
    <Confirmation :payload="payload" :tabId="tabId" :origin="origin" />
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
  <div style="height: 100%" v-else>
    <RouterView />
  </div>
</template>

<style scoped>
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
