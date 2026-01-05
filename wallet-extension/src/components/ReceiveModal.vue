<script setup lang="ts">
import { ref, watch, onMounted } from "vue";
import QRCode from "qrcode";

const props = defineProps<{
  visible: boolean;
  address: string;
  type: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);

// Generate QR code when modal becomes visible or address changes
async function generateQR() {
  if (!qrCanvas.value || !props.address) return;

  try {
    await QRCode.toCanvas(qrCanvas.value, props.address, {
      width: 200,
      margin: 2,
      color: {
        dark: "#ffffff",
        light: "#1a1a2e",
      },
      errorCorrectionLevel: "M",
    });
  } catch (error) {
    console.error("Failed to generate QR code:", error);
  }
}

// Watch for visibility and address changes
watch(
  () => [props.visible, props.address],
  () => {
    if (props.visible && props.address) {
      // Small delay to ensure canvas is rendered
      setTimeout(generateQR, 50);
    }
  }
);

onMounted(() => {
  if (props.visible && props.address) {
    generateQR();
  }
});

async function copyAddress() {
  try {
    await navigator.clipboard.writeText(props.address);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
}

function handleClose() {
  emit("close");
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-overlay" @click.self="handleClose">
      <div class="modal-content">
        <button class="close-btn" @click="handleClose">✕</button>

        <h3 class="modal-title">Receive {{ type }}</h3>

        <div class="qr-container">
          <canvas ref="qrCanvas"></canvas>
        </div>

        <p class="address-full">{{ address }}</p>

        <button class="copy-btn" :class="{ copied }" @click="copyAddress">
          {{ copied ? "Copied!" : "Copy Address" }}
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(1, 7, 14, 0.95);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-xl);
  max-width: 320px;
  width: 90%;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-lg);
}

.close-btn {
  position: absolute;
  top: var(--space-md);
  right: var(--space-md);
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 50%;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-base);
}

.close-btn:hover {
  background: var(--color-bg-card-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-hover);
}

.modal-title {
  margin: 0;
  font-size: var(--font-size-xl);
  color: var(--color-text-primary);
  font-weight: var(--font-weight-semibold);
}

.qr-container {
  background: var(--color-text-primary);
  padding: var(--space-lg);
  border-radius: var(--radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-container canvas {
  border-radius: var(--radius-sm);
}

.address-full {
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  word-break: break-all;
  text-align: center;
  margin: 0;
  padding: 0 var(--space-sm);
  line-height: 1.5;
}

.copy-btn {
  width: 100%;
  padding: var(--space-lg);
  background: var(--color-accent-primary);
  color: var(--color-bg-primary);
  border: none;
  border-radius: var(--radius-pill);
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
}

.copy-btn:hover {
  background: var(--color-accent-primary-hover);
}

.copy-btn.copied {
  background: var(--color-success);
}
</style>
