<script setup lang="ts">
import { computed } from 'vue'

interface TabItem {
  key: string
  label: string
}

const props = defineProps<{
  items: TabItem[]
  modelValue: string
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
}>()

const activeIndex = computed(() =>
  props.items.findIndex(item => item.key === props.modelValue)
)

function selectTab(key: string) {
  emit('update:modelValue', key)
}
</script>

<template>
  <div class="minimal-tabs">
    <button
      v-for="item in items"
      :key="item.key"
      class="tab-item"
      :class="{ 'tab-item--active': item.key === modelValue }"
      @click="selectTab(item.key)"
    >
      {{ item.label }}
    </button>
    <!-- Underline indicator -->
    <div
      class="tab-underline"
      :style="{
        transform: `translateX(${activeIndex * 100}%)`,
        width: `${100 / items.length}%`
      }"
    ></div>
  </div>
</template>

<style scoped>
/* Premium Minimal Tabs (V27) */
.minimal-tabs {
  display: flex;
  position: relative;
  height: var(--control-h); /* Density-aware hit area */
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border);
  gap: 0;
}

/* Underline indicator - clean, no glow (V27) */
.tab-underline {
  position: absolute;
  bottom: -1px;
  left: 0;
  height: 2px;
  background: var(--color-text-primary); /* Neutral underline, not lime */
  border-radius: 0; /* Sharp edges for premium look */
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  /* No shadow, no glow */
}

.tab-item {
  flex: 1;
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 0 var(--space-lg);
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: var(--font-size-sm);
  font-weight: 500; /* Inactive: 500 */
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.tab-item:hover:not(.tab-item--active) {
  color: var(--color-text-secondary);
}

.tab-item:focus-visible {
  outline: var(--focus-ring);
  outline-offset: -2px;
}

.tab-item--active {
  color: var(--color-text-primary);
  font-weight: 600; /* Active: 600 */
}
</style>
