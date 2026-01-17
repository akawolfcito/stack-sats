<script setup lang="ts">
/**
 * AccountSwitcher - V56 Perceived Cohesion Sprint
 *
 * Decision Log:
 * - Container: Sheet variant="dropdown" (Rule 3 - picker/list, short-lived)
 * - Close strategy: click-outside + ESC (Sheet built-in, Guardrail A)
 * - CTA strategy: Row selection + footer Button secondary (Guardrail B)
 * - Scroll ownership: Internal to Sheet (Guardrail C)
 * - ROI: acctsw-* prefix for E2E anchors
 *
 * V55 Primitives: Sheet, ListGroup, ListRow, Button
 */
import { ref } from 'vue'
import { Sheet, Button } from '@/components/ui'
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
}>()

const isOpen = ref(false)

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

    <!-- V56: Sheet dropdown (no visible close button, click-outside+ESC) -->
    <Sheet
      :is-open="isOpen"
      variant="dropdown"
      title="Switch Account"
      :show-close="false"
      data-roi="acctsw-sheet"
      @close="close"
    >
      <!-- V56: ListGroup + ListRow for accounts -->
      <ListGroup data-roi="acctsw-list">
        <ListRow
          v-for="account in accounts"
          :key="account.index"
          :label="account.label"
          :subtitle="account.addressShort"
          :badge="account.label === currentLabel ? 'Active' : undefined"
          @click="selectAccount(account.index)"
        >
          <template #icon>
            <span
              class="account-dot"
              :class="{ 'account-dot--active': account.label === currentLabel }"
            />
          </template>
        </ListRow>
      </ListGroup>

      <template v-if="canAddAccount" #footer>
        <Button
          variant="secondary"
          full-width
          data-roi="acctsw-add"
          @click="handleAddAccount"
        >
          + Add Account
        </Button>
      </template>
    </Sheet>
  </div>
</template>

<style scoped>
/**
 * V56 AccountSwitcher Styles
 * - Removed legacy overlay styles (now using Sheet dropdown)
 * - Kept trigger pill and account dot styles
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

.account-pill__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
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

/* V56: Account dot for ListRow icon slot */
.account-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.account-dot--active {
  background: var(--color-success);
}
</style>
