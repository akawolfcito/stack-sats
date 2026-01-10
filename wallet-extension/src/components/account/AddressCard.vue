<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  label: string;
  address: string;
  subtitle?: string;
  assetTag: "STX" | "BTC" | "P2TR";
  safetyMessage?: string;
}>();

const emit = defineEmits<{
  showQr: [address: string, label: string];
}>();

const copied = ref(false);

function truncateAddress(address: string, chars: number = 6): string {
  if (!address || address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}...${address.slice(-chars)}`;
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

function handleShowQr() {
  emit("showQr", props.address, props.label);
}
</script>

<template>
  <div class="address-card">
    <div class="card-header">
      <!-- Asset Icon -->
      <div class="asset-icon" :class="assetTag.toLowerCase()">
        {{ assetTag }}
      </div>

      <!-- Info -->
      <div class="card-info">
        <span class="card-label">{{ label }}</span>
        <span v-if="subtitle" class="card-subtitle">{{ subtitle }}</span>
      </div>
    </div>

    <!-- Address + Actions -->
    <div class="card-body">
      <span class="address-text" :title="address">
        {{ truncateAddress(address, 8) }}
      </span>
      <div class="actions">
        <button
          class="action-btn"
          :class="{ copied }"
          @click="handleCopy"
          :title="copied ? 'Copied!' : 'Copy address'"
        >
          <svg
            v-if="!copied"
            width="18"
            height="18"
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
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>
        <button
          class="action-btn"
          @click="handleShowQr"
          title="Show QR code"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="3" height="3" />
            <rect x="18" y="14" width="3" height="3" />
            <rect x="14" y="18" width="3" height="3" />
            <rect x="18" y="18" width="3" height="3" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Safety Message -->
    <p v-if="safetyMessage" class="safety-message">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
      {{ safetyMessage }}
    </p>
  </div>
</template>

<style scoped>
.address-card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.asset-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.asset-icon.stx {
  background: linear-gradient(135deg, rgba(85, 70, 255, 0.2), rgba(124, 58, 237, 0.2));
  color: #7c3aed;
  border: 1px solid rgba(124, 58, 237, 0.3);
}

.asset-icon.btc {
  background: linear-gradient(135deg, rgba(247, 147, 26, 0.2), rgba(255, 184, 77, 0.2));
  color: #f7931a;
  border: 1px solid rgba(247, 147, 26, 0.3);
}

.asset-icon.p2tr {
  background: linear-gradient(135deg, rgba(236, 72, 153, 0.2), rgba(244, 114, 182, 0.2));
  color: #ec4899;
  border: 1px solid rgba(236, 72, 153, 0.3);
}

.card-info {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.card-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.card-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

.card-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  padding: var(--space-sm) var(--space-md);
}

.address-text {
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  letter-spacing: -0.02em;
}

.actions {
  display: flex;
  gap: var(--space-xs);
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
}

.action-btn:hover {
  background: var(--color-bg-card);
  color: var(--color-accent-primary);
}

.action-btn.copied {
  color: #22c55e;
}

.safety-message {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
  padding-left: var(--space-xs);
}

.safety-message svg {
  flex-shrink: 0;
  opacity: 0.7;
}
</style>
