<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  label: string;
  value: string;
  copyValue?: string;
  copyable?: boolean;
  truncate?: boolean;
  mono?: boolean;
  accent?: boolean;
}>();

const copied = ref(false);

function handleCopy() {
  if (!props.copyable) return;
  navigator.clipboard.writeText(props.copyValue ?? props.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
}
</script>

<template>
  <div class="tx-detail-row">
    <span class="row-label">{{ label }}</span>
    <div class="row-value-wrapper">
      <span
        class="row-value"
        :class="{ mono, accent, truncate }"
        :title="truncate ? value : undefined"
      >
        {{ value }}
      </span>
      <button
        v-if="copyable"
        class="copy-btn"
        :class="{ copied }"
        @click="handleCopy"
        :title="copied ? 'Copied!' : 'Copy'"
      >
        <svg
          v-if="!copied"
          width="14"
          height="14"
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
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tx-detail-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  border-bottom: 1px solid var(--color-border);
  min-height: 44px;
}

.tx-detail-row:last-child {
  border-bottom: none;
}

.row-label {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  flex-shrink: 0;
}

.row-value-wrapper {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  min-width: 0;
}

.row-value {
  color: var(--color-text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  text-align: right;
}

.row-value.mono {
  font-family: var(--font-mono);
  letter-spacing: -0.02em;
}

.row-value.accent {
  color: var(--color-text-secondary); /* v18: neutral */
}

.row-value.truncate {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.copy-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.copy-btn:hover {
  background: var(--color-bg-elevated);
  color: var(--color-text-primary); /* v18: neutral */
}

.copy-btn.copied {
  color: #22c55e;
}
</style>
