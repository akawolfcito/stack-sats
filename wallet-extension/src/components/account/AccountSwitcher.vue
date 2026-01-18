<script setup lang="ts">
/**
 * AccountSwitcher - V56.2 Network Dropdown Alignment
 *
 * Decision Log:
 * - Container: Sheet variant="dropdown" (Rule 3 - picker/list, short-lived)
 * - Close strategy: Primitive-level (Sheet dropdown overlay captures outside clicks)
 * - CTA strategy: Row selection (no footer button)
 * - Visual: Trailing checkmark for active account (like NetworkChip)
 * - Add account: ListRow variant="add" (inline, not footer button)
 * - ROI: acctsw-* prefix for E2E anchors
 *
 * V56.2 Changes:
 * - Removed manual document listeners (Sheet.vue now handles outside clicks)
 * - Removed stopPropagation (no longer needed)
 * - Removed Sheet header/title (compact dropdown)
 * - Active state: trailing checkmark instead of badge
 * - "Add account" moved to ListRow with variant="add"
 *
 * V55 Primitives: Sheet, ListGroup, ListRow
 */
import { ref } from 'vue'
import { Sheet } from '@/components/ui'
import ListGroup from '@/components/list/ListGroup.vue'
import ListRow from '@/components/list/ListRow.vue'

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
  (e: 'manage'): void
}>()

const isOpen = ref(false)

/**
 * Toggle dropdown. Sheet.vue now handles outside click detection
 * at the primitive level, so no stopPropagation needed.
 */
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

const handleManageAccounts = () => {
  emit('manage')
  isOpen.value = false
}

/**
 * Check if account is active (current)
 */
const isActive = (account: AccountItem) => account.label === props.currentLabel

/**
 * V57: Expose open method for snapshot/testing
 */
const open = () => {
  isOpen.value = true
}

defineExpose({ open, close, toggle })
</script>

<template>
  <div class="account-switcher">
    <!-- Trigger Pill -->
    <button class="account-pill" data-roi="acctsw-trigger" @click="toggle">
      <span class="account-pill__dot"></span>
      <span class="account-pill__info">
        <span class="account-pill__label">{{ currentLabel }}</span>
        <span class="account-pill__address">{{ currentAddressShort }}</span>
      </span>
      <svg class="account-pill__arrow" :class="{ 'account-pill__arrow--open': isOpen }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    <!-- V70: Sheet dropdown with header title + sticky footer -->
    <Sheet
      :is-open="isOpen"
      variant="dropdown"
      title="Accounts"
      :show-close="false"
      data-roi="acctsw-sheet"
      @close="close"
    >

      <!-- V68: Scrollable account list with max-height -->
      <div class="account-list" data-roi="acctsw-list">
        <ListGroup>
          <ListRow
            v-for="account in accounts"
            :key="account.index"
            :label="account.label"
            :subtitle="account.addressShort"
            @click="selectAccount(account.index)"
          >
            <template #icon>
              <span
                class="account-dot"
                :class="{ 'account-dot--active': isActive(account) }"
              />
            </template>
            <!-- V56.2: Trailing checkmark for active account (like NetworkChip) -->
            <template v-if="isActive(account)" #right>
              <span class="account-check">&#10003;</span>
            </template>
          </ListRow>
        </ListGroup>
      </div>

      <!-- V68: Sticky footer with actions -->
      <template #footer>
        <div class="switcher-footer" data-roi="acctsw-footer">
          <button
            v-if="canAddAccount"
            class="footer-action"
            data-roi="acctsw-add"
            @click="handleAddAccount"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            <span>Add account</span>
          </button>
          <button
            class="footer-action"
            data-roi="acctsw-manage"
            @click="handleManageAccounts"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            <span>Manage accounts</span>
          </button>
        </div>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
/**
 * V56.2 AccountSwitcher Styles
 * - Compact dropdown (no header)
 * - Trailing checkmark for active account
 * - Trigger pill unchanged
 */

.account-switcher {
  position: relative;
}

/* Trigger Pill - V55 tokens */
.account-pill {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  height: var(--control-h);
  padding: 0 var(--space-sm);
  background: transparent;
  border: none;
  border-radius: var(--radius-control);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.account-pill:hover {
  background: var(--surface-hover);
}

.account-pill:active {
  background: var(--surface-pressed);
}

.account-pill:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

/* V64: Trigger pill dot - premium glow */
.account-pill__dot {
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: 50%;
  background: var(--dot-mainnet-color);
  box-shadow: var(--dot-mainnet-glow), var(--dot-inner-shine);
  flex-shrink: 0;
}

.account-pill__info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  line-height: 1.15;
  gap: 1px;
}

.account-pill__label {
  font-size: var(--font-size-2xs);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: 0.01em;
}

.account-pill__address {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-regular);
  color: var(--color-text-muted);
  font-family: var(--font-mono);
}

.account-pill__arrow {
  color: var(--color-text-muted);
  transition: transform var(--transition-fast);
  flex-shrink: 0;
  opacity: 0.6;
}

.account-pill:hover .account-pill__arrow {
  opacity: 1;
}

.account-pill__arrow--open {
  transform: rotate(180deg);
}

/* V64: Account dot for ListRow icon slot - premium glow recipe */
.account-dot {
  width: var(--dot-size);
  height: var(--dot-size);
  border-radius: 50%;
  background: var(--dot-inactive-bg);
  box-shadow: var(--dot-inactive-shine);
}

.account-dot--active {
  background: var(--dot-mainnet-color);
  box-shadow: var(--dot-mainnet-glow), var(--dot-inner-shine);
}

/* V56.2: Trailing checkmark - V58: use token */
.account-check {
  color: var(--color-success);
  font-size: var(--font-size-xs);
  flex-shrink: 0;
}

/* V68: Scrollable account list with max-height */
.account-list {
  max-height: calc(70vh - 120px); /* Account for header/footer */
  overflow-y: auto;
  margin: calc(-1 * var(--space-md)) calc(-1 * var(--page-pad-x));
  padding: var(--space-md) var(--page-pad-x);
}

/* V68: Sticky footer with actions */
.switcher-footer {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.footer-action {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--space-md);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  width: 100%;
  text-align: left;
}

.footer-action:hover {
  background: var(--surface-hover);
  color: var(--color-text-primary);
}

.footer-action:active {
  background: var(--surface-pressed);
  transform: scale(0.985);
}

.footer-action svg {
  flex-shrink: 0;
  opacity: 0.7;
}

.footer-action:hover svg {
  opacity: 1;
}
</style>
