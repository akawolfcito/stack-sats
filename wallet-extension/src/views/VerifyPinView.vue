<script setup lang="ts">
/**
 * VerifyPinView - V55.0 PIN Screens Premium Finalization
 *
 * Uses PinScreenShell for cohesive PIN layout.
 * Contextual subtitle based on action.
 *
 * V55.0 Changes:
 * - PIN-only policy: biometrics disabled for security-sensitive verify actions
 * - Ensures user explicitly enters PIN for backup/delete operations
 *
 * V54.8 Changes (preserved):
 * - "Cancel" styled as subtle secondary action (matching Forgot PIN)
 * - Unified visual hierarchy with UnlockView
 * - Consistent title/subtitle typography
 *
 * V54.7 Changes (preserved):
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
    <!-- V55.0: PIN Input - PIN-only policy (no biometrics for verify actions) -->
    <PinInput
      ref="pinInputRef"
      mode="unlock"
      :error="pinError"
      :disabled="isLoading"
      hide-label
      @complete="handleVerify"
    >
      <!-- V54.8: Cancel as subtle secondary action -->
      <template #above-keypad>
        <button
          type="button"
          class="cancel-link"
          :disabled="isLoading"
          data-roi="cancel-link"
          @click="handleCancel"
        >
          Cancel
        </button>
      </template>
    </PinInput>

    <!-- Loading indicator -->
    <template #loading>
      <p v-if="isLoading" class="loading-text">Verifying...</p>
    </template>
  </PinScreenShell>
</template>

<style scoped>
/* V54.8: Cancel as subtle secondary action */
.cancel-link {
  background: none;
  border: none;
  padding: var(--space-xs) var(--space-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: color 0.15s ease;
  text-decoration: none;
  position: relative;
}

.cancel-link::after {
  content: '';
  position: absolute;
  bottom: 2px;
  left: var(--space-sm);
  right: var(--space-sm);
  height: 1px;
  background: currentColor;
  opacity: 0;
  transform: scaleX(0.8);
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.cancel-link:hover:not(:disabled) {
  color: var(--color-text-primary);
}

.cancel-link:hover:not(:disabled)::after {
  opacity: 0.4;
  transform: scaleX(1);
}

.cancel-link:active:not(:disabled) {
  color: var(--color-accent-primary);
}

.cancel-link:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.cancel-link:focus-visible {
  outline: 2px solid var(--color-accent-primary);
  outline-offset: 2px;
  border-radius: var(--radius-sm);
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
  padding: var(--space-sm);
}
</style>
