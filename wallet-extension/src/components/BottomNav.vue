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
  <nav class="fixed bottom-0 left-0 right-0 flex items-end justify-around bg-bg-primary border-t border-border-default py-2 px-1 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] z-[1000]">
    <!-- Wallet -->
    <button
      class="flex flex-col items-center gap-1 p-1 bg-transparent border-none cursor-pointer text-text-muted transition-all duration-150 min-w-[52px] w-auto hover:text-text-secondary"
      :class="{ 'text-primary': isActive('/user') }"
      @click="navigate('/user')"
      title="Wallet"
    >
      <div class="flex items-center justify-center h-7">
        <svg class="w-6 h-6 transition-all duration-150" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="5" width="20" height="15" rx="2" stroke="currentColor" stroke-width="1.5"/>
          <path d="M2 9h20" stroke="currentColor" stroke-width="1.5"/>
          <rect x="14" y="12" width="4" height="3" rx="0.5" fill="currentColor" :class="{ 'fill-primary': isActive('/user') }"/>
        </svg>
      </div>
      <span class="text-[10px] font-medium tracking-wide">Wallet</span>
    </button>

    <!-- Swap -->
    <button
      class="flex flex-col items-center gap-1 p-1 bg-transparent border-none text-text-muted transition-all duration-150 min-w-[52px] w-auto"
      :class="{ 'opacity-35 cursor-not-allowed': isDisabled('/swap'), 'cursor-pointer hover:text-text-secondary': !isDisabled('/swap') }"
      @click="navigate('/swap')"
      title="Coming soon"
    >
      <div class="flex items-center justify-center h-7">
        <svg class="w-6 h-6 transition-all duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M7 4v16M7 4l-4 4M7 4l4 4"/>
          <path d="M17 20V4M17 20l-4-4M17 20l4-4"/>
        </svg>
      </div>
      <span class="text-[10px] font-medium tracking-wide">Swap</span>
    </button>

    <!-- QR / Receive (Center Button) -->
    <button
      class="relative p-0 -mt-7 bg-transparent border-none cursor-pointer"
      @click="handleReceive"
      title="Receive"
    >
      <div class="w-[60px] h-[60px] rounded-full bg-primary flex items-center justify-center shadow-glow-primary-lg transition-all duration-150 border-[3px] border-bg-primary hover:scale-[1.08] hover:shadow-[0_6px_24px_rgba(232,248,89,0.5)] active:scale-95">
        <svg class="w-7 h-7 text-bg-primary stroke-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
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
      class="flex flex-col items-center gap-1 p-1 bg-transparent border-none text-text-muted transition-all duration-150 min-w-[52px] w-auto"
      :class="{ 'opacity-35 cursor-not-allowed': isDisabled('/activity'), 'cursor-pointer hover:text-text-secondary': !isDisabled('/activity') }"
      @click="navigate('/activity')"
      title="Coming soon"
    >
      <div class="flex items-center justify-center h-7">
        <svg class="w-6 h-6 transition-all duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M7 14v3"/>
          <path d="M12 10v7"/>
          <path d="M17 7v10"/>
        </svg>
      </div>
      <span class="text-[10px] font-medium tracking-wide">Activity</span>
    </button>

    <!-- Settings -->
    <button
      class="flex flex-col items-center gap-1 p-1 bg-transparent border-none cursor-pointer text-text-muted transition-all duration-150 min-w-[52px] w-auto hover:text-text-secondary"
      :class="{ 'text-primary': isActive('/usermenu') }"
      @click="navigate('/usermenu')"
      title="Settings"
    >
      <div class="flex items-center justify-center h-7">
        <svg class="w-6 h-6 transition-all duration-150" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      </div>
      <span class="text-[10px] font-medium tracking-wide">Settings</span>
    </button>
  </nav>
</template>
