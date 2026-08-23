<script setup lang="ts">
/**
 * StartView - V55.1 Shell Header Scale + Rhythm Unification
 *
 * Wallet onboarding flow: create/import → mnemonic → verify → PIN setup
 * Uses ScreenShell + AppHeader for non-PIN steps, PinScreenShell for PIN steps.
 *
 * V55.1 Changes:
 * - Hero logo scaled to 72px (was 96px) for visual harmony with flow screens
 * - Scale rules: Hero = 72px, Flow (PIN) = 44px
 * - data-roi="start-hero-logo" for E2E guards
 *
 * V55.0 Changes (preserved):
 * - Standardized microcopy across all PIN screens
 * - Consistent helper text: "Don't reuse a PIN you use elsewhere."
 *
 * V54.9 Changes (preserved):
 * - PIN steps now use PinScreenShell (same as Unlock/Verify)
 * - Consistent logo, title, ambient glow across all PIN screens
 * - Step indicator eyebrow for Create/Confirm PIN
 *
 * V53.2 Changes (preserved):
 * - Uses shared RecoveryPhraseDisplay component
 * - Uses shared VerifyPhraseStep component
 * - Same recovery phrase UX as AddWalletView
 */
import { onBeforeMount, onMounted, ref, nextTick, computed } from "vue";
import { randomSeedPhrase } from "@stacks/wallet-sdk";
import { useRouter } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import PinScreenShell from "@/components/pin/PinScreenShell.vue";
import PinInput from "@/components/PinInput.vue";
import RecoveryPhraseDisplay from "@/components/RecoveryPhraseDisplay.vue";
import VerifyPhraseStep from "@/components/VerifyPhraseStep.vue";
import { Button } from "@/components/ui";
import { encryptWithPIN, isValidPIN } from "@/utils/security";
import { sessionManager } from "@/utils/security/session";
import { secureLog } from "@/utils/security/logger";
import { emitWalletCreated, emitWalletImported } from "@/denlabs/emit";
import { parseBackupFile } from "@/utils/backup";
import { importWalletAsync, walletExistsAsync } from "@/utils/wallets";

const router = useRouter();

// Steps: 'start' -> 'mnemonic' -> 'verify' -> 'pin-create' -> 'pin-confirm' -> done
type Step = "start" | "mnemonic" | "verify" | "pin-create" | "pin-confirm";
const currentStep = ref<Step>("start");

// V54.9: Check if current step is a PIN step (uses PinScreenShell)
const isPinStep = computed(() =>
  currentStep.value === "pin-create" || currentStep.value === "pin-confirm"
);

// V54.9: PIN screen config for PinScreenShell
const pinScreenConfig = computed(() => {
  if (currentStep.value === "pin-create") {
    return {
      title: "Create a 6-digit PIN",
      eyebrow: "FINAL STEP",
      subtitle: undefined,
    };
  }
  if (currentStep.value === "pin-confirm") {
    return {
      title: "Confirm your PIN",
      eyebrow: undefined,
      subtitle: "Re-enter to verify",
    };
  }
  return { title: "", eyebrow: undefined, subtitle: undefined };
});

// V53: Dynamic header config based on step (for non-PIN steps)
const headerConfig = computed(() => {
  switch (currentStep.value) {
    case "start":
      return { title: "", left: "none" as const, showHeader: false };
    case "mnemonic":
      return { title: "Recovery Phrase", left: "back" as const, showHeader: true };
    case "verify":
      return { title: "Verify Phrase", left: "back" as const, showHeader: true };
    default:
      return { title: "", left: "none" as const, showHeader: false };
  }
});

const mnemonic = ref("");
const pin = ref("");
const pinConfirm = ref("");
const pinError = ref("");
const isLoading = ref(false);
const importError = ref("");
const isImportedWallet = ref(false); // Track if wallet was imported vs created

// V53.2: Verification state - indices generated when entering verify step
const verifyWord1Index = ref(0);
const verifyWord2Index = ref(0);

const pinInputRef = ref<InstanceType<typeof PinInput> | null>(null);

// V53.2: Generate random word indices for verification
function generateVerifyIndices() {
  const words = mnemonic.value.split(" ");
  const wordCount = words.length;

  const idx1 = Math.floor(Math.random() * wordCount);
  let idx2 = Math.floor(Math.random() * wordCount);
  while (idx2 === idx1) {
    idx2 = Math.floor(Math.random() * wordCount);
  }

  const [first, second] = [idx1, idx2].sort((a, b) => a - b);
  verifyWord1Index.value = first;
  verifyWord2Index.value = second;
}

// V53.2: Handle verified - proceed to PIN step
function handleVerified() {
  currentStep.value = "pin-create";
  nextTick(() => {
    pinInputRef.value?.focus();
  });
}

// Generate random mnemonic seed phrase
const handleGenerateSecret = () => {
  const seedPhrase = randomSeedPhrase();
  secureLog("Mnemonic generated");
  mnemonic.value = seedPhrase;
  currentStep.value = "mnemonic";
};

// V76: Navigate to import recovery phrase page
const handleImportMnemonic = () => {
  importError.value = "";
  router.push("/import-recovery");
};

/**
 * Restore an encrypted backup, from the screen where there is no wallet.
 *
 * Settings can already read these files, but Settings is behind an
 * unlocked wallet, so the only door for a backup was the one situation
 * where nobody needs one. Someone who reset the extension, or moved to
 * another computer, arrived here with a valid file and nowhere to put it.
 *
 * The entry is already encrypted, so writing it needs no session: the PIN
 * is asked for at the unlock screen afterwards, and it is the PIN that was
 * in use when the backup was made. Saying that plainly matters, because a
 * restored wallet that will not open to today's PIN reads as a lost wallet.
 */
const restoreInputRef = ref<HTMLInputElement | null>(null);

const handleRestoreBackup = () => {
  importError.value = "";
  restoreInputRef.value?.click();
};

async function handleBackupFileSelected(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  // Let the same file be chosen again after a failure.
  input.value = "";
  importError.value = "";

  const backup = await parseBackupFile(file);
  if (!backup) {
    importError.value = "That is not a DenVault backup file.";
    return;
  }

  const alreadyHere = await walletExistsAsync(backup.wallet.id);
  const result = await importWalletAsync(backup.wallet, alreadyHere);

  if (!result) {
    importError.value = "The backup could not be restored. The file may be damaged.";
    return;
  }

  // The unlock screen bounces back here when sessionManager reports no
  // wallet, and that flag lives in memory: importWalletAsync writes
  // straight to the vault and never touches it. Without this refresh the
  // screen sat there having apparently done nothing, and only closing and
  // reopening the popup, which rebuilds the session from storage, revealed
  // the unlock screen. The wallet had been restored the whole time.
  await sessionManager.checkWalletExistsAsync();

  secureLog("Wallet restored from backup at setup", { walletId: backup.wallet.id });
  router.push("/unlock");
}

// V76: Check for imported mnemonic from route state on mount
onMounted(() => {
  const state = window.history.state;
  if (state?.importedMnemonic) {
    secureLog("Mnemonic imported");
    mnemonic.value = state.importedMnemonic;
    isImportedWallet.value = true; // Mark as imported for DenLabs event
    currentStep.value = "mnemonic";
    // Clear state to prevent re-import on refresh
    window.history.replaceState({ ...state, importedMnemonic: undefined }, "");
  }
});

// V53.2: Proceed to verification step
function handleContinueToVerify() {
  generateVerifyIndices();
  currentStep.value = "verify";
}

// Handle PIN creation
const handlePinCreate = (enteredPin: string) => {
  if (!isValidPIN(enteredPin)) {
    pinError.value = "PIN must be 6 digits";
    return;
  }

  pin.value = enteredPin;
  pinError.value = "";
  currentStep.value = "pin-confirm";
  nextTick(() => {
    pinInputRef.value?.clear();
    pinInputRef.value?.focus();
  });
};

/**
 * Go back to choosing the PIN, keeping the phrase.
 *
 * See AddWalletView: confirming a PIN you have already forgotten cannot be
 * solved by retyping, and the unlabelled arrow was not read as a way out.
 */
function restartPinChoice() {
  pin.value = "";
  pinConfirm.value = "";
  pinError.value = "";
  currentStep.value = "pin-create";
  nextTick(() => {
    pinInputRef.value?.clear();
    pinInputRef.value?.focus();
  });
}

// Handle PIN confirmation
const handlePinConfirm = async (enteredPin: string) => {
  if (enteredPin !== pin.value) {
    pinError.value = "PINs do not match";
    // Empty the field, or the keypad stops answering. PinInput writes into
    // the first free slot, and with all six full there is none: every key
    // is dropped by its own guard and nothing on screen moves. Telling
    // someone to try again on a control that has quietly died is how this
    // step became a dead end halfway through an import.
    nextTick(() => {
      pinInputRef.value?.clear();
      pinInputRef.value?.focus();
    });
    return;
  }

  pinError.value = "";
  isLoading.value = true;

  try {
    // Encrypt mnemonic with PIN
    const encryptedData = await encryptWithPIN(mnemonic.value, pin.value);

    // Save encrypted wallet
    const wallet = await sessionManager.saveEncryptedWalletAsync(encryptedData);

    // DenLabs: Emit wallet created or imported event
    if (isImportedWallet.value) {
      emitWalletImported(wallet.id);
    } else {
      emitWalletCreated(wallet.id);
    }

    // Unlock session
    await sessionManager.unlock(pin.value);

    secureLog("Wallet created and encrypted");

    // Clear sensitive data from memory
    mnemonic.value = "";
    pin.value = "";
    pinConfirm.value = "";

    // Navigate to user page
    router.push({ path: "/user" });
  } catch (error) {
    pinError.value = "Failed to create wallet";
    secureLog("Wallet creation failed", error);
  } finally {
    isLoading.value = false;
  }
};

// Go back to previous step
function handleBack() {
  pinError.value = "";

  switch (currentStep.value) {
    case "mnemonic":
      mnemonic.value = "";
      currentStep.value = "start";
      break;
    case "verify":
      currentStep.value = "mnemonic";
      break;
    case "pin-create":
      pin.value = "";
      currentStep.value = "verify";
      break;
    case "pin-confirm":
      pinConfirm.value = "";
      currentStep.value = "pin-create";
      nextTick(() => {
        pinInputRef.value?.clear();
        pinInputRef.value?.focus();
      });
      break;
  }
}

onBeforeMount(() => {
  // Check if user already has a wallet
  if (sessionManager.hasWallet) {
    router.push({ path: "/unlock" });
  }
});
</script>

<template>
  <!-- V54.9: PIN steps use PinScreenShell for cohesion -->
  <PinScreenShell
    v-if="isPinStep"
    :title="pinScreenConfig.title"
    :subtitle="pinScreenConfig.subtitle"
    :eyebrow="pinScreenConfig.eyebrow"
    :show-logo="true"
    :show-ambient="true"
    :show-back="true"
    data-roi="start-pin-shell"
    @back="handleBack"
  >
    <PinInput
      ref="pinInputRef"
      :mode="currentStep === 'pin-create' ? 'create' : 'confirm'"
      :error="pinError"
      :disabled="isLoading"
      :helper-text="currentStep === 'pin-create' ? 'Don\'t reuse a PIN you use elsewhere.' : undefined"
      hide-label
      @complete="currentStep === 'pin-create' ? handlePinCreate($event) : handlePinConfirm($event)"
    />

    <!--
      A way out that says what it does. Retyping only helps someone who
      remembers the first PIN; the trap is confirming one already
      forgotten, and the only control on offer was an unlabelled arrow in
      the corner that means "leave" everywhere else in the app. So the
      wallet was built, the phrase was written down, and it could not be
      added: words that were safe and worthless.
    -->
    <template #actions>
      <button
        v-if="currentStep === 'pin-confirm'"
        type="button"
        class="pin-start-over"
        data-roi="pin-start-over"
        @click="restartPinChoice"
      >
        Choose a different PIN
      </button>
    </template>

    <template #loading>
      <p v-if="isLoading" class="loading-text">Creating wallet...</p>
    </template>
  </PinScreenShell>

  <!-- Non-PIN steps use ScreenShell + AppHeader -->
  <ScreenShell v-else :padded="false" data-roi="start-screen">
    <!-- V53: Header only shown on steps after 'start' -->
    <template v-if="headerConfig.showHeader" #header>
      <AppHeader
        :title="headerConfig.title"
        :left="headerConfig.left"
        @left-click="handleBack"
      />
    </template>

    <div class="start-view" data-roi="start-view-root">
      <!-- V53: Ambient glow wrapper - clips oversized glow -->
      <div class="ambient-wrapper">
        <div class="ambient-glow"></div>
      </div>

      <!-- Step 1: Start (Hero landing) -->
      <div v-if="currentStep === 'start'" class="start-content" data-roi="start-hero">
        <!-- V55.1: Hero logo (72px scale) -->
        <div class="logo-container" data-roi="start-hero-logo">
          <div class="logo-glow"></div>
          <div class="logo-box">
            <img src="/denvault-i.png" alt="DenVault" class="logo-image" />
          </div>
        </div>

        <!-- Text -->
        <div class="text-section">
          <h1 class="title">Set Up Your Wallet</h1>
          <p class="subtitle">
            Securely store your Stacks (STX) and Bitcoin (BTC).
          </p>
        </div>

        <!-- Actions -->
        <div class="actions" data-roi="start-cta-rail">
          <Button
            variant="primary"
            size="lg"
            full-width
            data-roi="start-primary-cta"
            @click="handleGenerateSecret"
          >
            Create New Wallet
          </Button>

          <Button
            variant="secondary"
            size="lg"
            full-width
            data-roi="start-secondary-cta"
            @click="handleImportMnemonic"
          >
            Import Existing Wallet
          </Button>

          <!--
            The third door. Export writes an encrypted file and Settings
            reads it back, but Settings needs an open wallet, so the file
            was unusable in the only situation that produces it: no wallet
            on this device. See handleBackupFileSelected.
          -->
          <Button
            variant="ghost"
            size="lg"
            full-width
            data-roi="start-restore-cta"
            @click="handleRestoreBackup"
          >
            Restore from Backup File
          </Button>

          <!--
            Said here, where the decision is made. An encrypted backup is
            worth exactly what its credential is worth, and someone who
            keeps the file believing it is enough on its own finds out at
            the worst possible moment. The recovery phrase is the copy that
            depends on nothing.
          -->
          <p class="restore-note" data-roi="start-restore-note">
            A backup file opens with the PIN it was made with. Forget that PIN and only your
            recovery phrase can bring the wallet back.
          </p>

          <input
            ref="restoreInputRef"
            type="file"
            accept="application/json,.json"
            class="visually-hidden"
            data-roi="start-restore-input"
            @change="handleBackupFileSelected"
          />

          <!-- V53: Error with reserved slot (no layout shift) -->
          <div class="error-slot" aria-live="polite">
            <p v-if="importError" class="error-text">{{ importError }}</p>
          </div>

          <!--
            Security Badge

            Said "END-TO-END ENCRYPTED", which describes a channel between two
            parties. There is no channel here: the mnemonic is encrypted at
            rest on this machine with AES-256-GCM and a PBKDF2 key derived
            from the PIN, and it never goes anywhere. Claiming the wrong
            property is a poor trade when the true one is the stronger
            argument for a wallet, and it is the first security claim a new
            user reads.
          -->
          <div class="security-badge">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span>ENCRYPTED ON THIS DEVICE</span>
          </div>
        </div>
      </div>

      <!-- V54.2: Step 2: Show Mnemonic (header back handles navigation) -->
      <div v-else-if="currentStep === 'mnemonic'" class="mnemonic-content" data-roi="mnemonic-step">
        <RecoveryPhraseDisplay
          :mnemonic="mnemonic"
          @continue="handleContinueToVerify"
        />
      </div>

      <!-- V54.3: Step 3: Verification (header back handles navigation) -->
      <div v-else-if="currentStep === 'verify'" class="verify-content" data-roi="verify-step">
        <VerifyPhraseStep
          :mnemonic="mnemonic"
          :word1-index="verifyWord1Index"
          :word2-index="verifyWord2Index"
          @verified="handleVerified"
        />
      </div>
    </div>

    <!-- V76: Import now uses dedicated page /import-recovery -->
  </ScreenShell>
</template>

<style scoped>
/* V53: Main container - flex within ScreenShell */
.start-view {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  position: relative;
  /* V53: NO overflow:hidden hack - use ambient-wrapper clipping */
}

/* V53: Ambient glow wrapper - clips oversized glow (same as ConfirmTxView) */
.ambient-wrapper {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 0;
}

/* V53: Ambient glow - contained within wrapper */
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
}

/* Start Content */
.start-content {
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

/* V55.1: Hero Logo - 72px scale (was 96px) */
.logo-container {
  position: relative;
}

.logo-glow {
  position: absolute;
  /* V55.1: Proportional glow for 72px logo */
  inset: -12px;
  background: var(--color-mark-glow);
  opacity: 0.22;
  filter: blur(28px);
  border-radius: 50%;
  transition: opacity 0.5s ease;
}

.logo-container:hover .logo-glow {
  opacity: 0.4;
}

.logo-box {
  position: relative;
  /* V55.1: 72px hero (was 96px) */
  width: 72px;
  height: 72px;
  border-radius: 20px;
  background: linear-gradient(
    135deg,
    var(--color-mark-plate-from),
    var(--color-mark-plate-to)
  );
  border: 1px solid rgba(255, 255, 255, 0.05);
  box-shadow: var(--shadow-elev-2);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-image {
  /* V55.1: 56px image (was 72px) */
  width: 56px;
  height: 56px;
  border-radius: 14px;
  object-fit: cover;
}

/* Text Section */
.text-section {
  text-align: center;
  max-width: 320px;
}

.title {
  font-size: var(--font-size-3xl);
  font-weight: 600;
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0 0 var(--space-sm);
}

.subtitle {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

/* Actions */
.actions {
  width: 100%;
  max-width: 320px;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

/* CTA Wrapper */
.cta-wrapper {
  margin-top: auto;
  width: 100%;
}

/* Security Badge */
.security-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-sm);
  margin-top: var(--space-lg);
  opacity: 0.5;
  color: var(--color-text-primary);
}

.security-badge span {
  font-size: var(--font-size-2xs);
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* V53: Error slot - reserved height for no layout shift */
/* A text action, not a button: it competes with nothing and reads as the
   sentence it is. */
.pin-start-over {
  background: none;
  border: none;
  padding: var(--space-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}

.pin-start-over:hover {
  color: var(--color-text-primary);
}

.error-slot {
  min-height: 20px; /* Reserved for error text */
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Error Text */
.restore-note {
  margin: 0;
  padding: 0 var(--space-xs);
  font-size: var(--font-size-xs);
  line-height: 1.4;
  text-align: center;
  color: var(--color-text-muted);
}

/* Kept in the layout for a label, out of it for the eye. The button is
   the control; this input only carries the file picker. */
.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.error-text {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
}

/* V53.2: Mnemonic Content - container for shared component */
.mnemonic-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  position: relative;
  z-index: 1;
}

/* V53.2: Verify Content - container for shared component */
.verify-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--space-lg);
  position: relative;
  z-index: 1;
}

/* V54.9: Loading text for PIN shell */
.loading-text {
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
  text-align: center;
  margin: 0;
  padding: var(--space-sm);
}
</style>
