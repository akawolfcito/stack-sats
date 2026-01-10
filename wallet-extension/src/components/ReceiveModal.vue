<script setup lang="ts">
import { ref, watch, onMounted, computed } from "vue";
import QRCode from "qrcode";
import { useUiMode } from "../composables/useUiMode";

const props = defineProps<{
  visible: boolean;
  stxAddress: string;
  btcP2PKHAddress?: string;
  btcP2TRAddress?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

// UI Mode detection
const { isPopup } = useUiMode();

type AssetTab = "stx" | "btc";
type BtcAddressType = "taproot" | "legacy";

const activeTab = ref<AssetTab>("stx");
const btcAddressType = ref<BtcAddressType>("taproot");
const qrCanvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);
const showFullAddress = ref(false);

const currentAddress = computed(() => {
  if (activeTab.value === "stx") {
    return props.stxAddress;
  }
  return btcAddressType.value === "taproot"
    ? props.btcP2TRAddress || ""
    : props.btcP2PKHAddress || "";
});

// Truncated address for compact display
const truncatedAddress = computed(() => {
  const addr = currentAddress.value;
  if (!addr || addr.length <= 20) return addr;
  return `${addr.slice(0, 10)}...${addr.slice(-10)}`;
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
    return "Only send STX to this address";
  }
  return "Only send BTC to this address";
});

// QR code size based on UI mode
const qrSize = computed(() => isPopup.value ? 160 : 200);

async function generateQR() {
  if (!qrCanvas.value || !currentAddress.value) return;

  const bgColor = activeTab.value === "stx" ? "#1a1c0d" : "#1a1510";

  try {
    await QRCode.toCanvas(qrCanvas.value, currentAddress.value, {
      width: qrSize.value,
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
  () => [props.visible, currentAddress.value, qrSize.value],
  () => {
    if (props.visible && currentAddress.value) {
      setTimeout(generateQR, 50);
    }
  }
);

// Reset state when modal closes
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      showFullAddress.value = false;
      copied.value = false;
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

function openExplorer() {
  if (!currentAddress.value) return;
  let url = "";
  if (activeTab.value === "stx") {
    url = `https://explorer.hiro.so/address/${currentAddress.value}?chain=mainnet`;
  } else {
    url = `https://mempool.space/address/${currentAddress.value}`;
  }
  window.open(url, "_blank");
}

function handleClose() {
  emit("close");
}

function setTab(tab: AssetTab) {
  activeTab.value = tab;
  copied.value = false;
  showFullAddress.value = false;
}

function setBtcType(type: BtcAddressType) {
  btcAddressType.value = type;
  copied.value = false;
  showFullAddress.value = false;
}

function toggleFullAddress() {
  showFullAddress.value = !showFullAddress.value;
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="modal-overlay" @click.self="handleClose">
        <!-- Bottom Sheet Modal -->
        <div
          class="modal-sheet"
          :class="{
            'modal-sheet--btc': activeTab === 'btc',
            'modal-sheet--popup': isPopup
          }"
        >
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
              <h2>Receive</h2>
            </div>
            <button class="btn-icon close-btn" @click="handleClose">
              <span class="close-icon">×</span>
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

          <!-- Modal Content (no scroll needed) -->
          <div class="modal-content">
            <!-- QR Code Container -->
            <div class="qr-wrapper">
              <div class="qr-container" :class="{ 'qr-container--btc': activeTab === 'btc' }">
                <div class="qr-inner">
                  <canvas ref="qrCanvas"></canvas>
                </div>
              </div>
            </div>

            <!-- Address Display -->
            <div
              class="address-card"
              :class="{
                'address-card--btc': activeTab === 'btc',
                'address-card--expanded': showFullAddress
              }"
              @click="toggleFullAddress"
            >
              <div class="address-header">
                <span class="address-label">{{ addressLabel }}</span>
                <button class="expand-btn" @click.stop="toggleFullAddress">
                  {{ showFullAddress ? 'Hide' : 'Show full' }}
                </button>
              </div>
              <p class="address-text">{{ showFullAddress ? currentAddress : truncatedAddress }}</p>
            </div>

            <!-- Warning Text -->
            <p class="warning-text">{{ warningText }}</p>

            <!-- Action Buttons (horizontal layout) -->
            <div class="action-buttons">
              <button
                class="btn-primary"
                :class="{ 'btn-primary--btc': activeTab === 'btc', copied }"
                @click="copyAddress"
                data-testid="copy-address-cta"
              >
                <svg v-if="!copied" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                {{ copied ? 'Copied!' : 'Copy' }}
              </button>
              <button class="btn-secondary" @click="openExplorer">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                Explorer
              </button>
            </div>
          </div>

          <!-- Home Indicator (only in panel mode) -->
          <div v-if="!isPopup" class="home-indicator"></div>
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
  border-radius: 24px 24px 0 0;
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

/* Popup mode: compact layout - non-token overrides */
.modal-sheet--popup {
  max-height: 100%;
  border-radius: 0;
}

.modal-sheet--popup .tab-btn {
  height: 36px;
  font-size: var(--font-size-sm);
}

.modal-sheet--popup .type-btn {
  height: 32px;
}

.modal-sheet--popup .btn-primary,
.modal-sheet--popup .btn-secondary {
  height: var(--control-h);
  font-size: var(--font-size-sm);
}

/* Ambient Glow */
.ambient-glow {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  max-width: 320px;
  height: 150px;
  background: rgba(232, 248, 89, 0.06);
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}

.ambient-glow--btc {
  background: rgba(247, 147, 26, 0.06);
}

/* Header */
.modal-header {
  position: relative;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--card-pad) var(--card-pad-x) var(--space-md);
}

.header-title {
  display: flex;
  align-items: center;
  gap: var(--space-md);
}

.asset-icon {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  border-radius: 50%;
  background: rgba(232, 248, 89, 0.1);
  border: 1px solid rgba(232, 248, 89, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent-primary);
  box-shadow: 0 0 12px rgba(232, 248, 89, 0.15);
}

.asset-icon--btc {
  background: rgba(247, 147, 26, 0.1);
  border-color: rgba(247, 147, 26, 0.2);
  color: #F7931A;
  box-shadow: 0 0 12px rgba(247, 147, 26, 0.15);
}

.header-title h2 {
  font-size: 18px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.close-btn {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.1);
}

.close-btn:active {
  transform: scale(0.95);
}

.close-icon {
  font-size: 20px;
  line-height: 1;
  color: #FFFFFF;
}

/* Asset Tabs */
.asset-tabs {
  position: relative;
  z-index: 10;
  display: flex;
  gap: var(--space-sm);
  padding: 0 var(--card-pad-x);
  margin-bottom: var(--space-md);
}

.tab-btn {
  flex: 1;
  height: var(--control-h);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: #6b7280;
  font-size: var(--font-size-sm);
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
  box-shadow: 0 0 12px rgba(232, 248, 89, 0.25);
}

.tab-btn--btc.tab-btn--active {
  background: #F7931A;
  box-shadow: 0 0 12px rgba(247, 147, 26, 0.25);
}

/* BTC Address Type Selector */
.btc-type-selector {
  position: relative;
  z-index: 10;
  display: flex;
  gap: var(--space-sm);
  padding: 0 var(--card-pad-x);
  margin-bottom: var(--space-md);
}

.type-btn {
  flex: 1;
  height: var(--row-h);
  border-radius: var(--radius-sm);
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #6b7280;
  font-size: var(--font-size-xs);
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
  padding: var(--space-xs) var(--card-pad-x) var(--card-pad-x);
}

/* QR Code */
.qr-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: var(--space-md);
}

.qr-container {
  position: relative;
  padding: var(--space-md);
  border-radius: var(--radius-xl);
  background: #26281b;
  box-shadow:
    4px 4px 8px #1a1c13,
    -4px -4px 8px #323423;
}

.modal-sheet--btc .qr-container {
  background: #26201a;
  box-shadow:
    4px 4px 8px #1a1510,
    -4px -4px 8px #322a20;
}

.qr-container::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 20px;
  border: 1px solid rgba(232, 248, 89, 0.15);
  box-shadow: 0 0 20px rgba(232, 248, 89, 0.08);
  pointer-events: none;
}

.qr-container--btc::before {
  border-color: rgba(247, 147, 26, 0.2);
  box-shadow: 0 0 20px rgba(247, 147, 26, 0.1);
}

.qr-inner {
  position: relative;
  background: white;
  border-radius: var(--radius-md);
  padding: var(--space-md);
  display: flex;
  align-items: center;
  justify-content: center;
}

.qr-inner canvas {
  border-radius: 6px;
  display: block;
}

/* Address Card */
.address-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.03);
  border-radius: var(--radius-lg);
  padding: var(--card-pad-y) var(--card-pad-x);
  margin-bottom: var(--space-sm);
  border: 1px solid rgba(255, 255, 255, 0.05);
  cursor: pointer;
  transition: all 0.2s ease;
}

.address-card:hover {
  background: rgba(255, 255, 255, 0.05);
}

.address-card--expanded {
  background: rgba(255, 255, 255, 0.05);
}

.address-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.address-label {
  font-size: 10px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.expand-btn {
  background: none;
  border: none;
  color: var(--color-accent-primary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: all 0.15s ease;
}

.expand-btn:hover {
  background: rgba(232, 248, 89, 0.1);
}

.address-text {
  font-family: var(--font-mono);
  font-size: 14px;
  color: var(--color-text-primary);
  word-break: break-all;
  line-height: 1.5;
  margin: 0;
}

/* Warning Text */
.warning-text {
  font-size: var(--font-size-xs);
  color: #666;
  text-align: center;
  margin: 0 0 var(--space-md);
}

/* Action Buttons - Horizontal layout */
.action-buttons {
  display: flex;
  flex-direction: row;
  gap: var(--space-md);
  width: 100%;
}

.btn-primary {
  flex: 1;
  height: var(--control-h);
  border-radius: var(--radius-md);
  background: var(--color-accent-primary);
  border: none;
  color: #0a0a0a;
  font-size: var(--font-size-sm);
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  box-shadow: 0 0 16px rgba(232, 248, 89, 0.25);
  transition: all 0.2s ease;
}

.btn-primary--btc {
  background: #F7931A;
  box-shadow: 0 0 16px rgba(247, 147, 26, 0.25);
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-primary:active {
  transform: scale(0.98);
}

.btn-primary.copied {
  background: var(--color-success);
  box-shadow: 0 0 16px rgba(34, 197, 94, 0.25);
}

.btn-secondary {
  flex: 1;
  height: var(--control-h);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.btn-secondary:active {
  transform: scale(0.98);
}

/* Home Indicator */
.home-indicator {
  width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-pill);
  margin: var(--space-md) auto;
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
