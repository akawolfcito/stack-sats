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
  router.push(path);
}

function handleReceive() {
  emit("openReceive");
}

function isActive(path: string): boolean {
  return currentPath.value === path;
}
</script>

<template>
  <nav class="bottom-nav">
    <!-- Home -->
    <button
      class="nav-item"
      :class="{ 'nav-item--active': isActive('/user') }"
      @click="navigate('/user')"
      title="Home"
    >
      <span class="nav-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.5">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
      </span>
      <span class="nav-label">Home</span>
    </button>

    <!-- Swap -->
    <button
      class="nav-item"
      :class="{ 'nav-item--active': isActive('/swap') }"
      @click="navigate('/swap')"
      title="Swap"
    >
      <span class="nav-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.5">
          <path d="M16 3l4 4-4 4"/>
          <path d="M20 7H4"/>
          <path d="M8 21l-4-4 4-4"/>
          <path d="M4 17h16"/>
        </svg>
      </span>
      <span class="nav-label">Swap</span>
    </button>

    <!-- Central QR Button -->
    <div class="qr-button-wrapper">
      <button class="qr-button" @click="handleReceive" title="Scan QR">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" rx="1"/>
          <rect x="14" y="3" width="7" height="7" rx="1"/>
          <rect x="3" y="14" width="7" height="7" rx="1"/>
          <rect x="14" y="14" width="3" height="3"/>
          <rect x="18" y="14" width="3" height="3"/>
          <rect x="14" y="18" width="3" height="3"/>
          <rect x="18" y="18" width="3" height="3"/>
        </svg>
      </button>
    </div>

    <!-- Earn -->
    <button
      class="nav-item"
      :class="{ 'nav-item--active': isActive('/earn') }"
      @click="navigate('/swap')"
      title="Earn"
    >
      <span class="nav-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.5">
          <path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 5 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2h2v-4h-2c0-1-.5-1.5-1-2"/>
          <path d="M2 9v1c0 1.1.9 2 2 2h1"/>
          <circle cx="16" cy="11" r="1"/>
        </svg>
      </span>
      <span class="nav-label">Earn</span>
    </button>

    <!-- Activity -->
    <button
      class="nav-item"
      :class="{ 'nav-item--active': isActive('/activity') }"
      @click="navigate('/user')"
      title="Activity"
    >
      <span class="nav-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"/>
          <polyline points="12 6 12 12 16 14"/>
        </svg>
      </span>
      <span class="nav-label">Activity</span>
    </button>
  </nav>
</template>

<style scoped>
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 90px;
  background: rgba(26, 26, 26, 0.9);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 32px 32px 0 0;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 24px 0;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  z-index: 1000;
}

/* Nav Item */
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 48px;
  padding: 0;
  background: transparent;
  border: none;
  cursor: pointer;
  color: #6b7280;
  transition: all 0.2s ease;
}

.nav-item:hover {
  color: var(--color-text-primary);
}

.nav-item--active {
  color: var(--color-accent-primary);
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
}

.nav-item:hover .nav-icon {
  transform: scale(1.1);
}

.nav-label {
  font-size: 10px;
  font-weight: 500;
}

/* Central QR Button */
.qr-button-wrapper {
  position: relative;
  top: -40px;
}

.qr-button {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--color-accent-primary);
  border: 4px solid #0a0a0a;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #0a0a0a;
  box-shadow: 0 0 20px rgba(232, 248, 89, 0.4);
  transition: all 0.2s ease;
}

.qr-button:hover {
  transform: scale(1.05);
  box-shadow: 0 0 30px rgba(232, 248, 89, 0.5);
}

.qr-button:active {
  transform: scale(0.95);
}
</style>
