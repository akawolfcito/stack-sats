<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import ScreenShell from "@/components/layout/ScreenShell.vue";
import AppHeader from "@/components/layout/AppHeader.vue";

const router = useRouter();

// Storage key
const NOTIFY_KEY = "swap_notify_enabled";

// State
const notifyEnabled = ref(false);

// Load notification preference
onMounted(() => {
  const stored = localStorage.getItem(NOTIFY_KEY);
  if (stored === "true") {
    notifyEnabled.value = true;
  }
});

// Toggle notification preference
function toggleNotify() {
  notifyEnabled.value = !notifyEnabled.value;
  localStorage.setItem(NOTIFY_KEY, notifyEnabled.value.toString());
}

// Navigation
function handleBack() {
  router.back();
}
</script>

<template>
  <ScreenShell :padded="false">
    <template #header>
      <AppHeader
        title="Swap"
        left="back"
        @left-click="handleBack"
      />
    </template>

    <!-- Main Content -->
    <main class="content">
      <!-- Hero Visual -->
      <div class="hero-container">
        <!-- Glow Effect -->
        <div class="glow-effect"></div>

        <!-- Swap Icon -->
        <div class="icon-container">
          <svg
            class="swap-icon"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M16 3L20 7L16 11"
              stroke="#FFFFFF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M4 7H20"
              stroke="#FFFFFF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M8 21L4 17L8 13"
              stroke="#FFFFFF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M20 17H4"
              stroke="#FFFFFF"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </div>
      </div>

      <!-- Typography -->
      <div class="text-section">
        <h2 class="headline">Swaps are coming</h2>
        <p class="description">
          Direct, peer-to-peer token exchanges are being integrated into Stack-SATs.
        </p>
      </div>

      <!-- Notify Me Card -->
      <div class="notify-card">
        <div class="notify-info">
          <span class="notify-title">Notify Me</span>
          <span class="notify-subtitle">Get alerted when launched</span>
        </div>
        <button
          class="toggle-btn"
          :class="{ active: notifyEnabled }"
          @click="toggleNotify"
          role="switch"
          :aria-checked="notifyEnabled"
        >
          <span class="toggle-knob"></span>
        </button>
      </div>
    </main>
  </ScreenShell>
</template>

<style scoped>
/* Content */
.content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-lg);
  gap: var(--section-gap);
}

/* Hero Visual */
.hero-container {
  position: relative;
  width: 280px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.glow-effect {
  position: absolute;
  inset: 0;
  background: rgba(255, 255, 255, 0.5); /* v17: neutral glow */
  opacity: 0.1;
  filter: blur(60px);
  border-radius: 50%;
  transform: scale(0.8);
  animation: pulse 3s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.15;
    transform: scale(0.8);
  }
  50% {
    opacity: 0.25;
    transform: scale(0.9);
  }
}

.icon-container {
  position: relative;
  z-index: 10;
  width: 160px;
  height: 160px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.swap-icon {
  width: 140px;
  height: 140px;
  color: var(--color-text-secondary); /* v17: neutral icon */
  filter: none;
}

/* Typography */
.text-section {
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
  max-width: 280px;
}

.headline {
  font-size: 1.75rem;
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin: 0;
  letter-spacing: -0.02em;
}

.description {
  font-size: var(--font-size-base);
  color: var(--color-text-muted);
  line-height: 1.6;
  margin: 0;
}

/* Notify Card */
.notify-card {
  width: 100%;
  max-width: 320px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xl);
  padding: var(--space-lg) var(--space-xl);
}

.notify-info {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.notify-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.notify-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
}

/* Toggle Button */
.toggle-btn {
  position: relative;
  width: 52px;
  height: 32px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-pill);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.toggle-btn.active {
  background: var(--color-success); /* v17: success for on state */
  border-color: var(--color-success);
}

.toggle-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 26px;
  height: 26px;
  background: var(--color-text-primary);
  border-radius: 50%;
  transition: transform var(--transition-fast);
}

.toggle-btn.active .toggle-knob {
  transform: translateX(20px);
  background: var(--color-bg-primary);
}
</style>
