<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import QRCode from "qrcode";
import { Sheet, Button } from "@/components/ui";

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
  <Sheet
    :is-open="isOpen"
    variant="center"
    :title="label"
    @close="handleClose"
  >
    <div class="qr-content">
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
  </Sheet>
</template>

<style scoped>
/* Content wrapper */
.qr-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

/* QR Code */
.qr-wrapper {
  padding: var(--space-sm);
}

.qr-container {
  background: white;
  border-radius: var(--radius-lg);
  padding: var(--space-sm);
  box-shadow: var(--shadow-elev-2);
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
  color: var(--color-text-primary);
}

.copy-btn.copied {
  color: var(--color-success);
}

/* Safety */
.safety-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
}
</style>
