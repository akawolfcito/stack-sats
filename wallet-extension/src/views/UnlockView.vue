<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";

const router = useRouter();

const pinError = ref("");
const isLoading = ref(false);
const showDeleteConfirm = ref(false);
const deleteConfirmText = ref("");

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

const attemptsRemaining = computed(() => sessionManager.attemptsRemaining);

const handleUnlock = async (pin: string) => {
  pinError.value = "";
  isLoading.value = true;

  try {
    const mnemonic = await sessionManager.unlock(pin);

    if (mnemonic) {
      secureLog("Wallet unlocked");
      router.push({ path: "/user" });
    } else {
      const remaining = sessionManager.attemptsRemaining;
      if (remaining <= 0) {
        pinError.value = "Too many attempts. Reset wallet to continue.";
      } else {
        pinError.value = `Wrong PIN. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`;
      }
    }
  } catch (error) {
    pinError.value = "Failed to unlock wallet";
    secureLog("Unlock failed", error);
  } finally {
    isLoading.value = false;
  }
};

const handleForgotPin = () => {
  showDeleteConfirm.value = true;
  deleteConfirmText.value = "";
};

const handleCancelDelete = () => {
  showDeleteConfirm.value = false;
  deleteConfirmText.value = "";
  pinInputRef.value?.focus();
};

const handleConfirmDelete = async () => {
  if (deleteConfirmText.value.toUpperCase() !== "DELETE") {
    return;
  }

  await sessionManager.deleteWalletAsync();
  secureLog("Wallet deleted");
  router.push({ path: "/" });
};

onMounted(() => {
  // Check if wallet exists
  if (!sessionManager.hasWallet) {
    router.push({ path: "/" });
    return;
  }

  // Check if already unlocked
  if (!sessionManager.isLocked) {
    router.push({ path: "/user" });
    return;
  }

  pinInputRef.value?.focus();
});
</script>

<template>
  <section class="unlock-page">
    <div class="page-top">
      <img src="/ironvault.png" width="80px" alt="laser-logo" />
      <h1>Welcome Back</h1>
      <p>Enter your PIN to unlock your wallet</p>
    </div>

    <div class="page-content">
      <!-- Normal unlock view -->
      <template v-if="!showDeleteConfirm">
        <PinInput
          ref="pinInputRef"
          mode="unlock"
          :error="pinError"
          :disabled="isLoading || attemptsRemaining <= 0"
          @complete="handleUnlock"
        />

        <button
          @click="handleForgotPin"
          class="btn-link"
          :disabled="isLoading"
        >
          Forgot PIN?
        </button>

        <p v-if="isLoading" class="loading-text">Unlocking...</p>
      </template>

      <!-- Delete confirmation view -->
      <template v-else>
        <div class="delete-warning">
          <strong>Reset Wallet</strong>
          <p>
            This will permanently delete your wallet from this device.
            Make sure you have your recovery phrase saved!
          </p>
        </div>

        <div class="delete-confirm-input">
          <label>Type DELETE to confirm:</label>
          <input
            v-model="deleteConfirmText"
            type="text"
            placeholder="DELETE"
            class="confirm-input"
            autocomplete="off"
          />
        </div>

        <div class="button-group">
          <button @click="handleCancelDelete" class="btn-secondary">
            Cancel
          </button>
          <button
            @click="handleConfirmDelete"
            class="btn-danger"
            :disabled="deleteConfirmText.toUpperCase() !== 'DELETE'"
          >
            Reset Wallet
          </button>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.unlock-page {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  padding: var(--space-lg);
}

.page-top {
  text-align: center;
  padding-top: var(--space-3xl);
  margin-bottom: var(--space-2xl);
}

.page-top img {
  margin-bottom: var(--space-lg);
}

.page-top h1 {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-2xl);
  margin: 0 0 var(--space-sm);
  color: var(--color-text-primary);
}

.page-top p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  margin: 0;
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-xl);
}

.btn-link {
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  cursor: pointer;
  text-decoration: none;
  padding: var(--space-sm);
  width: auto;
}

.btn-link:hover:not(:disabled) {
  color: var(--color-accent-primary);
}

.btn-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}

.delete-warning {
  background: var(--color-error-muted);
  border: 1px solid var(--color-error);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
  text-align: center;
  width: 100%;
}

.delete-warning strong {
  color: var(--color-error);
  font-size: var(--font-size-lg);
}

.delete-warning p {
  margin: var(--space-md) 0 0;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.delete-confirm-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.delete-confirm-input label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.confirm-input {
  width: 100%;
  padding: var(--space-lg);
  font-size: var(--font-size-base);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  background: var(--color-bg-card);
  color: var(--color-text-primary);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
  height: auto;
}

.confirm-input:focus {
  outline: none;
  border-color: var(--color-error);
}

.button-group {
  display: flex;
  gap: var(--space-md);
  width: 100%;
}
</style>
