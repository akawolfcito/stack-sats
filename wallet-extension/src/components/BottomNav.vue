<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";

const emit = defineEmits<{
  (e: "openReceive"): void;
}>();

const route = useRoute();
const router = useRouter();

const currentPath = computed(() => route.path);

function navigate(path: string) {
  if (path === "/swap" || path === "/activity") {
    // Coming soon - these routes don't exist yet
    return;
  }
  router.push(path);
}

function handleReceive() {
  emit("openReceive");
}

function isActive(path: string): boolean {
  return currentPath.value === path;
}

function isDisabled(path: string): boolean {
  return path === "/swap" || path === "/activity";
}
</script>

<template>
  <nav class="bottom-nav">
    <!-- Wallet -->
    <button
      class="nav-item"
      :class="{ active: isActive('/user') }"
      @click="navigate('/user')"
      title="Wallet"
    >
      <div class="nav-icon-wrapper">
        <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M2 9h20" stroke="currentColor" stroke-width="1.5"/>
          <rect x="14" y="12" width="4" height="3" rx="0.5" fill="currentColor" class="wallet-accent"/>
        </svg>
      </div>
      <span class="nav-label">Wallet</span>
    </button>

    <!-- Swap -->
    <button
      class="nav-item"
      :class="{ disabled: isDisabled('/swap') }"
      @click="navigate('/swap')"
      title="Coming soon"
    >
      <div class="nav-icon-wrapper">
        <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M7 4v16M7 4l-4 4M7 4l4 4"/>
          <path d="M17 20V4M17 20l-4-4M17 20l4-4"/>
        </svg>
      </div>
      <span class="nav-label">Swap</span>
    </button>

    <!-- QR / Receive (Center Button) -->
    <button
      class="nav-item center-btn"
      @click="handleReceive"
      title="Receive"
    >
      <div class="qr-btn-container">
        <svg class="qr-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="3" height="3"/>
          <rect x="18" y="14" width="3" height="3"/>
          <rect x="14" y="18" width="3" height="3"/>
          <rect x="18" y="18" width="3" height="3"/>
        </svg>
      </div>
    </button>

    <!-- Activity -->
    <button
      class="nav-item"
      :class="{ disabled: isDisabled('/activity') }"
      @click="navigate('/activity')"
      title="Coming soon"
    >
      <div class="nav-icon-wrapper">
        <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M7 14v3"/>
          <path d="M12 10v7"/>
          <path d="M17 7v10"/>
        </svg>
      </div>
      <span class="nav-label">Activity</span>
    </button>

    <!-- Settings -->
    <button
      class="nav-item"
      :class="{ active: isActive('/usermenu') }"
      @click="navigate('/usermenu')"
      title="Settings"
    >
      <div class="nav-icon-wrapper">
        <svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </div>
      <span class="nav-label">Settings</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  background: var(--color-bg-primary);
  border-top: 1px solid var(--color-border);
  padding: var(--space-sm) var(--space-xs);
  padding-bottom: calc(var(--space-sm) + env(safe-area-inset-bottom, 0px));
  z-index: 1000;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: var(--space-xs);
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all var(--transition-fast);
  min-width: 52px;
  width: auto;
}

.nav-item:hover:not(.disabled):not(.center-btn) {
  color: var(--color-text-secondary);
}

.nav-item.active {
  color: var(--color-accent-primary);
}

.nav-item.active .wallet-accent {
  fill: var(--color-accent-primary);
}

.nav-item.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.nav-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 28px;
}

.nav-icon {
  width: 24px;
  height: 24px;
  transition: all var(--transition-fast);
}

.nav-label {
  font-size: 10px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.3px;
}

/* Center QR/Receive Button */
.nav-item.center-btn {
  position: relative;
  padding: 0;
  margin-top: -28px;
}

.qr-btn-container {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: var(--color-accent-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(190, 242, 100, 0.35);
  transition: all var(--transition-fast);
  border: 3px solid var(--color-bg-primary);
}

.nav-item.center-btn:hover .qr-btn-container {
  transform: scale(1.08);
  box-shadow: 0 6px 24px rgba(190, 242, 100, 0.5);
}

.nav-item.center-btn:active .qr-btn-container {
  transform: scale(0.95);
}

.qr-icon {
  width: 28px;
  height: 28px;
  color: var(--color-bg-primary);
  stroke-width: 2;
}
</style>
