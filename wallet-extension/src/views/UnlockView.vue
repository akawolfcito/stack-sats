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
  <section class="unlock-view">
    <!-- Ambient Glow -->
    <div class="ambient-glow"></div>

    <!-- Normal unlock view -->
    <template v-if="!showDeleteConfirm">
      <div class="unlock-content">
        <!-- Logo -->
        <div class="logo-container">
          <div class="logo-glow"></div>
          <div class="logo-box">
            <img src="/denvault-i.png" alt="DenVault" class="logo-image" />
          </div>
        </div>

        <!-- Text -->
        <div class="text-section">
          <h1 class="title">Welcome Back</h1>
          <p class="subtitle">Enter your PIN to unlock your wallet</p>
        </div>

        <!-- PIN Input -->
        <PinInput
          ref="pinInputRef"
          mode="unlock"
          :error="pinError"
          :disabled="isLoading || attemptsRemaining <= 0"
          :show-biometric="true"
          @complete="handleUnlock"
        />

        <!-- Forgot PIN -->
        <button
          class="forgot-btn"
          :disabled="isLoading"
          @click="handleForgotPin"
        >
          Forgot PIN?
        </button>

        <p v-if="isLoading" class="loading-text">Unlocking...</p>
      </div>
    </template>

    <!-- Delete confirmation view -->
    <template v-else>
      <div class="delete-content">
        <!-- Warning Card -->
        <div class="danger-card">
          <div class="danger-icon">
            <svg class="w-12 h-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
          <h2 class="danger-title">Reset Wallet</h2>
          <p class="danger-text">
            This will permanently delete your wallet from this device.
            Make sure you have your recovery phrase saved!
          </p>
        </div>

        <!-- Confirm Input -->
        <div class="confirm-section">
          <label class="confirm-label">Type DELETE to confirm:</label>
          <input
            v-model="deleteConfirmText"
            type="text"
            placeholder="DELETE"
            class="confirm-input"
            autocomplete="off"
          />
        </div>

        <!-- Actions -->
        <div class="delete-actions">
          <button class="btn-secondary" @click="handleCancelDelete">
            Cancel
          </button>
          <button
            class="btn-danger"
            :disabled="deleteConfirmText.toUpperCase() !== 'DELETE'"
            @click="handleConfirmDelete"
          >
            Reset Wallet
          </button>
        </div>
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
}

/* Unlock Content */
.unlock-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-xl);
  padding-top: 60px;
  gap: var(--space-lg);
  position: relative;
  z-index: 10;
}

/* Logo */
.logo-container {
  position: relative;
  margin-bottom: var(--space-md);
}

.logo-glow {
  position: absolute;
  inset: -16px;
  background: var(--color-accent-primary);
  opacity: 0.2;
  filter: blur(32px);
  border-radius: 50%;
  transition: opacity 0.5s ease;
}

.logo-box {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 32px;
  background: linear-gradient(135deg, #2a2d15, #1a1c0d);
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow:
    8px 8px 16px rgba(18, 20, 9, 0.8),
    -8px -8px 16px rgba(46, 48, 23, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-image {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  object-fit: cover;
}

/* Text Section */
.text-section {
  text-align: center;
  margin-bottom: var(--space-md);
}

.title {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-sm);
}

.subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  margin: 0;
}

/* Forgot Button */
.forgot-btn {
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  padding: var(--space-sm) var(--space-md);
  border-radius: var(--radius-lg);
  transition: all 0.2s ease;
  margin-top: var(--space-md);
}

.forgot-btn:hover:not(:disabled) {
  color: var(--color-accent-primary);
}

.forgot-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  margin: 0;
}

/* Delete Content */
.delete-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-xl);
  gap: var(--space-xl);
  position: relative;
  z-index: 10;
}

/* Danger Card */
.danger-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: var(--space-xl);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-2xl);
  max-width: 320px;
}

.danger-icon {
  color: var(--color-error);
  margin-bottom: var(--space-lg);
}

.danger-title {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-error);
  margin: 0 0 var(--space-md);
}

.danger-text {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  margin: 0;
}

/* Confirm Section */
.confirm-section {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.confirm-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.confirm-input {
  width: 100%;
  height: 56px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: 0 var(--space-lg);
  font-size: var(--font-size-base);
  color: var(--color-text-primary);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  outline: none;
  transition: all 0.2s ease;
}

.confirm-input:focus {
  border-color: var(--color-error);
}

.confirm-input::placeholder {
  color: var(--color-text-muted);
  text-transform: uppercase;
}

/* Delete Actions */
.delete-actions {
  display: flex;
  gap: var(--space-md);
  width: 100%;
  max-width: 320px;
}

.btn-secondary {
  flex: 1;
  height: 56px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 9999px;
  color: var(--color-text-primary);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-secondary:hover {
  background: var(--color-bg-elevated);
}

.btn-danger {
  flex: 1;
  height: 56px;
  background: var(--color-error);
  border: none;
  border-radius: 9999px;
  color: white;
  font-size: var(--font-size-base);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-danger:hover:not(:disabled) {
  background: #dc2626;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
