<script setup lang="ts">
import { Button } from "@/components/ui";

defineProps<{
  amountText: string
  symbol: string
  usdText?: string
  isHidden?: boolean
  /** Truncated address shown under the balance, tap to copy. */
  addressShort?: string
  /** Which chain the address belongs to. A wallet holding two of them
   *  cannot offer "the address" without saying which one. */
  addressLabel?: string
  /** True for a moment after a copy, so the confirmation is in words. */
  addressCopied?: boolean
}>()

const emit = defineEmits<{
  (e: 'toggle-hidden'): void
  (e: 'refresh'): void
  (e: 'copy-address'): void
}>()
</script>

<template>
  <div class="balance-header">
    <div class="balance-main">
      <span class="balance-amount" :class="{ 'balance-hidden': isHidden }">
        {{ isHidden ? '••••••' : amountText }}
      </span>
      <span class="balance-symbol">{{ symbol }}</span>
      <Button variant="icon" class="balance-action" @click="emit('toggle-hidden')" :title="isHidden ? 'Show balance' : 'Hide balance'">
        <svg v-if="isHidden" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </svg>
        <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
      </Button>
      <Button variant="icon" class="balance-action" @click="emit('refresh')" title="Refresh balance">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M23 4v6h-6M1 20v-6h6"/>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
        </svg>
      </Button>
    </div>
    <!-- Address and copy are one target: showing it and copying it are
         the same intent, and this is where there is room to read it. -->
    <button
      v-if="addressShort"
      class="balance-address"
      :class="{ 'balance-address--copied': addressCopied }"
      data-roi="home-copy-address"
      :title="addressCopied ? 'Address copied' : 'Copy address'"
      @click="emit('copy-address')"
    >
      <svg v-if="addressCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2"/>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
      </svg>
      <span v-if="addressLabel && !addressCopied" class="balance-address__chain">
        {{ addressLabel }}
      </span>
      <span class="balance-address__text">
        {{ addressCopied ? `${addressLabel ?? ''} address copied`.trim() : addressShort }}
      </span>
    </button>

    <div v-if="usdText && !isHidden" class="balance-usd">
      {{ usdText }}
    </div>
  </div>
</template>

<style scoped>
/* Address chip: one target for reading and copying. */
.balance-address {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  max-width: 100%;
  padding: 4px var(--space-sm);
  background: rgba(255, 255, 255, 0.04);
  border: none;
  border-radius: var(--radius-control);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: background var(--transition-fast), color var(--transition-fast);
}

.balance-address:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

.balance-address--copied {
  color: var(--color-accent-primary);
}

.balance-address__chain {
  padding: 1px 6px;
  border-radius: var(--radius-sm, 6px);
  background: rgba(255, 255, 255, 0.06);
  color: var(--color-text-secondary);
  font-family: var(--font-sans, inherit);
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  letter-spacing: 0.02em;
}

.balance-address__text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* V42: Premium fintech balance header - hero treatment */
.balance-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm); /* V42: Slightly more gap for breathing room */
  padding: var(--space-lg) var(--card-pad-x) var(--space-md);
}

.balance-main {
  display: flex;
  align-items: baseline; /* V42: Baseline alignment for typographic precision */
  gap: var(--space-xs); /* V42: Tighter gap between amount and symbol */
}

/* V42: Hero balance - fintech premium weight + tracking */
.balance-amount {
  font-size: 38px; /* V42: Slightly larger for more presence */
  font-weight: 700; /* V42: 700 instead of 800 - less chunky, more premium */
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.025em; /* V42: Slightly tighter for premium feel */
  line-height: 1; /* V42: Exact line-height for baseline precision */
}

/* V42: Popup mode - proportionally scaled */
.mode-popup .balance-amount {
  font-size: 32px;
}

.balance-hidden {
  letter-spacing: 0.08em;
}

/* V42: Symbol as typographic companion */
.balance-symbol {
  font-size: 18px; /* V42: Larger for better proportion with amount */
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-left: var(--space-xs); /* V42: Slight offset from amount */
  transform: translateY(-2px); /* V42: Optical alignment to baseline */
}

.mode-popup .balance-symbol {
  font-size: 15px;
  transform: translateY(-1px);
}

/* V42: Action buttons - subtle but accessible */
.balance-action :deep(.btn) {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.balance-action :deep(.btn:hover) {
  color: var(--color-text-primary);
  background: var(--surface-hover);
  opacity: 1;
}

/* V42: USD chip - premium indicator with clear hierarchy */
.balance-usd {
  font-size: var(--font-size-xs); /* V42: Smaller for clear hierarchy */
  font-weight: 600; /* V42: Bolder weight for legibility at small size */
  color: var(--color-text-muted); /* V42: Muted for secondary status */
  padding: 5px var(--space-md); /* V42: Slightly more vertical padding */
  background: rgba(255, 255, 255, 0.03); /* V42: Subtle surface */
  border: 1px solid rgba(255, 255, 255, 0.08); /* V42: Visible but quiet border */
  border-radius: var(--radius-pill); /* V42: Pill shape for chip identity */
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em; /* V42: Slight tracking for small caps feel */
}
</style>
