<script setup lang="ts">
/**
 * ReceiveModal - V56 Perceived Cohesion Sprint
 *
 * Decision Log:
 * - Container: Sheet variant="bottom" (Rule 2 - contextual overlay, dismissible)
 * - Close strategy: Sheet showClose=true (single source, Guardrail A)
 * - CTA strategy: Horizontal V55 Buttons (Copy/Explorer, no StickyCTA needed)
 * - Scroll ownership: Internal to Sheet (Guardrail C)
 * - ROI: receive-* prefix for E2E anchors
 */
import { ref, watch, onMounted, computed } from "vue";
import QRCode from "qrcode";
import { useUiMode } from "../composables/useUiMode";
import { Sheet, Button } from "@/components/ui";

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
  <Sheet
    :is-open="visible"
    variant="bottom"
    title="Receive"
    :show-close="true"
    data-roi="receive-sheet"
    @close="handleClose"
  >
    <template #icon>
      <svg v-if="activeTab === 'stx'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M4 4l16 16M4 20L20 4M4 12h16"/>
      </svg>
      <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z"/>
      </svg>
    </template>

    <!-- Modal Content -->
    <div
      class="receive-content"
      :class="{ 'receive-content--btc': activeTab === 'btc' }"
      data-roi="receive-content"
    >
      <!-- V56: Asset Tabs using V55 Button secondary toggle -->
      <div class="asset-tabs" data-roi="receive-tabs">
        <Button
          :variant="activeTab === 'stx' ? 'primary' : 'secondary'"
          size="sm"
          class="tab-btn"
          :class="{ 'tab-btn--active': activeTab === 'stx' }"
          @click="setTab('stx')"
        >
          STX
        </Button>
        <Button
          :variant="activeTab === 'btc' ? 'primary' : 'secondary'"
          size="sm"
          class="tab-btn"
          :class="{ 'tab-btn--btc': activeTab === 'btc' }"
          @click="setTab('btc')"
        >
          BTC
        </Button>
      </div>

      <!-- BTC Address Type Selector -->
      <div v-if="activeTab === 'btc'" class="btc-type-selector">
        <Button
          :variant="btcAddressType === 'taproot' ? 'secondary' : 'ghost'"
          size="sm"
          class="type-btn"
          :class="{ 'type-btn--active': btcAddressType === 'taproot' }"
          @click="setBtcType('taproot')"
        >
          Taproot
        </Button>
        <Button
          :variant="btcAddressType === 'legacy' ? 'secondary' : 'ghost'"
          size="sm"
          class="type-btn"
          :class="{ 'type-btn--active': btcAddressType === 'legacy' }"
          @click="setBtcType('legacy')"
        >
          Legacy
        </Button>
      </div>

      <!-- QR Code Container -->
      <div class="qr-wrapper" data-roi="receive-qr">
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
          <Button variant="ghost" size="sm" class="expand-btn" @click.stop="toggleFullAddress">
            {{ showFullAddress ? 'Hide' : 'Show full' }}
          </Button>
        </div>
        <p class="address-text">{{ showFullAddress ? currentAddress : truncatedAddress }}</p>
      </div>

      <!-- Warning Text -->
      <p class="warning-text">{{ warningText }}</p>

      <!-- Action Buttons (horizontal layout) -->
      <div class="action-buttons" data-roi="receive-cta">
        <Button
          :variant="copied ? 'primary' : 'primary'"
          :class="{ 'btn--btc': activeTab === 'btc', 'btn--copied': copied }"
          full-width
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
        </Button>
        <Button variant="secondary" full-width @click="openExplorer">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          Explorer
        </Button>
      </div>

      <!-- Home Indicator (only in panel mode) -->
      <div v-if="!isPopup" class="home-indicator"></div>
    </div>
  </Sheet>
</template>

<style scoped>
/**
 * V56 ReceiveModal Styles
 * - Removed legacy header styles (now using Sheet's built-in header)
 * - Using V55 Button for tabs
 * - Normalized to V55 tokens
 */

/* Content theming */
.receive-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

/* V56: Asset Tabs using V55 Button toggle */
.asset-tabs {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
}

.asset-tabs :deep(.btn) {
  flex: 1;
}

/* BTC theme for active tab */
.tab-btn--btc :deep(.btn--primary) {
  background: #F7931A;
}

/* BTC Address Type Selector */
.btc-type-selector {
  display: flex;
  gap: var(--space-sm);
  width: 100%;
}

.btc-type-selector :deep(.btn) {
  flex: 1;
}

/* Active state for BTC type */
.type-btn--active :deep(.btn) {
  background: rgba(247, 147, 26, 0.15);
  color: #F7931A;
  border-color: rgba(247, 147, 26, 0.3);
}

/* V56: QR Code - normalized to V55 tokens */
.qr-wrapper {
  display: flex;
  justify-content: center;
}

.qr-container {
  position: relative;
  padding: var(--space-md);
  border-radius: var(--radius-lg);
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid var(--color-border);
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
  border-radius: var(--radius-sm);
  display: block;
}

/* V56: Address Card - normalized to V55 tokens */
.address-card {
  width: 100%;
  background: rgba(255, 255, 255, 0.02);
  border-radius: var(--radius-md);
  padding: var(--card-pad-y) var(--card-pad-x);
  border: 1px solid var(--color-border);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.address-card:hover {
  background: var(--surface-hover);
}

.address-card--expanded {
  background: var(--surface-hover);
}

.address-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-xs);
}

.address-label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.expand-btn :deep(.btn) {
  font-size: var(--font-size-xs);
  padding: var(--space-xs) var(--space-sm);
  height: auto;
  min-height: 0;
}

.address-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  word-break: break-all;
  line-height: 1.5;
  margin: 0;
}

/* V56: Warning Text - V55 tokens */
.warning-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
}

/* V56: Action Buttons - Horizontal layout */
.action-buttons {
  display: flex;
  flex-direction: row;
  gap: var(--space-md);
  width: 100%;
}

/* BTC theme for primary button */
.btn--btc :deep(.btn--primary) {
  background: #F7931A;
}

.btn--copied :deep(.btn--primary) {
  background: var(--color-success);
}

/* Home Indicator (panel mode) */
.home-indicator {
  width: 100px;
  height: 4px;
  background: rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-pill);
  margin: var(--space-md) auto 0;
}
</style>
