<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { NetworkName } from '@/utils/network'

defineProps<{
  network: NetworkName
  label?: string
}>()

const emit = defineEmits<{
  (e: 'select', network: NetworkName): void
}>()

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

const networks: { key: NetworkName; label: string }[] = [
  { key: 'mainnet', label: 'Mainnet' },
  { key: 'testnet', label: 'Testnet' },
  { key: 'devnet', label: 'Devnet' },
]

const toggle = () => {
  isOpen.value = !isOpen.value
}

const selectNetwork = (key: NetworkName) => {
  emit('select', key)
  isOpen.value = false
}

// Handle click outside to close menu
const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div ref="wrapperRef" class="network-chip-wrapper">
    <button
      class="network-chip"
      :class="{
        'network-chip--mainnet': network === 'mainnet',
        'network-chip--testnet': network === 'testnet',
        'network-chip--devnet': network === 'devnet',
      }"
      @click="toggle"
    >
      <span class="network-chip__dot"></span>
      <span class="network-chip__label">{{ label || network }}</span>
      <svg class="network-chip__arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- Network Menu -->
    <Transition name="menu-fade">
      <div v-if="isOpen" class="network-menu">
        <button
          v-for="net in networks"
          :key="net.key"
          class="network-menu__item"
          :class="{ 'network-menu__item--active': net.key === network }"
          @click="selectNetwork(net.key)"
        >
          <span
            class="network-menu__dot"
            :class="{
              'network-menu__dot--mainnet': net.key === 'mainnet',
              'network-menu__dot--testnet': net.key === 'testnet',
              'network-menu__dot--devnet': net.key === 'devnet',
            }"
          ></span>
          <span class="network-menu__label">{{ net.label }}</span>
          <span v-if="net.key === network" class="network-menu__check">&#10003;</span>
        </button>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.network-chip-wrapper {
  position: relative;
}

/* V28: Premium network chip - minimal border, surface states */
.network-chip {
  display: flex;
  align-items: center;
  gap: var(--space-xs);
  height: var(--control-h);
  padding: 0 var(--space-sm);
  background: transparent;
  border: none; /* V28: Remove border for cleaner look */
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

/* Dot indicator - V28: slightly larger */
.network-chip__dot {
  width: 6px;
  height: 6px;
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

/* V28: Testnet/Devnet - use dot color only, no border highlight */
.network-chip--testnet,
.network-chip--devnet {
  /* No special border - keep it clean */
}

.network-chip__label {
  text-transform: capitalize;
  white-space: nowrap;
}

.network-chip__arrow {
  opacity: 0.5;
  transition: all 0.15s ease;
}

.network-chip:hover .network-chip__arrow {
  opacity: 1;
}

/* Network Menu */
.network-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 140px;
  background: var(--color-bg-elevated, #1a1a1a);
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  overflow: hidden;
  z-index: 100;
}

.network-menu__item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 12px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  transition: background 0.1s ease;
  text-align: left;
}

.network-menu__item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.network-menu__item--active {
  background: rgba(255, 255, 255, 0.03);
}

.network-menu__item:not(:last-child) {
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.05));
}

.network-menu__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.network-menu__dot--mainnet {
  background: var(--color-success); /* v16.1: green for mainnet (live), not lime */
}

.network-menu__dot--testnet {
  background: #60a5fa;
}

.network-menu__dot--devnet {
  background: #f59e0b;
}

.network-menu__label {
  flex: 1;
}

.network-menu__check {
  color: var(--color-success); /* v16.1: green for checkmark, not lime */
  font-size: 12px;
}

/* Menu transition */
.menu-fade-enter-active,
.menu-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.menu-fade-enter-from,
.menu-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
