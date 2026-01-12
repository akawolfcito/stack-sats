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
/* V43: Pill segmented control - iOS-style premium */
.minimal-tabs {
  display: flex;
  position: relative;
  height: 36px; /* V43: Compact pill height */
  background: rgba(255, 255, 255, 0.06); /* V43: Recessed container */
  border: none;
  border-radius: var(--radius-pill); /* V43: Full pill shape */
  padding: 3px; /* V43: Inner padding for thumb */
  gap: 0; /* V43: No gap - tabs fill container */
}

/* V43: Sliding thumb behind active tab */
.tab-underline {
  position: absolute;
  top: 3px;
  bottom: 3px;
  background: rgba(255, 255, 255, 0.12); /* V43: Elevated thumb surface */
  border-radius: calc(var(--radius-pill) - 2px);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  pointer-events: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15); /* V43: Subtle depth */
}

.tab-item {
  position: relative;
  z-index: 1;
  flex: 1; /* V43: Equal width tabs */
  height: 100%;
  padding: 0 var(--space-md);
  background: transparent;
  border: none;
  border-radius: calc(var(--radius-pill) - 2px);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
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
  font-weight: var(--font-weight-semibold);
}
</style>
