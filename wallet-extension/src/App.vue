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
const hasLegacyWallet = ref(false);

// Check wallet state
const checkWalletState = () => {
  hasWallet.value = sessionManager.hasWallet;
  isLocked.value = sessionManager.isLocked;

  // Check for legacy unencrypted wallet
  hasLegacyWallet.value = localStorage.getItem("mnemonic") !== null;
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

// Checking if popup was opened from a webpage with a payload, or via the extension icon.
// The `tabId` and `payload` are passed as query params from the openPopupConfirmation function of background.js.
onBeforeMount(() => {
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

  // Support legacy unencrypted wallets during transition
  if (hasLegacyWallet.value) return true;

  // For encrypted wallets, show confirmation even when locked
  // Confirmation component has built-in PIN input
  return hasWallet.value;
};
</script>

<template>
  <!-- If payload is present and wallet is available, show Confirmation -->
  <div v-if="payload && canShowConfirmation()">
    <Confirmation :payload="payload" :tabId="tabId" :origin="origin" />
  </div>

  <!-- If payload but wallet is locked, show unlock prompt message -->
  <div v-else-if="payload && hasWallet && isLocked" class="unlock-prompt">
    <img src="/laser-eyes-lil-guy-dark.png" width="60px" alt="logo" />
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
</style>
