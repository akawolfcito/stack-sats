<script setup lang="ts">
defineProps<{
  /** Page title */
  title: string;
  /** Left button type */
  left?: "back" | "menu" | "none";
  /** Header style variant */
  variant?: "default" | "modal";
}>();

const emit = defineEmits<{
  leftClick: [];
}>();

function handleLeftClick() {
  emit("leftClick");
}
</script>

<template>
  <div
    class="app-header"
    :class="{
      'app-header--modal': variant === 'modal',
    }"
  >
    <!-- Left Button -->
    <button
      v-if="left !== 'none'"
      class="header-btn header-btn--left"
      @click="handleLeftClick"
    >
      <!-- Back Arrow -->
      <svg
        v-if="left === 'back' || left === undefined"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      <!-- Menu Icon -->
      <svg
        v-else-if="left === 'menu'"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
    <div v-else class="header-spacer"></div>

    <!-- Title -->
    <div class="header-center">
      <h1 class="header-title">{{ title }}</h1>
      <slot name="subtitle" />
    </div>

    <!-- Right Actions -->
    <div class="header-right">
      <slot name="right">
        <div class="header-spacer"></div>
      </slot>
    </div>
  </div>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-sm);
  padding: var(--space-sm) var(--card-pad-x);
  min-height: var(--header-h);
  background: var(--color-bg-primary);
}

.app-header--modal {
  background: transparent;
}

/* Left Button - Reset global button styles */
.header-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: var(--icon-btn-size);
  min-width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  padding: 0;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  cursor: pointer;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.header-btn svg {
  width: var(--icon-size-md);
  height: var(--icon-size-md);
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-accent-primary);
}

.header-btn:active {
  transform: scale(0.95);
}

/* Center */
.header-center {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  text-align: center;
}

.header-title {
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

/* Right */
.header-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-shrink: 0;
}

/* Spacer for alignment */
.header-spacer {
  width: var(--icon-btn-size);
  height: var(--icon-btn-size);
  flex-shrink: 0;
}
</style>
