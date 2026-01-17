<script setup lang="ts">
/**
 * NetworkChip - V56.3 Sheet Primitive Migration
 *
 * Decision Log:
 * - Container: Sheet variant="dropdown" (Rule 3 - picker/list, short-lived)
 * - Close strategy: Primitive-level (Sheet dropdown overlay captures outside clicks)
 * - Visual: Trailing checkmark for active network (V56.2 pattern)
 * - ROI: network-* prefix for E2E anchors
 *
 * V56.3 Changes:
 * - Removed custom absolute dropdown (.network-menu)
 * - Removed manual click-outside listeners (primitive handles it)
 * - Now uses Sheet variant="dropdown" + ListGroup + ListRow
 * - Consistent with AccountSwitcher pattern
 *
 * V55 Primitives: Sheet, ListGroup, ListRow
 */
import { ref } from 'vue'
import type { NetworkName } from '@/utils/network'
import { Sheet } from '@/components/ui'
import ListGroup from '@/components/list/ListGroup.vue'
import ListRow from '@/components/list/ListRow.vue'

const props = defineProps<{
  network: NetworkName
  label?: string
}>()

const emit = defineEmits<{
  (e: 'select', network: NetworkName): void
}>()

const isOpen = ref(false)

const networks: { key: NetworkName; label: string }[] = [
  { key: 'mainnet', label: 'Mainnet' },
  { key: 'testnet', label: 'Testnet' },
  { key: 'devnet', label: 'Devnet' },
]

/**
 * Toggle dropdown. Sheet.vue handles outside click detection
 * at the primitive level, so no manual listeners needed.
 */
const toggle = () => {
  isOpen.value = !isOpen.value
}

const close = () => {
  isOpen.value = false
}

const selectNetwork = (key: NetworkName) => {
  emit('select', key)
  isOpen.value = false
}

/**
 * Check if network is active (current)
 */
const isActive = (key: NetworkName) => key === props.network

/**
 * Get dot color class for network
 */
const getDotClass = (key: NetworkName) => `network-dot--${key}`

/**
 * V57: Expose open method for snapshot/testing
 */
const open = () => {
  isOpen.value = true
}

defineExpose({ open, close, toggle })
</script>

<template>
  <div class="network-chip-wrapper">
    <!-- Trigger Chip -->
    <button
      class="network-chip"
      :class="{
        'network-chip--mainnet': network === 'mainnet',
        'network-chip--testnet': network === 'testnet',
        'network-chip--devnet': network === 'devnet',
      }"
      data-roi="network-trigger"
      @click="toggle"
    >
      <span class="network-chip__dot"></span>
      <span class="network-chip__label">{{ label || network }}</span>
      <svg class="network-chip__arrow" :class="{ 'network-chip__arrow--open': isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- V56.3: Sheet dropdown (primitive-level close) -->
    <Sheet
      :is-open="isOpen"
      variant="dropdown"
      :show-close="false"
      data-roi="network-sheet"
      @close="close"
    >
      <!-- V56.3: Compact header (empty) -->
      <template #header>
        <span></span>
      </template>

      <!-- V56.3: ListGroup + ListRow for networks -->
      <ListGroup data-roi="network-list">
        <ListRow
          v-for="net in networks"
          :key="net.key"
          :label="net.label"
          :data-roi="`network-item-${net.key}`"
          @click="selectNetwork(net.key)"
        >
          <template #icon>
            <span class="network-dot" :class="getDotClass(net.key)" />
          </template>
          <!-- V56.3: Trailing checkmark for active network -->
          <template v-if="isActive(net.key)" #right>
            <span class="network-check">&#10003;</span>
          </template>
        </ListRow>
      </ListGroup>
    </Sheet>
  </div>
</template>

<style scoped>
/**
 * V56.3 NetworkChip Styles
 * - Removed custom .network-menu (now using Sheet dropdown)
 * - Removed menu-fade transition (Sheet handles animation)
 * - Kept trigger chip styles unchanged
 */

.network-chip-wrapper {
  position: relative;
}

/* Trigger Chip - V55 tokens */
.network-chip {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: var(--control-h);
  padding: 0 var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: background var(--transition-fast);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-secondary);
}

.network-chip:hover {
  background: var(--surface-hover);
  color: var(--color-text-primary);
}

.network-chip:active {
  background: var(--surface-pressed);
}

.network-chip:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

/* Trigger dot indicator - V57: 8px matches AccountSwitcher */
.network-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.network-chip--mainnet .network-chip__dot {
  background: var(--color-success);
}

.network-chip--testnet .network-chip__dot {
  background: #60a5fa;
}

.network-chip--devnet .network-chip__dot {
  background: #f59e0b;
}

.network-chip__label {
  text-transform: capitalize;
  white-space: nowrap;
}

.network-chip__arrow {
  opacity: 0.5;
  transition: all var(--transition-fast);
}

.network-chip:hover .network-chip__arrow {
  opacity: 1;
}

.network-chip__arrow--open {
  transform: rotate(180deg);
}

/* V56.3: Network dot for ListRow icon slot */
.network-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.network-dot--mainnet {
  background: var(--color-success);
}

.network-dot--testnet {
  background: #60a5fa;
}

.network-dot--devnet {
  background: #f59e0b;
}

/* V56.3: Trailing checkmark */
.network-check {
  color: var(--color-success);
  font-size: 12px;
  flex-shrink: 0;
}
</style>
