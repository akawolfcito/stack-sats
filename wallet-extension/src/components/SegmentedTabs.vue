<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'

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

const tabsRef = ref<HTMLElement | null>(null)
const indicatorStyle = ref({ left: '0px', width: '0px' })

const activeIndex = computed(() =>
  props.items.findIndex(item => item.key === props.modelValue)
)

function selectTab(key: string) {
  emit('update:modelValue', key)
}

// V29: Calculate indicator position based on actual tab element
function updateIndicator() {
  if (!tabsRef.value) return
  const tabs = tabsRef.value.querySelectorAll('.tab-item')
  const activeTab = tabs[activeIndex.value] as HTMLElement
  if (activeTab) {
    const containerRect = tabsRef.value.getBoundingClientRect()
    const tabRect = activeTab.getBoundingClientRect()
    indicatorStyle.value = {
      left: `${tabRect.left - containerRect.left}px`,
      width: `${tabRect.width}px`
    }
  }
}

onMounted(() => {
  nextTick(updateIndicator)
})

watch(activeIndex, () => {
  nextTick(updateIndicator)
})
</script>

<template>
  <div ref="tabsRef" class="minimal-tabs">
    <button
      v-for="item in items"
      :key="item.key"
      class="tab-item"
      :class="{ 'tab-item--active': item.key === modelValue }"
      @click="selectTab(item.key)"
    >
      {{ item.label }}
    </button>
    <!-- V29: Short indicator under active tab only -->
    <div
      class="tab-underline"
      :style="indicatorStyle"
    ></div>
  </div>
</template>

<style scoped>
/* V29 Gold: Text tabs with short indicator */
.minimal-tabs {
  display: flex;
  position: relative;
  height: var(--control-h);
  background: transparent;
  border: none;
  /* V29: Subtle baseline instead of full border */
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  gap: var(--space-lg); /* V29: Gap between tabs, not flex-1 */
  padding: 0 var(--space-xs);
}

/* V29: Short indicator under label only */
.tab-underline {
  position: absolute;
  bottom: -1px;
  height: 2px;
  background: var(--color-text-primary);
  border-radius: 1px; /* V29: Slightly rounded ends */
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
}

.tab-item {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 0 var(--space-sm); /* V29: Tighter padding */
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium); /* V29: 500 inactive */
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  /* V29: No flex-1, natural width */
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
  font-weight: var(--font-weight-semibold); /* V29: 600 active */
}
</style>
