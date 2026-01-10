<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'

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
          <button class="account-overlay__close" @click="close">&#10005;</button>
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
          <button class="account-add-btn" @click="handleAddAccount">
            + Add Account
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.account-switcher {
  position: relative;
}

/* Trigger Pill */
.account-pill {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 24px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.account-pill:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.12);
}

.account-pill:active {
  transform: scale(0.97);
}

.account-pill__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-accent-primary);
  flex-shrink: 0;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
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
  border-radius: 16px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.account-overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
}

.account-overlay__title {
  font-size: 15px;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
}

.account-overlay__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: rgba(255, 255, 255, 0.05);
  border: none;
  border-radius: 50%;
  color: var(--color-text-muted);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.account-overlay__close:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text-primary);
}

.account-overlay__list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
  -webkit-overflow-scrolling: touch;
}

/* Account Item */
.account-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  background: transparent;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.1s ease;
  text-align: left;
}

.account-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.account-item--active {
  background: rgba(232, 248, 89, 0.08);
}

.account-item__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}

.account-item--active .account-item__dot {
  background: var(--color-accent-primary);
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
  color: var(--color-accent-primary);
  font-size: 14px;
  flex-shrink: 0;
}

/* Footer */
.account-overlay__footer {
  padding: 8px;
  border-top: 1px solid var(--color-border, rgba(255, 255, 255, 0.08));
  flex-shrink: 0;
}

.account-add-btn {
  width: 100%;
  padding: 12px;
  background: transparent;
  border: 1px dashed rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.account-add-btn:hover {
  background: rgba(255, 255, 255, 0.03);
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
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
