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
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 16px;
  padding: 24px;
  max-width: 320px;
  width: 90%;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.close-btn {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid #444;
  border-radius: 50%;
  color: #888;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  border-color: #666;
}

.modal-title {
  margin: 0;
  font-size: 1.25rem;
  color: #fff;
  font-weight: 600;
}

.qr-container {
  background: #1a1a2e;
  padding: 16px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-container canvas {
  border-radius: 8px;
}

.address-full {
  font-family: monospace;
  font-size: 0.75rem;
  color: #888;
  word-break: break-all;
  text-align: center;
  margin: 0;
  padding: 0 8px;
  line-height: 1.4;
}

.copy-btn {
  width: 100%;
  padding: 12px 24px;
  background: #646cff;
  color: #fff;
  border: none;
  border-radius: 8px;
  font-size: 0.9rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.copy-btn:hover {
  background: #535bf2;
}

.copy-btn.copied {
  background: #4ade80;
}
</style>
