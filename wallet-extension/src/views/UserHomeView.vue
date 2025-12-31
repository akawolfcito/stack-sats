<script setup lang="ts">
import { useRouter } from "vue-router";
import { onBeforeMount, ref } from "vue";
import { generateInitialAccounts } from "../utils/accounts";
import { type Account } from "../utils/types";
import { sessionManager } from "../utils/security/session";
import { secureLog } from "../utils/security/logger";

const router = useRouter();
const userAccounts = ref<Account[]>([]);
const accountIndexToDisplay = ref(0);
const isLoading = ref(true);

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
      try {
        const accounts = await generateInitialAccounts(mnemonic);
        userAccounts.value = accounts;
        secureLog("Accounts loaded from encrypted wallet");
      } catch (error) {
        secureLog("Failed to generate accounts", error);
        router.push({ path: "/" });
      }
    } else {
      router.push({ path: "/unlock" });
    }
  } else {
    // Check for legacy unencrypted mnemonic
    const legacyMnemonic = localStorage.getItem("mnemonic");
    if (legacyMnemonic) {
      try {
        const accounts = await generateInitialAccounts(legacyMnemonic);
        userAccounts.value = accounts;
        secureLog("Accounts loaded from legacy wallet");
      } catch (error) {
        secureLog("Failed to generate accounts", error);
        router.push({ path: "/" });
      }
    } else {
      router.push({ path: "/" });
    }
  }

  isLoading.value = false;
});

const handleOpenUserMenu = () => {
  router.push({ path: "/usermenu" });
};
</script>

<template>
  <section class="user-page">
    <div v-if="isLoading" class="loading">Loading accounts...</div>

    <template v-else>
      <div class="user-page-header">
        <select v-model="accountIndexToDisplay">
          <option v-for="(account, index) in userAccounts" :key="index" :value="index">
            Account {{ index + 1 }}
          </option>
        </select>
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
        <small>Assets</small>
        <div class="assets-display">
          <div class="assets-display-row">
            <span>STX</span>
            <span>{{
              userAccounts[accountIndexToDisplay]?.stxAddress.slice(0, 7) +
              "..." +
              userAccounts[accountIndexToDisplay]?.stxAddress.slice(-7)
            }}</span>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>BTC</span>
            <span>{{
              userAccounts[accountIndexToDisplay]?.btcP2PKHAddress.slice(0, 7) +
              "..." +
              userAccounts[accountIndexToDisplay]?.btcP2PKHAddress.slice(-7)
            }}</span>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>Runes</span>
            <span>{{
              userAccounts[accountIndexToDisplay]?.btcP2TRAddress.slice(0, 7) +
              "..." +
              userAccounts[accountIndexToDisplay]?.btcP2TRAddress.slice(-7)
            }}</span>
            <span>0</span>
          </div>
          <div class="assets-display-row">
            <span>Ordinals</span>
            <span>{{
              userAccounts[accountIndexToDisplay]?.btcP2TRAddress.slice(0, 7) +
              "..." +
              userAccounts[accountIndexToDisplay]?.btcP2TRAddress.slice(-7)
            }}</span>
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
</style>
