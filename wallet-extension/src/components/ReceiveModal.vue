<script setup lang="ts">
/**
 * ReceiveModal - V77 Premium CTA Hierarchy
 *
 * V77 Changes:
 * - "View in Explorer" downgraded to tertiary link (not competing with primary)
 * - "Copy Address" is now the only strong primary CTA
 * - Cleaner footer with single-action focus
 *
 * V63 Features (preserved):
 * - variant="modal" (centered dialog, pro desktop style)
 * - Modal sizing: clamp(320px, 92vw, 420px), max-height: 88vh
 * - Header (fixed): Sheet built-in header with close button
 * - Body (scroll): SegmentedTabs + QR + address (only body scrolls)
 *
 * ROI: receive-* prefix for E2E anchors
 */
import { ref, watch, onMounted, computed } from "vue";
import QRCode from "qrcode";
import { useUiMode } from "../composables/useUiMode";
import { Sheet, Button } from "@/components/ui";
import SegmentedTabs from "@/components/SegmentedTabs.vue";

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

    <!-- V77: Single primary CTA + tertiary link (explorer doesn't compete) -->
    <template #footer>
      <div class="receive-footer">
        <Button
          variant="primary"
          full-width
          data-roi="receive-cta-primary"
          @click="copyAddress"
        >
          <span>{{ copied ? 'Copied!' : 'Copy Address' }}</span>
          <svg v-if="!copied" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </Button>
        <!-- V77: Explorer link - tertiary style, doesn't compete with primary -->
        <button
          class="explorer-link"
          type="button"
          data-roi="receive-cta-secondary"
          @click="openExplorer"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15,3 21,3 21,9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
          View in Explorer
        </button>
      </div>
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

/* V77: Custom footer with primary CTA + tertiary link */
.receive-footer {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-md);
}

/* V77: Explorer link - tertiary/text style */
.explorer-link {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition:
    color var(--transition-fast),
    background var(--transition-fast);
}

.explorer-link:hover {
  color: var(--color-text-primary);
  background: var(--surface-hover);
}

.explorer-link:active {
  background: var(--surface-pressed);
}

.explorer-link svg {
  opacity: 0.7;
  transition: opacity var(--transition-fast);
}

.explorer-link:hover svg {
  opacity: 1;
}
</style>
