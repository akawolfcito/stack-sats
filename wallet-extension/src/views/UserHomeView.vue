<script setup lang="ts">
import { useRouter } from "vue-router";
import { onBeforeMount, ref, watch } from "vue";
import { generateInitialAccounts } from "../utils/accounts";
import { type Account } from "../utils/types";
import { sessionManager } from "../utils/security/session";
import { secureLog } from "../utils/security/logger";
import {
  getSelectedNetwork,
  setSelectedNetwork,
  NETWORKS,
  type NetworkName,
} from "../utils/network";

const router = useRouter();
const userAccounts = ref<Account[]>([]);
const accountIndexToDisplay = ref(0);
const isLoading = ref(true);
const selectedNetwork = ref<NetworkName>(getSelectedNetwork());
const currentMnemonic = ref<string | null>(null);

async function loadAccounts(mnemonic: string, network: NetworkName) {
  isLoading.value = true;
  try {
    const accounts = await generateInitialAccounts(mnemonic, 20, network);
    userAccounts.value = accounts;
    secureLog(`Accounts loaded for ${network}`);
  } catch (error) {
    secureLog("Failed to generate accounts", error);
    router.push({ path: "/" });
  }
  isLoading.value = false;
}

onBeforeMount(async () => {
  // Check for encrypted wallet first
  if (sessionManager.hasWallet) {
    if (sessionManager.isLocked) {
      router.push({ path: "/unlock" });
      return;
    }

    // Get mnemonic from session (already unlocked)
    const mnemonic = sessionManager.getMnemonic();
    if (mnemonic) {
      currentMnemonic.value = mnemonic;
      await loadAccounts(mnemonic, selectedNetwork.value);
    } else {
      router.push({ path: "/unlock" });
    }
  } else {
    // Check for legacy unencrypted mnemonic
    const legacyMnemonic = localStorage.getItem("mnemonic");
    if (legacyMnemonic) {
      currentMnemonic.value = legacyMnemonic;
      await loadAccounts(legacyMnemonic, selectedNetwork.value);
    } else {
      router.push({ path: "/" });
    }
  }
});

// Watch for network changes and regenerate accounts
watch(selectedNetwork, async (newNetwork) => {
  setSelectedNetwork(newNetwork);
  if (currentMnemonic.value) {
    await loadAccounts(currentMnemonic.value, newNetwork);
  }
});

const handleOpenUserMenu = () => {
  router.push({ path: "/usermenu" });
};

const copiedAddress = ref<string | null>(null);

const copyToClipboard = async (address: string) => {
  try {
    await navigator.clipboard.writeText(address);
    copiedAddress.value = address;
    setTimeout(() => {
      copiedAddress.value = null;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy:", error);
  }
};

const truncateAddress = (address: string) => {
  return address.slice(0, 7) + "..." + address.slice(-7);
};
</script>

<template>
  <section class="user-page">
    <div v-if="isLoading" class="loading">Loading accounts...</div>

    <template v-else>
      <div class="user-page-header">
        <div class="header-selects">
          <select v-model="accountIndexToDisplay" class="account-select">
            <option v-for="(account, index) in userAccounts" :key="index" :value="index">
              Account {{ index + 1 }}
            </option>
          </select>
          <select v-model="selectedNetwork" class="network-select">
            <option v-for="(net, key) in NETWORKS" :key="key" :value="key">
              {{ net.name }}
            </option>
          </select>
        </div>
        <img
          class="laser-logo"
          @click="handleOpenUserMenu"
          src="/laser-eyes-lil-guy-dark.png"
          width="30px"
          alt="laser-logo"
        />
      </div>

      <div class="page-top">
        <h1>Account {{ accountIndexToDisplay + 1 }}</h1>
        <small>Total Value</small>
        <div class="value-display">$1,000,000</div>
      </div>

      <div class="page-bottom">
        <small>Assets (click to copy)</small>
        <div class="assets-display">
          <div class="assets-display-row">
            <span>STX</span>
            <span
              class="address-copy"
              :class="{ copied: copiedAddress === userAccounts[accountIndexToDisplay]?.stxAddress }"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.stxAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.stxAddress"
            >
              {{ copiedAddress === userAccounts[accountIndexToDisplay]?.stxAddress
                ? '✓ Copied!'
                : truncateAddress(userAccounts[accountIndexToDisplay]?.stxAddress || '') }}
            </span>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>BTC</span>
            <span
              class="address-copy"
              :class="{ copied: copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2PKHAddress }"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.btcP2PKHAddress"
            >
              {{ copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2PKHAddress
                ? '✓ Copied!'
                : truncateAddress(userAccounts[accountIndexToDisplay]?.btcP2PKHAddress || '') }}
            </span>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>Runes</span>
            <span
              class="address-copy"
              :class="{ copied: copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2TRAddress }"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.btcP2TRAddress"
            >
              {{ copiedAddress === userAccounts[accountIndexToDisplay]?.btcP2TRAddress
                ? '✓ Copied!'
                : truncateAddress(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '') }}
            </span>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>Ordinals</span>
            <span
              class="address-copy"
              @click="copyToClipboard(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '')"
              :title="userAccounts[accountIndexToDisplay]?.btcP2TRAddress"
            >
              {{ truncateAddress(userAccounts[accountIndexToDisplay]?.btcP2TRAddress || '') }}
            </span>
            <span>0</span>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped>
select {
  cursor: pointer;
  border: none;
  background: transparent;
  color: inherit;
}

small {
  color: #8c877d;
}

.laser-logo {
  cursor: pointer;
}

.assets-display-row {
  display: flex;
  justify-content: space-between;
  width: 100%;
  font-family: monospace;
}

.assets-display {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  row-gap: 10px;
}

.value-display {
  font-size: 3rem;
  font-weight: bolder;
  font-family: monospace;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #888;
}

.address-copy {
  cursor: pointer;
  transition: all 0.2s;
  padding: 2px 6px;
  border-radius: 4px;
}

.address-copy:hover {
  background: rgba(100, 108, 255, 0.2);
  color: #646cff;
}

.address-copy.copied {
  color: #4ade80;
  background: rgba(74, 222, 128, 0.1);
}

.header-selects {
  display: flex;
  gap: 8px;
  align-items: center;
}

.account-select {
  font-size: 0.9rem;
}

.network-select {
  font-size: 0.75rem;
  padding: 2px 4px;
  background: rgba(100, 108, 255, 0.2);
  border-radius: 4px;
  color: #646cff;
}
</style>
