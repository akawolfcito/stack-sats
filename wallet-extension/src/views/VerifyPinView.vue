<script setup lang="ts">
/**
 * VerifyPinView - V54.7 PIN Premium Rebalance
 *
 * Uses PinScreenShell for cohesive PIN layout.
 * Contextual subtitle based on action.
 *
 * V54.7 Changes:
 * - Uses PinScreenShell layout with subtitle
 * - Compact title and logo
 * - Ghost-premium keypad via PinInput
 *
 * Query params:
 * - action: 'backup' | 'delete' | etc. (what to do after success)
 * - returnTo: route to return to after cancel/success
 */
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import PinScreenShell from "@/components/pin/PinScreenShell.vue";
import PinInput from "@/components/PinInput.vue";
import { Button } from "@/components/ui";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";

const router = useRouter();
const route = useRoute();

const pinError = ref("");
const isLoading = ref(false);

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

// Parse query params
const action = computed(() => (route.query.action as string) || "verify");
const returnTo = computed(() => (route.query.returnTo as string) || "/usermenu");

// Contextual copy based on action
const headlines: Record<string, { title: string; subtitle: string }> = {
  backup: {
    title: "Verify PIN",
    subtitle: "Enter your PIN to export backup",
  },
  delete: {
    title: "Verify PIN",
    subtitle: "Enter your PIN to delete wallet",
  },
  verify: {
    title: "Verify PIN",
    subtitle: "Enter your PIN to continue",
  },
};

const currentCopy = computed(() => headlines[action.value] || headlines.verify);

const handleVerify = async (pin: string) => {
  pinError.value = "";
  isLoading.value = true;

  try {
    const mnemonic = await sessionManager.unlock(pin);

    if (mnemonic) {
      secureLog("PIN verified for action", { action: action.value });

      // Navigate back with success flag
      router.push({
        path: returnTo.value,
        query: {
          pinVerified: "true",
          action: action.value,
        },
      });
    } else {
      const remaining = sessionManager.attemptsRemaining;
      if (remaining <= 0) {
        pinError.value = "Too many attempts. Please try again later.";
      } else {
        pinError.value = `Wrong PIN. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining.`;
      }
    }
  } catch (error) {
    pinError.value = "Verification failed";
    secureLog("PIN verification failed", error);
  } finally {
    isLoading.value = false;
  }
};

const handleCancel = () => {
  router.push(returnTo.value);
};

onMounted(() => {
  // Ensure we have a wallet
  if (!sessionManager.hasWallet) {
    router.push({ path: "/" });
    return;
  }

  pinInputRef.value?.focus();
});
</script>

<template>
  <PinScreenShell
    :title="currentCopy.title"
    :subtitle="currentCopy.subtitle"
    :show-logo="true"
    :show-ambient="true"
  >
    <!-- PIN Input -->
    <PinInput
      ref="pinInputRef"
      mode="unlock"
      :error="pinError"
      :disabled="isLoading"
      :show-biometric="true"
      hide-label
      @complete="handleVerify"
    >
      <!-- Cancel link above keypad -->
      <template #above-keypad>
        <Button
          variant="ghost"
          size="sm"
          :disabled="isLoading"
          @click="handleCancel"
        >
          Cancel
        </Button>
      </template>
    </PinInput>

    <!-- Loading indicator -->
    <template #loading>
      <p v-if="isLoading" class="loading-text">Verifying...</p>
    </template>
  </PinScreenShell>
</template>

<style scoped>
.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
  padding: var(--space-sm);
}
</style>
