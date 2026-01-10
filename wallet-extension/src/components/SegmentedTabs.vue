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
  <div class="segmented-tabs">
    <div
      class="tab-indicator"
      :style="{
        transform: `translateX(${activeIndex * 100}%)`,
        width: `${100 / items.length}%`
      }"
    ></div>
    <button
      v-for="item in items"
      :key="item.key"
      class="tab-item"
      :class="{ 'tab-item--active': item.key === modelValue }"
      @click="selectTab(item.key)"
    >
      {{ item.label }}
    </button>
  </div>
</template>

<style scoped>
.segmented-tabs {
  display: flex;
  position: relative;
  background: var(--surface-1);
  border: var(--border-subtle);
  border-radius: var(--radius-control);
  padding: 4px;
  gap: 2px;
}

.tab-indicator {
  position: absolute;
  top: 4px;
  left: 4px;
  bottom: 4px;
  /* Pro surface with subtle border */
  background: var(--surface-2);
  border: 1px solid var(--color-border);
  border-radius: calc(var(--radius-control) - 4px);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.tab-item {
  flex: 1;
  position: relative;
  z-index: 1;
  height: calc(var(--row-h) - 8px);
  padding: 0 var(--space-lg);
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-control) - 4px);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.tab-item:hover:not(.tab-item--active) {
  color: var(--color-text-secondary);
}

.tab-item:focus-visible {
  outline: 2px solid var(--color-accent-primary);
  outline-offset: 2px;
}

.tab-item--active {
  color: var(--color-text-primary);
}
</style>
