<script setup lang="ts">
import { onBeforeMount, ref, computed } from "vue";
import {
  handleSignMessage,
  handleGetAddresses,
  handleCallContract,
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
  return "Origen desconocido";
});

// Get human-readable method description
const methodDescription = computed(() => {
  const descriptions: Record<string, string> = {
    getAddresses: "Solicitar direcciones de tu wallet",
    stx_getAddresses: "Solicitar direcciones de tu wallet",
    stx_signMessage: "Firmar un mensaje",
    stx_callContract: "Llamar un contrato inteligente",
    stx_transferStx: "Transferir STX",
    stx_transferSip10Ft: "Transferir token fungible",
    stx_signTransaction: "Firmar una transacción",
    stx_signStructuredMessage: "Firmar mensaje estructurado",
    stx_deployContract: "Desplegar contrato",
    signPsbt: "Firmar PSBT (Bitcoin)",
    sendTransfer: "Enviar transferencia",
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
    formatted["Mensaje"] = String(params.message).substring(0, 100);
  }
  if (params.contract) {
    formatted["Contrato"] = String(params.contract);
  }
  if (params.contractAddress) {
    formatted["Dirección del contrato"] = String(params.contractAddress);
  }
  if (params.contractName) {
    formatted["Nombre del contrato"] = String(params.contractName);
  }
  if (params.functionName) {
    formatted["Función"] = String(params.functionName);
  }
  if (params.amount !== undefined) {
    formatted["Cantidad"] = String(params.amount) + " microSTX";
  }
  if (params.recipient) {
    formatted["Destinatario"] = String(params.recipient);
  }

  return Object.keys(formatted).length > 0 ? formatted : null;
});

secureLog("Incoming request", { method: props.payload.method, tabId: props.tabId });

async function handlePinComplete(pin: string) {
  const success = await sessionManager.unlock(pin);
  if (success) {
    isUnlocked.value = true;
    pinError.value = "";
  } else {
    const remaining = 3 - sessionManager.failedAttempts;
    pinError.value = `PIN incorrecto. Intentos restantes: ${remaining}`;
    if (remaining <= 0) {
      handleReject("Demasiados intentos fallidos");
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
    handleReject("Sesión no válida");
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
        // TODO: implement
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
  setTimeout(() => window.close(), 150);
}

function handleReject(reason?: string) {
  if (!props.tabId) {
    window.close();
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

  window.close();
}
</script>

<template>
  <section class="confirmation-page">
    <!-- Header with origin -->
    <div class="confirmation-header">
      <img src="/laser-eyes-lil-guy-dark.png" width="40px" alt="logo" />
      <h2>Confirmar Acción</h2>
    </div>

    <!-- Origin badge -->
    <div class="origin-badge">
      <span class="origin-label">Solicitado por:</span>
      <span class="origin-value">{{ displayOrigin }}</span>
    </div>

    <!-- Method description -->
    <div class="method-info">
      <p class="method-description">{{ methodDescription }}</p>
    </div>

    <!-- Transaction details -->
    <div v-if="formattedParams" class="params-section">
      <h3>Detalles</h3>
      <div class="params-list">
        <div v-for="(value, key) in formattedParams" :key="key" class="param-row">
          <span class="param-key">{{ key }}:</span>
          <span class="param-value">{{ value }}</span>
        </div>
      </div>
    </div>

    <!-- Raw payload (collapsible) -->
    <details class="raw-details">
      <summary>Ver datos completos</summary>
      <pre class="raw-payload">{{ JSON.stringify(props.payload, null, 2) }}</pre>
    </details>

    <!-- PIN input if not unlocked -->
    <div v-if="!isUnlocked" class="pin-section">
      <p class="pin-required">Ingresa tu PIN para confirmar</p>
      <PinInput mode="unlock" @complete="handlePinComplete" />
      <p v-if="pinError" class="error-text">{{ pinError }}</p>
    </div>

    <!-- Action buttons -->
    <div class="action-buttons">
      <button class="reject-btn" @click="handleReject()" :disabled="isProcessing">
        Rechazar
      </button>
      <button
        class="confirm-btn"
        @click="handleConfirm"
        :disabled="!isUnlocked || isProcessing"
      >
        {{ isProcessing ? "Procesando..." : "Confirmar" }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.confirmation-page {
  padding: 1rem;
  max-width: 360px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 100vh;
  box-sizing: border-box;
}

.confirmation-header {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid #333;
}

.confirmation-header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.origin-badge {
  background: #1a1a2e;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.origin-label {
  font-size: 0.75rem;
  color: #888;
}

.origin-value {
  font-size: 0.9rem;
  color: #5546ff;
  font-weight: 500;
  word-break: break-all;
}

.method-info {
  background: rgba(85, 70, 255, 0.1);
  border: 1px solid rgba(85, 70, 255, 0.3);
  border-radius: 8px;
  padding: 1rem;
}

.method-description {
  margin: 0;
  color: #fff;
  font-weight: 500;
}

.params-section {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 1rem;
}

.params-section h3 {
  margin: 0 0 0.75rem 0;
  font-size: 0.9rem;
  color: #888;
}

.params-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.param-row {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.param-key {
  font-size: 0.75rem;
  color: #888;
}

.param-value {
  font-size: 0.85rem;
  color: #fff;
  word-break: break-all;
}

.raw-details {
  background: #0f0f1a;
  border-radius: 8px;
  padding: 0.75rem;
}

.raw-details summary {
  cursor: pointer;
  color: #888;
  font-size: 0.8rem;
}

.raw-payload {
  margin: 0.75rem 0 0 0;
  font-size: 0.7rem;
  overflow-x: auto;
  max-height: 150px;
  color: #aaa;
}

.pin-section {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
}

.pin-required {
  margin: 0 0 1rem 0;
  color: #fff;
  font-size: 0.9rem;
}

.error-text {
  color: #dc3545;
  font-size: 0.85rem;
  margin: 0.5rem 0 0 0;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  margin-top: auto;
  padding-top: 1rem;
}

.reject-btn {
  flex: 1;
  padding: 1rem;
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
}

.reject-btn:hover:not(:disabled) {
  background: #c82333;
}

.reject-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.confirm-btn {
  flex: 1;
  padding: 1rem;
  background: #5546ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 500;
  cursor: pointer;
}

.confirm-btn:hover:not(:disabled) {
  background: #4438cc;
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
