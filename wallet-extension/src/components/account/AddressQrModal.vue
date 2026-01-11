<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import QRCode from "qrcode";
import { Button } from "@/components/ui";

const props = defineProps<{
  isOpen: boolean;
  label: string;
  address: string;
  assetTag: "STX" | "BTC" | "P2TR";
}>();

const emit = defineEmits<{
  close: [];
}>();

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);

function truncateAddress(address: string, chars: number = 10): string {
  if (!address || address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

async function generateQR() {
  if (!qrCanvas.value || !props.address) return;

  const bgColor = props.assetTag === "STX" ? "#1a1c0d" : "#1a1510";

  try {
    await QRCode.toCanvas(qrCanvas.value, props.address, {
      width: 180,
      margin: 2,
      color: {
        dark: "#ffffff",
        light: bgColor,
      },
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("Failed to generate QR code:", error);
  }
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(props.address);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
}

function handleClose() {
  emit("close");
}

watch(
  () => [props.isOpen, props.address],
  () => {
    if (props.isOpen && props.address) {
      setTimeout(generateQR, 50);
    }
  }
);

watch(
  () => props.isOpen,
  (isOpen) => {
    if (!isOpen) {
      copied.value = false;
    }
  }
);

onMounted(() => {
  if (props.isOpen && props.address) {
    generateQR();
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="modal-overlay" @click.self="handleClose">
        <div class="modal-container" :class="{ 'modal-btc': assetTag !== 'STX' }">
          <!-- Header -->
          <header class="modal-header">
            <h2 class="modal-title">{{ label }}</h2>
            <Button variant="icon" @click="handleClose">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </Button>
          </header>

          <!-- QR Code -->
          <div class="qr-wrapper">
            <div class="qr-container" :class="{ 'qr-btc': assetTag !== 'STX' }">
              <canvas ref="qrCanvas"></canvas>
            </div>
          </div>

          <!-- Address -->
          <div class="address-block">
            <span class="address-text">{{ truncateAddress(address) }}</span>
            <button
              class="copy-btn"
              :class="{ copied }"
              @click="handleCopy"
            >
              <svg
                v-if="!copied"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <svg
                v-else
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {{ copied ? "Copied!" : "Copy" }}
            </button>
          </div>

          <!-- Safety Message -->
          <p class="safety-text">
            Only send {{ assetTag === "STX" ? "STX" : "BTC" }} to this address.
          </p>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: var(--space-md);
}

.modal-container {
  width: 100%;
  max-width: 320px;
  background: #1a1c0d;
  border: 1px solid rgba(232, 248, 89, 0.15);
  border-radius: 20px;
  padding: var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

.modal-container.modal-btc {
  background: #1a1510;
  border-color: rgba(247, 147, 26, 0.2);
}

/* Header */
.modal-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.modal-title {
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 8px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}

/* QR Code */
.qr-wrapper {
  padding: var(--space-sm);
}

.qr-container {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-sm);
  box-shadow: 0 0 20px rgba(232, 248, 89, 0.1);
}

.qr-container.qr-btc {
  box-shadow: 0 0 20px rgba(247, 147, 26, 0.1);
}

.qr-container canvas {
  display: block;
  border-radius: var(--radius-md);
}

/* Address */
.address-block {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
  width: 100%;
}

.address-text {
  flex: 1;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  letter-spacing: -0.02em;
}

.copy-btn {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: var(--radius-sm);
  padding: var(--space-xs) var(--space-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all 0.15s ease;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary); /* v18: neutral */
}

.copy-btn.copied {
  color: #22c55e;
}

/* Safety */
.safety-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
}

/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .modal-container,
.modal-leave-active .modal-container {
  transition: transform 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-container,
.modal-leave-to .modal-container {
  transform: scale(0.95);
}
</style>
