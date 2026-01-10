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
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-lg);
  padding: var(--space-xs);
  gap: var(--space-xs);
}

.tab-indicator {
  position: absolute;
  top: var(--space-xs);
  left: var(--space-xs);
  bottom: var(--space-xs);
  background: rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  transition: transform 0.2s ease;
  pointer-events: none;
}

.tab-item {
  flex: 1;
  position: relative;
  z-index: 1;
  padding: var(--space-sm) var(--space-lg);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.2s ease;
}

.tab-item:hover {
  color: var(--color-text-secondary);
}

.tab-item--active {
  color: var(--color-text-primary);
}
</style>
