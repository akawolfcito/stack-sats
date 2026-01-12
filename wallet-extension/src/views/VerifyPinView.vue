<script setup lang="ts">
/**
 * VerifyPinView - V48 Fullscreen PIN Verification
 *
 * Reuses UnlockView scaffold for visual parity:
 * - Logo + ambient glow
 * - Headline + subtitle
 * - PinInput with full keypad
 *
 * Query params:
 * - action: 'backup' | 'delete' | etc. (what to do after success)
 * - returnTo: route to return to after cancel/success
 */
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
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
  <section class="verify-pin-view">
    <!-- Ambient Glow (same as UnlockView) -->
    <div class="ambient-glow"></div>

    <div class="verify-content">
      <!-- Header: Logo + Title (same as UnlockView) -->
      <div class="verify-header">
        <div class="logo-container">
          <div class="logo-glow"></div>
          <div class="logo-box">
            <img src="/denvault-i.png" alt="DenVault" class="logo-image" />
          </div>
        </div>
        <h1 class="title">{{ currentCopy.title }}</h1>
      </div>

      <!-- PIN Input (with keypad at bottom) - V48: show-biometric for parity with Unlock -->
      <PinInput
        ref="pinInputRef"
        mode="unlock"
        :error="pinError"
        :disabled="isLoading"
        :show-biometric="true"
        @complete="handleVerify"
      >
        <!-- Slot: Cancel link above keypad (instead of Forgot PIN) -->
        <template #above-keypad>
          <p class="subtitle">{{ currentCopy.subtitle }}</p>
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

      <p v-if="isLoading" class="loading-text">Verifying...</p>
    </div>
  </section>
</template>

<style scoped>
/* V48: Same styles as UnlockView for visual parity */
.verify-pin-view {
  display: flex;
  flex-direction: column;
  min-height: 100%;
  background: var(--color-bg-primary);
  position: relative;
  overflow: hidden;
}

/* Ambient Glow */
.ambient-glow {
  position: absolute;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 150%;
  height: 50%;
  background: var(--color-accent-primary);
  opacity: 0.05;
  filter: blur(100px);
  border-radius: 50%;
  pointer-events: none;
}

/* Content */
.verify-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
}

/* Header */
.verify-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 16px 16px;
  gap: 12px;
}

/* Logo */
.logo-container {
  position: relative;
}

.logo-glow {
  position: absolute;
  inset: -12px;
  background: var(--color-accent-primary);
  opacity: 0.2;
  filter: blur(24px);
  border-radius: 50%;
}

.logo-box {
  position: relative;
  width: 64px;
  height: 64px;
  border-radius: 20px;
  background: linear-gradient(135deg, #2a2d15, #1a1c0d);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: var(--shadow-elev-1);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-image {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
}

.title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0;
}

/* Subtitle in slot */
.subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0 0 var(--space-sm);
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}
</style>
