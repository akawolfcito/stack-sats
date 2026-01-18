<script setup lang="ts">
/**
 * ReceiveModal - V63 Unified Overlay System
 *
 * V63 Changes:
 * - variant="modal" (centered dialog, pro desktop style)
 * - Modal sizing: clamp(320px, 92vw, 420px), max-height: 88vh
 * - Header (fixed): Sheet built-in header with close button
 * - Body (scroll): SegmentedTabs + QR + address (only body scrolls)
 * - Footer (fixed): StickyCTA rail
 *
 * Definition of Done:
 * 1. ✅ Overlay: Sheet variant="modal" (centered)
 * 2. ✅ Single close: Sheet header close button only
 * 3. ✅ Header: Sheet built-in header with V55 tokens
 * 4. ✅ CTA: StickyCTA roiPrefix="receive" (scroll risk)
 * 5. ✅ Content: SegmentedTabs (V55 primitive), V55 tokens
 * 6. ✅ Error slot: Reserved min-height for copy errors
 *
 * ROI: receive-* prefix for E2E anchors
 */
import { ref, watch, onMounted, computed } from "vue";
import QRCode from "qrcode";
import { useUiMode } from "../composables/useUiMode";
import { Sheet } from "@/components/ui";
import SegmentedTabs from "@/components/SegmentedTabs.vue";
import StickyCTA from "@/components/layout/StickyCTA.vue";

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
const copyError = ref("");

// V56 DoD: SegmentedTabs items
const assetTabs = [
  { key: "stx", label: "STX" },
  { key: "btc", label: "BTC" },
];

const btcTypeTabs = [
  { key: "taproot", label: "Taproot" },
  { key: "legacy", label: "Legacy" },
];

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
const qrSize = computed(() => (isPopup.value ? 160 : 200));

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
      copyError.value = "";
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
  copyError.value = "";
  try {
    await navigator.clipboard.writeText(currentAddress.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch (error) {
    copyError.value = "Failed to copy address";
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

function toggleFullAddress() {
  showFullAddress.value = !showFullAddress.value;
}
</script>

<template>
  <!-- V63: Centered modal variant (pro desktop style) -->
  <Sheet
    :is-open="visible"
    variant="modal"
    title="Receive"
    :show-close="true"
    data-roi="receive-sheet"
    @close="handleClose"
  >
    <!-- V70: No icon in header - cleaner look -->

    <!-- Modal Content -->
    <div
      class="receive-content"
      :class="{ 'receive-content--btc': activeTab === 'btc' }"
      data-roi="receive-content"
    >
      <!-- V56 DoD #5: SegmentedTabs for asset selector -->
      <SegmentedTabs
        v-model="activeTab"
        :items="assetTabs"
        data-roi="receive-tabs"
      />

      <!-- BTC Address Type Selector -->
      <SegmentedTabs
        v-if="activeTab === 'btc'"
        v-model="btcAddressType"
        :items="btcTypeTabs"
        class="btc-type-tabs"
        data-roi="receive-btc-type"
      />

      <!-- QR Code Container -->
      <div class="qr-wrapper" data-roi="receive-qr">
        <div class="qr-container">
          <div class="qr-inner">
            <canvas ref="qrCanvas"></canvas>
          </div>
        </div>
      </div>

      <!-- Address Display -->
      <div
        class="address-card"
        :class="{ 'address-card--expanded': showFullAddress }"
        @click="toggleFullAddress"
      >
        <div class="address-header">
          <span class="address-label">{{ addressLabel }}</span>
          <button class="expand-btn" type="button" @click.stop="toggleFullAddress">
            {{ showFullAddress ? "Hide" : "Show full" }}
          </button>
        </div>
        <p class="address-text">
          {{ showFullAddress ? currentAddress : truncatedAddress }}
        </p>
      </div>

      <!-- Warning Text -->
      <p class="warning-text">{{ warningText }}</p>

      <!-- V56 DoD #6: Error slot for anti-layout-shift -->
      <div class="error-slot" aria-live="polite" data-roi="receive-error">
        <p v-if="copyError" class="error-message">{{ copyError }}</p>
      </div>
    </div>

    <!-- V56 DoD #4: StickyCTA for scroll risk -->
    <template #footer>
      <StickyCTA
        :primary-text="copied ? 'Copied!' : 'Copy Address'"
        secondary-text="View in Explorer"
        roi-prefix="receive"
        @primary="copyAddress"
        @secondary="openExplorer"
      />
    </template>
  </Sheet>
</template>

<style scoped>
/**
 * V56 DoD ReceiveModal Styles
 * - SegmentedTabs replaces Button toggle
 * - StickyCTA replaces horizontal Button rail
 * - V55 tokens throughout
 * - Error slot for anti-layout-shift
 */

/* Content layout */
.receive-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
}

/* BTC type tabs - slightly smaller */
.btc-type-tabs {
  width: 100%;
}

/* V65: QR Code - transparent container (Sheet provides surface) */
.qr-wrapper {
  display: flex;
  justify-content: center;
}

.qr-container {
  position: relative;
  padding: var(--space-sm);
  /* V65: No background/border - just hold the QR */
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

/* V65: Address Card - transparent, subtle divider only */
.address-card {
  width: 100%;
  background: transparent;
  border-radius: var(--radius-sm);
  padding: var(--card-pad-y) var(--card-pad-x);
  /* V65: Subtle top divider for separation */
  border-top: 1px solid var(--panel-divider);
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

.expand-btn {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-muted);
  background: transparent;
  border: none;
  cursor: pointer;
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.expand-btn:hover {
  color: var(--color-text-primary);
  background: var(--surface-hover);
}

.address-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  word-break: break-all;
  line-height: 1.5;
  margin: 0;
}

/* Warning Text - V55 tokens */
.warning-text {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  text-align: center;
  margin: 0;
}

/* V56 DoD #6: Error slot - reserved height */
.error-slot {
  min-height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.error-message {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 0;
  text-align: center;
}
</style>
