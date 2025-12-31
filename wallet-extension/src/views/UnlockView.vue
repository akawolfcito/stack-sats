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

const handleConfirmDelete = () => {
  if (deleteConfirmText.value.toUpperCase() !== "DELETE") {
    return;
  }

  sessionManager.deleteWallet();
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
      <img src="/laser-eyes-lil-guy-dark.png" width="80px" alt="laser-logo" />
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
  padding: 20px;
}

.page-top {
  text-align: center;
  margin-bottom: 32px;
}

.page-top h1 {
  font-weight: 900;
  margin: 16px 0 8px;
}

.page-top p {
  color: #888;
  font-size: 0.9rem;
  margin: 0;
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
}

.btn-link {
  background: none;
  border: none;
  color: #646cff;
  font-size: 0.875rem;
  cursor: pointer;
  text-decoration: underline;
  padding: 8px;
}

.btn-link:hover:not(:disabled) {
  color: #535bf2;
}

.btn-link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-text {
  color: #888;
  font-size: 0.875rem;
  margin: 0;
}

.delete-warning {
  background: rgba(255, 68, 68, 0.1);
  border: 1px solid rgba(255, 68, 68, 0.3);
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  width: 100%;
}

.delete-warning strong {
  color: #ff4444;
  font-size: 1.1rem;
}

.delete-warning p {
  margin: 12px 0 0;
  font-size: 0.875rem;
  color: #888;
  line-height: 1.4;
}

.delete-confirm-input {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.delete-confirm-input label {
  font-size: 0.875rem;
  color: #888;
}

.confirm-input {
  width: 100%;
  padding: 12px;
  font-size: 1rem;
  border: 2px solid #444;
  border-radius: 8px;
  background: #1a1a1a;
  color: #fff;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.confirm-input:focus {
  outline: none;
  border-color: #ff4444;
}

.button-group {
  display: flex;
  gap: 12px;
  width: 100%;
}

.btn-secondary {
  flex: 1;
  background: transparent;
  color: #888;
  border: 1px solid #444;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.btn-secondary:hover {
  border-color: #666;
  color: #fff;
}

.btn-danger {
  flex: 1;
  background: #ff4444;
  color: white;
  border: none;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-danger:hover:not(:disabled) {
  background: #ff2222;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
