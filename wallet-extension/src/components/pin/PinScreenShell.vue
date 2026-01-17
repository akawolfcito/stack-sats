<script setup lang="ts">
/**
 * PinScreenShell - V54.8 PIN Premium Cohesion Pass
 *
 * Shared layout shell for all PIN screens (Unlock, Create, Verify).
 * Enforces consistent structure and spacing aligned with Recovery/Verify system.
 *
 * V54.8 Changes:
 * - Unified max-width (280px) for tight visual anchor
 * - Consistent padding-inline and gap rhythm
 * - Subtle glass container for content zone (depth without weight)
 *
 * Structure:
 * - Compact title + optional subtitle
 * - PIN dots capsule (the single premium surface)
 * - Optional helper text
 * - Keypad (ghost-premium)
 * - Secondary actions row
 *
 * Props:
 * - title: Screen title (e.g., "Welcome Back", "Create PIN")
 * - subtitle: Optional one-line subtitle
 * - showLogo: Whether to show compact brand mark (default: true for Unlock)
 * - showAmbient: Whether to show ambient glow (default: true)
 */
defineProps<{
  title: string;
  subtitle?: string;
  showLogo?: boolean;
  showAmbient?: boolean;
}>();
</script>

<template>
  <section class="pin-screen-shell" data-roi="pin-screen-shell">
    <!-- V54.7: Ambient glow - subtle, optional -->
    <div v-if="showAmbient !== false" class="ambient-glow"></div>

    <!-- V54.7: Compact header -->
    <header class="pin-header" data-roi="pin-header">
      <!-- Optional compact logo -->
      <div v-if="showLogo" class="logo-container">
        <div class="logo-glow"></div>
        <div class="logo-box">
          <img src="/denvault-i.png" alt="DenVault" class="logo-image" />
        </div>
      </div>

      <!-- Title - compact, not oversized -->
      <h1 class="pin-title">{{ title }}</h1>

      <!-- Optional subtitle -->
      <p v-if="subtitle" class="pin-subtitle">{{ subtitle }}</p>
    </header>

    <!-- V54.7: Main content slot (PinInput goes here) -->
    <main class="pin-main">
      <slot></slot>
    </main>

    <!-- V54.7: Secondary actions slot (Forgot PIN, Cancel, etc.) -->
    <footer v-if="$slots.actions" class="pin-actions" data-roi="pin-actions">
      <slot name="actions"></slot>
    </footer>

    <!-- Loading slot (optional) -->
    <slot name="loading"></slot>
  </section>
</template>

<style scoped>
/* V54.8: Shell container - full viewport, flex column */
.pin-screen-shell {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100%;
  background: var(--color-bg-primary);
  position: relative;
  overflow: hidden;
  /* V54.8: Consistent padding for visual anchor */
  padding: 0 var(--space-lg);
}

/* V54.8: Ambient glow - subtle accent, perceptible */
.ambient-glow {
  position: absolute;
  top: -25%;
  left: 50%;
  transform: translateX(-50%);
  width: 140%;
  height: 50%;
  background: var(--color-accent-primary);
  opacity: 0.06;
  filter: blur(80px);
  border-radius: 50%;
  pointer-events: none;
}

/* V54.8: Compact header - centered, constrained width */
.pin-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--space-lg) 0 var(--space-md);
  gap: var(--space-xs);
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 280px;
}

/* V54.8: Compact logo - 40px, refined glow */
.logo-container {
  position: relative;
  margin-bottom: var(--space-xs);
}

.logo-glow {
  position: absolute;
  inset: -10px;
  background: var(--color-accent-primary);
  opacity: 0.2;
  filter: blur(20px);
  border-radius: 50%;
}

.logo-box {
  position: relative;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2a2d15, #1a1c0d);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-image {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  object-fit: cover;
}

/* V54.8: Title - prominent but not oversized */
.pin-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  letter-spacing: -0.02em;
  margin: 0;
  text-align: center;
}

/* V54.8: Subtitle - secondary text, one line max */
.pin-subtitle {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  text-align: center;
  line-height: 1.4;
}

/* V54.8: Main content area - constrained width for rhythm */
.pin-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 280px;
  position: relative;
  z-index: 10;
  min-height: 0;
}

/* V54.8: Actions footer - secondary links/buttons */
.pin-actions {
  display: flex;
  justify-content: center;
  padding: var(--space-sm) 0 var(--space-lg);
  position: relative;
  z-index: 10;
  width: 100%;
  max-width: 280px;
}
</style>
