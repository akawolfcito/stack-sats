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
      <!--
        Three rules, one per line. This was a paragraph opening with
        "Anyone who reads these words owns this wallet", which is what the
        warning card below already says: two warnings saying the same thing,
        stacked, before anything you could act on. What the card does not
        carry is what to actually do, so that is all this keeps.
      -->
      <ul class="rules" data-roi="recovery-phrase-warning">
        <li>Write it on paper and keep it offline.</li>
        <li>Never type it into a website.</li>
        <li>Support will never ask for it.</li>
      </ul>

      <RecoveryPhraseDisplay
        :mnemonic="mnemonic"
        cta-label="Done"
        @continue="leave"
      />

      <!--
        The path used to be followed by five lines of prose. Same facts, but
        the part that decides whether someone gets their bitcoin back was
        buried mid sentence. Split by chain, because the answer differs by
        chain and that is the whole point of saying it.
      -->
      <section class="derivation" data-roi="recovery-phrase-derivation">
        <h2 class="derivation-title">Derivation path</h2>
        <p class="derivation-path">{{ derivationPath }}</p>
        <dl class="chains">
          <div class="chain">
            <dt>Stacks</dt>
            <dd>Restores anywhere, with no setup.</dd>
          </div>
          <div class="chain">
            <dt>Bitcoin</dt>
            <dd>
              Enter this path in the other wallet. Its own default scans
              elsewhere and reports an empty balance.
            </dd>
          </div>
        </dl>
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

.rules {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.rules li {
  position: relative;
  padding-left: var(--space-md);
  font-size: var(--font-size-sm);
  line-height: 1.4;
  color: var(--color-text-secondary);
}

/* A marker, not a bullet glyph: the line should read as a rule. */
.rules li::before {
  content: "";
  position: absolute;
  left: 0;
  top: 0.55em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--color-text-muted);
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

.chains {
  margin: var(--space-xs) 0 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.chain {
  display: grid;
  grid-template-columns: 4.5rem 1fr;
  gap: var(--space-sm);
  align-items: baseline;
}

.chain dt {
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.chain dd {
  margin: 0;
  font-size: var(--font-size-xs);
  line-height: 1.5;
  color: var(--color-text-secondary);
}
</style>
