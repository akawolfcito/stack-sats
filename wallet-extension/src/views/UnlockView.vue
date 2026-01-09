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
  <section class="flex flex-col min-h-full p-4">
    <!-- Header -->
    <div class="text-center pt-12 mb-8">
      <img src="/denvault-i.png" width="120" alt="DenVault" class="mx-auto mb-4" />
      <h1 class="font-bold text-2xl mb-2 text-text-primary">Welcome Back</h1>
      <p class="text-text-secondary text-sm m-0">Enter your PIN to unlock your wallet</p>
    </div>

    <!-- Content -->
    <div class="flex-1 flex flex-col items-center gap-6">
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
          class="bg-transparent border-none text-text-muted text-sm cursor-pointer p-2 w-auto hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="isLoading"
        >
          Forgot PIN?
        </button>

        <p v-if="isLoading" class="text-text-muted text-sm m-0">Unlocking...</p>
      </template>

      <!-- Delete confirmation view -->
      <template v-else>
        <div class="bg-error-muted border border-error rounded-lg p-4 text-center w-full">
          <strong class="text-error text-lg">Reset Wallet</strong>
          <p class="mt-3 text-sm text-text-secondary leading-relaxed">
            This will permanently delete your wallet from this device.
            Make sure you have your recovery phrase saved!
          </p>
        </div>

        <div class="w-full flex flex-col gap-2">
          <label class="text-sm text-text-secondary">Type DELETE to confirm:</label>
          <input
            v-model="deleteConfirmText"
            type="text"
            placeholder="DELETE"
            class="w-full p-4 text-base border border-border-default rounded-xl bg-bg-card text-text-primary text-center uppercase tracking-widest focus:outline-none focus:border-error"
            autocomplete="off"
          />
        </div>

        <div class="flex gap-3 w-full">
          <button @click="handleCancelDelete" class="btn-secondary flex-1">
            Cancel
          </button>
          <button
            @click="handleConfirmDelete"
            class="btn-danger flex-1"
            :disabled="deleteConfirmText.toUpperCase() !== 'DELETE'"
          >
            Reset Wallet
          </button>
        </div>
      </template>
    </div>
  </section>
</template>
