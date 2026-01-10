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
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 2px;
}

.tab-indicator {
  position: absolute;
  top: 3px;
  left: 3px;
  bottom: 3px;
  background: var(--color-accent-primary);
  border-radius: calc(var(--radius-md) - 2px);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.tab-item {
  flex: 1;
  position: relative;
  z-index: 1;
  height: 36px;
  padding: 0 var(--space-lg);
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-md) - 2px);
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

.tab-item--active {
  color: #0a0a0a;
}
</style>
