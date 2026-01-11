<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Button } from '@/components/ui'

export interface AccountItem {
  index: number
  label: string
  addressShort: string
}

const props = defineProps<{
  currentLabel: string
  currentAddressShort: string
  accounts: AccountItem[]
  canAddAccount?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', accountIndex: number): void
  (e: 'add-account'): void
}>()

const isOpen = ref(false)
const wrapperRef = ref<HTMLElement | null>(null)

const toggle = () => {
  isOpen.value = !isOpen.value
}

const close = () => {
  isOpen.value = false
}

const selectAccount = (index: number) => {
  emit('select', index)
  isOpen.value = false
}

const handleAddAccount = () => {
  emit('add-account')
  isOpen.value = false
}

// Handle click outside to close overlay
const handleClickOutside = (event: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

// Handle escape key to close
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && isOpen.value) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div ref="wrapperRef" class="account-switcher">
    <!-- Trigger Pill -->
    <button class="account-pill" @click="toggle">
      <span class="account-pill__dot"></span>
      <span class="account-pill__info">
        <span class="account-pill__label">{{ currentLabel }}</span>
        <span class="account-pill__address">{{ currentAddressShort }}</span>
      </span>
      <svg class="account-pill__arrow" :class="{ 'account-pill__arrow--open': isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- Overlay -->
    <Transition name="overlay-fade">
      <div v-if="isOpen" class="account-overlay">
        <div class="account-overlay__header">
          <h3 class="account-overlay__title">Switch Account</h3>
          <Button variant="icon" @click="close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </Button>
        </div>

        <div class="account-overlay__list">
          <button
            v-for="account in accounts"
            :key="account.index"
            class="account-item"
            :class="{ 'account-item--active': account.label === currentLabel }"
            @click="selectAccount(account.index)"
          >
            <span class="account-item__dot"></span>
            <span class="account-item__info">
              <span class="account-item__label">{{ account.label }}</span>
              <span class="account-item__address">{{ account.addressShort }}</span>
            </span>
            <span v-if="account.label === currentLabel" class="account-item__check">&#10003;</span>
          </button>
        </div>

        <div v-if="canAddAccount" class="account-overlay__footer">
          <Button variant="ghost" full-width class="account-add-btn" @click="handleAddAccount">
            + Add Account
          </Button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.account-switcher {
  position: relative;
}

/* Trigger Pill - unified with header controls (v15) */
.account-pill {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: 32px; /* Compact header control */
  padding: 0 var(--space-sm);
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.account-pill:hover {
  background: var(--surface-hover);
  border-color: var(--color-border-hover);
}

.account-pill:active {
  background: var(--surface-pressed);
}

.account-pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-success);
  flex-shrink: 0;
  /* No glow, no animation - pro */
}

.account-pill__info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.2;
}

.account-pill__label {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.account-pill__address {
  font-size: 13px;
  font-weight: 700;
  color: var(--color-text-primary);
  font-family: monospace;
}

.account-pill__arrow {
  color: var(--color-text-muted);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.account-pill__arrow--open {
  transform: rotate(180deg);
}

/* Overlay */
.account-overlay {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  width: 280px;
  max-height: 60vh;
  background: var(--color-bg-elevated, #1a1a1a);
  border: 1px solid var(--color-border, rgba(255, 255, 255, 0.1));
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-elev-3);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.account-overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--card-pad-y) var(--card-pad-x);
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
}

.account-overlay__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.account-overlay__list {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm);
  -webkit-overflow-scrolling: touch;
}

/* Account Item */
.account-item {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  width: 100%;
  min-height: var(--row-h);
  padding: var(--space-md);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
}

.account-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.account-item--active {
  background: rgba(255, 255, 255, 0.08); /* v19: neutral */
}

.account-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}

.account-item--active .account-item__dot {
  background: var(--color-success); /* v16.1: success for active, not lime */
}

.account-item__info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.account-item__label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.account-item__address {
  font-size: 12px;
  font-family: monospace;
  color: var(--color-text-muted);
}

.account-item__check {
  color: var(--color-success); /* v16.1: success for checkmark, not lime */
  font-size: 14px;
  flex-shrink: 0;
}

/* Footer */
.account-overlay__footer {
  padding: var(--space-sm);
  border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
}

.account-add-btn :deep(.btn) {
  min-height: var(--row-h);
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.account-add-btn :deep(.btn:hover) {
  background: rgba(255, 255, 255, 0.05);
  border-color: var(--color-text-secondary);
  color: var(--color-text-primary); /* v16.1: neutral hover, lime reserved for CTAs */
}

/* Transition */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-8px);
}
</style>
