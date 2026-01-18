<script setup lang="ts">
/**
 * AccountsView - V68 Accounts Management Screen
 *
 * Features:
 * - List all accounts with name, truncated address, copy button
 * - Click row navigates to AccountDetailsView for rename/hide
 * - "Add account" button to create new derived account
 * - Accessible from AccountSwitcher footer and UserMenu
 *
 * V68 Primitives: ScreenShell, AppHeader, ListGroup, ListRow, Button
 */
import { ref, computed, onBeforeMount } from 'vue'
import { useRouter } from 'vue-router'
import ScreenShell from '@/components/layout/ScreenShell.vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import ListGroup from '@/components/list/ListGroup.vue'
import ListRow from '@/components/list/ListRow.vue'
import { Button } from '@/components/ui'
import { generateInitialAccounts } from '@/utils/accounts'
import { type Account } from '@/utils/types'
import { sessionManager } from '@/utils/security/session'
import { getSelectedNetwork, type NetworkName } from '@/utils/network'
import {
  getAccountName,
  getAccountCount,
  setAccountCount,
  isAccountHidden,
} from '@/utils/accounts/settings'

interface AccountDisplay {
  index: number
  name: string
  addressShort: string
  addressFull: string
  isHidden: boolean
  isActive: boolean
}

const router = useRouter()

// State
const accounts = ref<AccountDisplay[]>([])
const isLoading = ref(true)
const network = ref<NetworkName>('devnet')
const activeAccountIndex = ref(0)
const copySuccess = ref<number | null>(null)

// Maximum accounts allowed (from existing logic)
const MAX_ACCOUNTS = 10

// Can add more accounts
const canAddAccount = computed(() => accounts.value.length < MAX_ACCOUNTS)

// Truncate address for display
function truncateAddress(address: string, chars: number = 6): string {
  if (!address || address.length <= chars * 2 + 3) return address
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}

// Load accounts data
onBeforeMount(async () => {
  network.value = getSelectedNetwork()

  if (!sessionManager.hasWallet || sessionManager.isLocked) {
    router.push({ path: '/unlock' })
    return
  }

  const mnemonic = sessionManager.getMnemonic()
  if (!mnemonic) {
    router.push({ path: '/unlock' })
    return
  }

  try {
    const savedIndex = localStorage.getItem('selected_account_index')
    activeAccountIndex.value = savedIndex ? parseInt(savedIndex, 10) : 0

    const accountCount = await getAccountCount()
    const rawAccounts = await generateInitialAccounts(mnemonic, accountCount, network.value)

    // Build display list with names and hidden status
    const displayAccounts: AccountDisplay[] = []
    for (let i = 0; i < rawAccounts.length; i++) {
      const account = rawAccounts[i]
      const name = await getAccountName(i)
      const hidden = await isAccountHidden(i)

      displayAccounts.push({
        index: i,
        name: name || `Account ${i + 1}`,
        addressShort: truncateAddress(account.stxAddress, 6),
        addressFull: account.stxAddress,
        isHidden: hidden,
        isActive: i === activeAccountIndex.value,
      })
    }

    accounts.value = displayAccounts
  } catch (error) {
    console.error('Failed to load accounts', error)
    router.push({ path: '/user' })
  } finally {
    isLoading.value = false
  }
})

// Navigation
function goBack() {
  router.back()
}

function handleAccountClick(account: AccountDisplay) {
  // Navigate to account details for rename/hide actions
  router.push({ path: `/account/${account.index}` })
}

// Copy address to clipboard
async function copyAddress(account: AccountDisplay, event: Event) {
  event.stopPropagation()

  try {
    await navigator.clipboard.writeText(account.addressFull)
    copySuccess.value = account.index
    setTimeout(() => {
      copySuccess.value = null
    }, 1500)
  } catch (error) {
    console.error('Failed to copy address', error)
  }
}

// Add new account
async function addAccount() {
  if (!canAddAccount.value) return

  const currentCount = await getAccountCount()
  const newCount = currentCount + 1

  await setAccountCount(newCount)

  // Reload accounts
  const mnemonic = sessionManager.getMnemonic()
  if (!mnemonic) return

  const rawAccounts = await generateInitialAccounts(mnemonic, newCount, network.value)

  const displayAccounts: AccountDisplay[] = []
  for (let i = 0; i < rawAccounts.length; i++) {
    const account = rawAccounts[i]
    const name = await getAccountName(i)
    const hidden = await isAccountHidden(i)

    displayAccounts.push({
      index: i,
      name: name || `Account ${i + 1}`,
      addressShort: truncateAddress(account.stxAddress, 6),
      addressFull: account.stxAddress,
      isHidden: hidden,
      isActive: i === activeAccountIndex.value,
    })
  }

  accounts.value = displayAccounts
}
</script>

<template>
  <ScreenShell :padded="false" data-roi="accounts-management" class="accounts-view">
    <template #header>
      <AppHeader
        title="Accounts"
        left="back"
        data-roi="accounts-title"
        @left-click="goBack"
      />
    </template>

    <!-- V69: Ambient Glow (Home-parity) -->
    <div class="ambient-glow"></div>

    <!-- Loading -->
    <div v-if="isLoading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading accounts...</p>
    </div>

    <!-- Content -->
    <div v-else class="accounts-content">
      <!-- Accounts List -->
      <ListGroup data-roi="accounts-list">
        <ListRow
          v-for="account in accounts"
          :key="account.index"
          :label="account.name"
          :subtitle="account.addressShort"
          :badge="account.isActive ? 'Active' : undefined"
          :class="{ 'account-hidden': account.isHidden }"
          chevron
          @click="handleAccountClick(account)"
        >
          <template #icon>
            <div class="account-avatar" :class="{ 'account-avatar--active': account.isActive }">
              {{ account.index + 1 }}
            </div>
          </template>
          <template #right>
            <button
              class="copy-btn"
              :class="{ 'copy-success': copySuccess === account.index }"
              title="Copy address"
              @click="copyAddress(account, $event)"
            >
              <svg v-if="copySuccess !== account.index" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
              <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>
          </template>
        </ListRow>
      </ListGroup>

      <!-- Add Account CTA -->
      <div class="add-account-section" data-roi="accounts-add-cta">
        <Button
          v-if="canAddAccount"
          variant="secondary"
          full-width
          @click="addAccount"
        >
          <template #icon>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </template>
          Add account
        </Button>
        <p v-else class="max-accounts-hint">
          Maximum {{ MAX_ACCOUNTS }} accounts reached
        </p>
      </div>

      <!-- Info hint -->
      <p class="accounts-hint">
        Tap an account to rename or hide it
      </p>
    </div>
  </ScreenShell>
</template>

<style scoped>
/* V69: Root view styling for premium parity */
.accounts-view {
  position: relative;
}

/* V69: Ambient Glow (Home-parity) */
.ambient-glow {
  position: absolute;
  top: -10%;
  left: -20%;
  width: 60%;
  height: 30%;
  background: rgba(255, 255, 255, 0.3);
  opacity: 0.02;
  filter: blur(80px);
  border-radius: 50%;
  pointer-events: none;
  z-index: 0;
}

/* Loading State */
.loading-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-lg);
  color: var(--color-text-muted);
  position: relative;
  z-index: 1;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-card);
  border-top-color: var(--color-text-muted);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Content */
.accounts-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-md) var(--page-pad-x) var(--space-lg);
  gap: var(--space-lg);
  overflow-y: auto;
  position: relative;
  z-index: 1;
}

/* V69: Account Avatar - Premium glass surface */
.account-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  /* V69: Glass surface recipe */
  background: var(--panel-bg-glass);
  border: 1px solid var(--panel-border);
  box-shadow: var(--panel-highlight);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  flex-shrink: 0;
}

/* V69: Active avatar - mainnet glow */
.account-avatar--active {
  background: var(--dot-mainnet-color);
  border-color: var(--dot-mainnet-color);
  color: var(--color-bg-primary);
  box-shadow: var(--dot-mainnet-glow);
}

/* Hidden account row styling */
.account-hidden {
  opacity: 0.5;
}

/* V69: Premium "Active" badge override */
:deep(.list-row-badge) {
  /* Glass chip - tinted success */
  background: rgba(153, 225, 142, 0.15);
  color: var(--color-success);
  border: 1px solid rgba(153, 225, 142, 0.25);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
}

/* Copy button */
.copy-btn {
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
  transition: all var(--transition-fast);
  margin-right: var(--space-xs);
}

.copy-btn:hover {
  background: var(--surface-hover);
  color: var(--color-text-primary);
}

/* V69: Tactile press feedback (V66 parity) */
.copy-btn:active {
  background: var(--surface-pressed);
  transform: scale(0.92);
}

.copy-btn.copy-success {
  color: var(--color-success);
}

/* Add Account Section */
.add-account-section {
  margin-top: auto;
}

.max-accounts-hint {
  text-align: center;
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
}

/* Hint text */
.accounts-hint {
  text-align: center;
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin: 0;
}
</style>
