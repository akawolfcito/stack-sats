<script setup lang="ts">
/**
 * RecoveryPhraseView - see the recovery phrase again, after the PIN.
 *
 * Until this screen existed the phrase was shown once, during wallet
 * creation, and never again. The only thing the settings menu offered
 * afterwards was an encrypted JSON backup, which restores solely through
 * DenVault and solely with the PIN. So a user who lost their paper copy, or
 * forgot the PIN, or simply outlived the extension's presence in the store,
 * had no way back to their own funds. That is not what self-custody means.
 *
 * Reaching this screen costs a PIN every single time. The grant that allows
 * it is issued by VerifyPinView, lives in memory, and is spent on arrival, so
 * neither an unlocked session nor a typed URL is enough. See utils/recovery/grant.
 *
 * It also states the derivation path, because the phrase alone does not
 * actually recover the bitcoin in a standard Bitcoin wallet.
 */
import { ref, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import RecoveryPhraseDisplay from "@/components/RecoveryPhraseDisplay.vue";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";
import { sessionManager } from "@/utils/security/session";
import { consumeReveal, clearReveal } from "@/utils/recovery/grant";
import { STACKS_DERIVATION_PREFIX } from "@/utils/accounts";
import { secureLog } from "@/utils/security/logger";

const router = useRouter();

const mnemonic = ref("");

const derivationPath = `${STACKS_DERIVATION_PREFIX}/{index}`;

function leave() {
  // Do not leave the phrase sitting in a component that a back navigation
  // could bring back into view.
  mnemonic.value = "";
  clearReveal();
  router.push("/usermenu");
}

onMounted(() => {
  if (!consumeReveal()) {
    // No PIN was entered for this visit. Says nothing about why.
    secureLog("Recovery phrase reveal refused: no grant");
    router.replace("/usermenu");
    return;
  }

  const phrase = sessionManager.getMnemonic();
  if (!phrase) {
    secureLog("Recovery phrase reveal refused: no mnemonic in session");
    router.replace("/usermenu");
    return;
  }

  mnemonic.value = phrase;
});

onBeforeUnmount(() => {
  mnemonic.value = "";
  clearReveal();
});
</script>

<template>
  <ScreenShell :padded="false" data-roi="recovery-phrase-screen">
    <template #header>
      <AppHeader
        title="Recovery Phrase"
        left="back"
        data-roi="recovery-phrase-title"
        @left-click="leave"
      />
    </template>

    <main v-if="mnemonic" class="content">
      <p class="warning" data-roi="recovery-phrase-warning">
        Anyone who reads these words owns this wallet. Write them on paper and
        keep them offline. Never type them into a website or share them with
        support.
      </p>

      <RecoveryPhraseDisplay
        :mnemonic="mnemonic"
        cta-label="Done"
        @continue="leave"
      />

      <section class="derivation" data-roi="recovery-phrase-derivation">
        <h2 class="derivation-title">Derivation path</h2>
        <p class="derivation-path">{{ derivationPath }}</p>
        <p class="derivation-note">
          Your Bitcoin addresses come from this Stacks path, not from the usual
          Bitcoin ones. To restore your bitcoin in another wallet, enter this
          path there: with default settings it will scan elsewhere and show an
          empty balance. Your Stacks accounts restore normally.
        </p>
      </section>
    </main>
  </ScreenShell>
</template>

<style scoped>
.content {
  padding: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}

.warning {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: 1.5;
  color: var(--color-text-secondary);
}

.derivation {
  border-top: 1px solid var(--color-border-subtle, rgba(255, 255, 255, 0.08));
  padding-top: var(--space-md);
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.derivation-title {
  margin: 0;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}

.derivation-path {
  margin: 0;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  word-break: break-all;
}

.derivation-note {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
