<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import QRCode from "qrcode";

const props = defineProps<{
  visible: boolean;
  stxAddress: string;
  btcP2PKHAddress?: string;
  btcP2TRAddress?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

type AssetTab = "stx" | "btc";
type BtcAddressType = "taproot" | "legacy";

const activeTab = ref<AssetTab>("stx");
const btcAddressType = ref<BtcAddressType>("taproot");
const qrCanvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);

const currentAddress = computed(() => {
  if (activeTab.value === "stx") {
    return props.stxAddress;
  }
  return btcAddressType.value === "taproot"
    ? props.btcP2TRAddress || ""
    : props.btcP2PKHAddress || "";
});

const addressLabel = computed(() => {
  if (activeTab.value === "stx") {
    return "STX Address";
  }
  return btcAddressType.value === "taproot"
    ? "Taproot Address"
    : "Legacy Address";
});

const warningText = computed(() => {
  if (activeTab.value === "stx") {
    return "Only send Stacks (STX) tokens to this address.";
  }
  return "Only send Bitcoin (BTC) to this address.";
});

async function generateQR() {
  if (!qrCanvas.value || !currentAddress.value) return;

  const bgColor = activeTab.value === "stx" ? "#1a1c0d" : "#1a1510";

  try {
    await QRCode.toCanvas(qrCanvas.value, currentAddress.value, {
      width: 200,
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

watch(
  () => [props.visible, currentAddress.value],
  () => {
    if (props.visible && currentAddress.value) {
      setTimeout(generateQR, 50);
    }
  }
);

onMounted(() => {
  if (props.visible && currentAddress.value) {
    generateQR();
  }
});

async function copyAddress() {
  if (!currentAddress.value) return;
  try {
    await navigator.clipboard.writeText(currentAddress.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
}

async function shareAddress() {
  if (!currentAddress.value || !navigator.share) return;
  try {
    await navigator.share({
      title: `${activeTab.value === "stx" ? "STX" : "BTC"} Address`,
      text: currentAddress.value,
    });
  } catch (error) {
    // User cancelled or share failed
  }
}

function handleClose() {
  emit("close");
}

function setTab(tab: AssetTab) {
  activeTab.value = tab;
  copied.value = false;
}

function setBtcType(type: BtcAddressType) {
  btcAddressType.value = type;
  copied.value = false;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <!-- Bottom Sheet Modal -->
        <div class="modal-sheet" :class="{ 'modal-sheet--btc': activeTab === 'btc' }">
          <!-- Ambient Glow -->
          <div class="ambient-glow" :class="{ 'ambient-glow--btc': activeTab === 'btc' }"></div>

          <!-- Header -->
          <div class="modal-header">
            <div class="header-title">
              <div class="asset-icon" :class="{ 'asset-icon--btc': activeTab === 'btc' }">
                <svg v-if="activeTab === 'stx'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5">
                  <path d="M4 4l16 16M4 20L20 4M4 12h16"/>
                </svg>
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
                </svg>
              </div>
              <h2>Receive {{ activeTab === 'stx' ? 'STX' : 'Bitcoin' }}</h2>
            </div>
            <button class="close-btn" @click="handleClose">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- Asset Tabs -->
          <div class="asset-tabs">
            <button
              class="tab-btn"
              :class="{ 'tab-btn--active': activeTab === 'stx' }"
              @click="setTab('stx')"
            >
              STX
            </button>
            <button
              class="tab-btn"
              :class="{ 'tab-btn--active': activeTab === 'btc', 'tab-btn--btc': activeTab === 'btc' }"
              @click="setTab('btc')"
            >
              BTC
            </button>
          </div>

          <!-- BTC Address Type Selector -->
          <div v-if="activeTab === 'btc'" class="btc-type-selector">
            <button
              class="type-btn"
              :class="{ 'type-btn--active': btcAddressType === 'taproot' }"
              @click="setBtcType('taproot')"
            >
              Taproot
            </button>
            <button
              class="type-btn"
              :class="{ 'type-btn--active': btcAddressType === 'legacy' }"
              @click="setBtcType('legacy')"
            >
              Legacy
            </button>
          </div>

          <!-- Scrollable Content -->
          <div class="modal-content">
            <!-- QR Code Container -->
            <div class="qr-wrapper">
              <div class="qr-container" :class="{ 'qr-container--btc': activeTab === 'btc' }">
                <div class="qr-inner">
                  <canvas ref="qrCanvas"></canvas>
                  <!-- Center Icon -->
                  <div class="qr-center-icon" :class="{ 'qr-center-icon--btc': activeTab === 'btc' }">
                    <svg v-if="activeTab === 'stx'" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3">
                      <path d="M4 4l16 16M4 20L20 4M4 12h16"/>
                    </svg>
                    <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Helper Text -->
            <p class="helper-text">Scan to send {{ activeTab === 'stx' ? 'STX' : 'BTC' }} to this address</p>

            <!-- Address Display -->
            <div class="address-card" :class="{ 'address-card--btc': activeTab === 'btc' }">
              <span class="address-label">{{ addressLabel }}</span>
              <p class="address-text">{{ currentAddress }}</p>
            </div>

            <!-- Action Buttons -->
            <div class="action-buttons">
              <button class="btn-primary" :class="{ 'btn-primary--btc': activeTab === 'btc', copied }" @click="copyAddress">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {{ copied ? 'Copied!' : 'Copy Address' }}
              </button>
              <button class="btn-secondary" @click="shareAddress">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                  <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Share
              </button>
            </div>

            <!-- Warning Text -->
            <p class="warning-text">{{ warningText }}</p>
          </div>

          <!-- Home Indicator -->
          <div class="home-indicator"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
}

/* Bottom Sheet Modal */
.modal-sheet {
  position: relative;
  width: 100%;
  max-height: 90vh;
  background: #1a1c0d;
  border-radius: 32px 32px 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-bottom: none;
}

.modal-sheet--btc {
  background: #1a1510;
}

/* Ambient Glow */
.ambient-glow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 320px;
  height: 200px;
  background: rgba(232, 248, 89, 0.08);
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  z-index: 0;
}

.ambient-glow--btc {
  background: rgba(247, 147, 26, 0.08);
}

/* Header */
.modal-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24px 24px 16px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.asset-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(232, 248, 89, 0.1);
  border: 1px solid rgba(232, 248, 89, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
  box-shadow: 0 0 15px rgba(232, 248, 89, 0.2);
}

.asset-icon--btc {
  background: rgba(247, 147, 26, 0.1);
  border-color: rgba(247, 147, 26, 0.2);
  color: #F7931A;
  box-shadow: 0 0 15px rgba(247, 147, 26, 0.2);
}

.header-title h2 {
  font-size: 20px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.close-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #26281b;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  cursor: pointer;
  box-shadow:
    3px 3px 6px #1a1c13,
    -3px -3px 6px #323423;
  transition: all 0.2s ease;
}

.modal-sheet--btc .close-btn {
  background: #26201a;
  box-shadow:
    3px 3px 6px #1a1510,
    -3px -3px 6px #322a20;
}

.close-btn:hover {
  color: var(--color-text-primary);
}

.close-btn:active {
  box-shadow:
    inset 3px 3px 6px #1a1c13,
    inset -3px -3px 6px #323423;
}

/* Asset Tabs */
.asset-tabs {
  position: relative;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 0 24px;
  margin-bottom: 16px;
}

.tab-btn {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #6b7280;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.08);
}

.tab-btn--active {
  background: var(--color-accent-primary);
  color: #0a0a0a;
  border-color: transparent;
  box-shadow: 0 0 15px rgba(232, 248, 89, 0.3);
}

.tab-btn--btc.tab-btn--active {
  background: #F7931A;
  box-shadow: 0 0 15px rgba(247, 147, 26, 0.3);
}

/* BTC Address Type Selector */
.btc-type-selector {
  position: relative;
  z-index: 10;
  display: flex;
  gap: 8px;
  padding: 0 24px;
  margin-bottom: 16px;
}

.type-btn {
  flex: 1;
  height: 36px;
  border-radius: 8px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.type-btn:hover {
  color: var(--color-text-primary);
  border-color: rgba(255, 255, 255, 0.2);
}

.type-btn--active {
  background: rgba(247, 147, 26, 0.15);
  color: #F7931A;
  border-color: rgba(247, 147, 26, 0.3);
}

/* Modal Content */
.modal-content {
  position: relative;
  z-index: 10;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 24px 24px;
  overflow-y: auto;
}

/* QR Code */
.qr-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.qr-container {
  position: relative;
  padding: 20px;
  border-radius: 24px;
  background: #26281b;
  box-shadow:
    5px 5px 10px #1a1c13,
    -5px -5px 10px #323423;
}

.modal-sheet--btc .qr-container {
  background: #26201a;
  box-shadow:
    5px 5px 10px #1a1510,
    -5px -5px 10px #322a20;
}

.qr-container::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 24px;
  border: 1px solid rgba(232, 248, 89, 0.2);
  box-shadow: 0 0 25px rgba(232, 248, 89, 0.1);
  pointer-events: none;
}

.qr-container--btc::before {
  border-color: rgba(247, 147, 26, 0.3);
  box-shadow: 0 0 25px rgba(247, 147, 26, 0.15);
}

.qr-inner {
  position: relative;
  background: white;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-inner canvas {
  border-radius: 8px;
}

.qr-center-icon {
  position: absolute;
  width: 36px;
  height: 36px;
  background: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 2px solid white;
}

.qr-center-icon--btc {
  color: #F7931A;
}

/* Helper Text */
.helper-text {
  font-size: 14px;
  color: #9ca3af;
  margin: 0 0 20px;
  text-align: center;
}

/* Address Card */
.address-card {
  width: 100%;
  background: #16180c;
  border-radius: 16px;
  padding: 16px 20px;
  margin-bottom: 24px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  position: relative;
  overflow: hidden;
}

.modal-sheet--btc .address-card {
  background: #16120c;
}

.address-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: var(--color-accent-primary);
  opacity: 0.5;
}

.address-card--btc::before {
  background: #F7931A;
}

.address-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}

.address-text {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--color-text-primary);
  word-break: break-all;
  line-height: 1.6;
  margin: 0;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  margin-bottom: 16px;
}

.btn-primary {
  width: 100%;
  height: 56px;
  border-radius: 9999px;
  background: var(--color-accent-primary);
  border: none;
  color: #0a0a0a;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 0 20px rgba(232, 248, 89, 0.3);
  transition: all 0.2s ease;
}

.btn-primary--btc {
  background: #F7931A;
  box-shadow: 0 0 20px rgba(247, 147, 26, 0.3);
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-primary.copied {
  background: var(--color-success);
  box-shadow: 0 0 20px rgba(34, 197, 94, 0.3);
}

.btn-secondary {
  width: 100%;
  height: 56px;
  border-radius: 9999px;
  background: #26281b;
  border: none;
  color: var(--color-text-primary);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow:
    5px 5px 10px #1a1c13,
    -5px -5px 10px #323423;
  transition: all 0.2s ease;
}

.modal-sheet--btc .btn-secondary {
  background: #26201a;
  box-shadow:
    5px 5px 10px #1a1510,
    -5px -5px 10px #322a20;
}

.btn-secondary:hover {
  color: var(--color-accent-primary);
}

.btn-secondary:active {
  box-shadow:
    inset 3px 3px 6px #1a1c13,
    inset -3px -3px 6px #323423;
}

/* Warning Text */
.warning-text {
  font-size: 11px;
  color: #555;
  text-align: center;
  margin: 0;
  padding: 0 16px;
}

/* Home Indicator */
.home-indicator {
  width: 128px;
  height: 5px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 9999px;
  margin: 16px auto;
}

/* Modal Transitions */
.modal-enter-active,
.modal-leave-active {
  transition: all 0.3s ease;
}

.modal-enter-active .modal-sheet,
.modal-leave-active .modal-sheet {
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .modal-sheet,
.modal-leave-to .modal-sheet {
  transform: translateY(100%);
}
</style>
