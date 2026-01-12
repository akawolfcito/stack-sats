<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import PinInput from "@/components/PinInput.vue";
import { Button, TextField } from "@/components/ui";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";

const router = useRouter();

const pinError = ref("");
const isLoading = ref(false);
const showDeleteConfirm = ref(false);
const deleteConfirmText = ref("");

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

const attemptsRemaining = computed(() => sessionManager.attemptsRemaining);

const canDelete = computed(() => deleteConfirmText.value.toUpperCase() === "DELETE");

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
  if (!canDelete.value) return;

  await sessionManager.deleteWalletAsync();
  secureLog("Wallet deleted");
  router.push({ path: "/" });
};

onMounted(() => {
  if (!sessionManager.hasWallet) {
    router.push({ path: "/" });
    return;
  }

  if (!sessionManager.isLocked) {
    router.push({ path: "/user" });
    return;
  }

  pinInputRef.value?.focus();
});
</script>

<template>
  <section class="unlock-view">
    <!-- Ambient Glow -->
    <div class="ambient-glow" :class="{ 'ambient-glow--danger': showDeleteConfirm }"></div>

    <!-- Normal unlock view -->
    <template v-if="!showDeleteConfirm">
      <div class="unlock-content">
        <!-- Header: Logo + Title -->
        <div class="unlock-header">
          <div class="logo-container">
            <div class="logo-glow"></div>
            <div class="logo-box">
              <img src="/denvault-i.png" alt="DenVault" class="logo-image" />
            </div>
          </div>
          <h1 class="title">Welcome Back</h1>
        </div>

        <!-- PIN Input (with keypad at bottom) -->
        <PinInput
          ref="pinInputRef"
          mode="unlock"
          :error="pinError"
          :disabled="isLoading || attemptsRemaining <= 0"
          :show-biometric="true"
          @complete="handleUnlock"
        >
          <!-- Slot: Forgot PIN link above keypad -->
          <template #above-keypad>
            <Button
              variant="ghost"
              size="sm"
              :disabled="isLoading"
              @click="handleForgotPin"
            >
              Forgot PIN?
            </Button>
          </template>
        </PinInput>

        <p v-if="isLoading" class="loading-text">Unlocking...</p>
      </div>
    </template>

    <!-- Reset Wallet Confirmation -->
    <template v-else>
      <div class="reset-content">
        <!-- Header -->
        <header class="reset-header">
          <Button variant="icon" @click="handleCancelDelete">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </Button>
          <h1>Reset Wallet</h1>
          <div class="header-spacer"></div>
        </header>

        <!-- Main Content -->
        <main class="reset-main">
          <!-- Danger Zone Card -->
          <div class="danger-card">
            <!-- Inner Glow -->
            <div class="danger-card-glow"></div>

            <!-- Content -->
            <div class="danger-card-content">
              <!-- Warning Icon -->
              <div class="warning-icon-wrapper">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/>
                  <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>

              <!-- Headline -->
              <h2 class="danger-headline">Danger Zone</h2>

              <!-- Warning Text -->
              <p class="danger-text">
                This action is <span class="text-danger">irreversible</span>. It will permanently delete all your wallets, keys, and transaction history from this device.
              </p>

              <!-- Input Section -->
              <div class="input-section">
                <label class="input-label" for="delete-input">
                  Type 'DELETE' to confirm
                </label>
                <div class="input-wrapper">
                  <input
                    id="delete-input"
                    v-model="deleteConfirmText"
                    type="text"
                    placeholder="DELETE"
                    class="delete-input"
                    autocomplete="off"
                  />
                  <div class="input-icon" :class="{ 'input-icon--valid': canDelete }">
                    <svg v-if="canDelete" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <!-- Bottom Stripe -->
            <div class="danger-stripe"></div>
          </div>

          <!-- Spacer -->
          <div class="flex-spacer"></div>

          <!-- Info Note -->
          <div class="info-note">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="16" x2="12" y2="12"/>
              <line x1="12" y1="8" x2="12.01" y2="8"/>
            </svg>
            <p>
              Make sure you have backed up your Secret Recovery Phrase. Without it, you will lose access to your funds forever.
            </p>
          </div>

          <!-- Action Buttons -->
          <div class="action-buttons">
            <Button variant="secondary" full-width @click="handleCancelDelete">
              Cancel
            </Button>
            <Button
              variant="danger"
              full-width
              :disabled="!canDelete"
              @click="handleConfirmDelete"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                <line x1="10" y1="11" x2="10" y2="17"/>
                <line x1="14" y1="11" x2="14" y2="17"/>
              </svg>
              Reset Wallet
            </Button>
          </div>
        </main>
      </div>
    </template>
  </section>
</template>

<style scoped>
.unlock-view {
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
  transition: all 0.5s ease;
}

.ambient-glow--danger {
  background: #ef4444;
  opacity: 0.08;
}

/* Unlock Content */
.unlock-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
}

/* Unlock Header */
.unlock-header {
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

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}

/* ========== RESET WALLET FLOW ========== */

.reset-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 10;
}

/* Reset Header */
.reset-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 16px 12px;
  flex-shrink: 0;
}

.reset-header h1 {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.header-spacer {
  width: var(--icon-btn-size);
}

/* Reset Main */
.reset-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 16px;
  padding-bottom: 24px;
  overflow-y: auto;
}

/* Danger Card */
.danger-card {
  position: relative;
  width: 100%;
  border-radius: 16px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  background: #282828;
  overflow: hidden;
  box-shadow: var(--shadow-error-lg);
}

.danger-card-glow {
  position: absolute;
  inset: 0;
  border-radius: 16px;
  box-shadow: inset 0 0 20px 0 rgba(239, 68, 68, 0.1);
  pointer-events: none;
  z-index: 0;
}

.danger-card-content {
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  text-align: center;
}

/* Warning Icon */
.warning-icon-wrapper {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ef4444;
  margin-bottom: 20px;
}

/* Headline */
.danger-headline {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 8px;
  letter-spacing: -0.02em;
}

/* Danger Text */
.danger-text {
  font-size: var(--font-size-sm);
  color: #9ca3af;
  line-height: 1.6;
  margin: 0 0 24px;
  padding: 0 8px;
}

.text-danger {
  color: #ef4444;
  font-weight: 700;
}

/* Input Section */
.input-section {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-label {
  font-size: var(--font-size-2xs);
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  text-align: left;
  margin-left: 4px;
}

.input-wrapper {
  position: relative;
  width: 100%;
}

.delete-input {
  width: 100%;
  height: 52px;
  padding: 0 48px 0 16px;
  background: #101818;
  border: 1px solid #374151;
  border-radius: 12px;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.3em;
  outline: none;
  transition: all 0.2s ease;
}

.delete-input:focus {
  border-color: var(--color-error);
  outline: 2px solid var(--color-error);
  outline-offset: -1px;
}

.delete-input::placeholder {
  color: #4b5563;
  text-transform: uppercase;
  letter-spacing: 0.3em;
}

.input-icon {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  color: #4b5563;
  transition: color 0.2s ease;
}

.input-icon--valid {
  color: #22c55e;
}

/* Danger Stripe */
.danger-stripe {
  height: 4px;
  width: 100%;
  background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.5), transparent);
}

/* Flex Spacer */
.flex-spacer {
  flex: 1;
  min-height: 40px;
}

/* Info Note */
.info-note {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 0 8px;
  margin-bottom: 24px;
  opacity: 0.7;
}

.info-note svg {
  color: #6b7280;
  flex-shrink: 0;
  margin-top: 2px;
}

.info-note p {
  font-size: var(--font-size-xs);
  color: #6b7280;
  line-height: 1.5;
  margin: 0;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  gap: var(--space-md);
}
</style>
