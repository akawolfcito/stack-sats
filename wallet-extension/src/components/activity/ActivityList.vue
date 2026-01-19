<script setup lang="ts">
import ActivityRow, { type ActivityStatus } from './ActivityRow.vue'

export interface ActivityItem {
  txId: string
  status: ActivityStatus
  title: string
  subtitle?: string
  amountText?: string
  timeText?: string
  isOutgoing?: boolean
}

defineProps<{
  items: ActivityItem[]
  loading?: boolean
}>()

const emit = defineEmits<{
  (e: 'item-click', txId: string): void
}>()

// Number of skeleton rows to show while loading
const skeletonCount = 4
</script>

<template>
  <div class="activity-list">
    <!-- Loading skeleton -->
    <template v-if="loading">
      <div v-for="i in skeletonCount" :key="`skeleton-${i}`" class="activity-skeleton">
        <div class="activity-skeleton__dot"></div>
        <div class="activity-skeleton__content">
          <div class="activity-skeleton__title"></div>
          <div class="activity-skeleton__subtitle"></div>
        </div>
        <div class="activity-skeleton__amount"></div>
      </div>
    </template>

    <!-- Empty state -->
    <div v-else-if="items.length === 0" class="activity-empty">
      <div class="activity-empty__icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <h3 class="activity-empty__title">No activity yet</h3>
      <p class="activity-empty__hint">Your recent transactions will appear here.</p>
    </div>

    <!-- Activity items -->
    <template v-else>
      <ActivityRow
        v-for="item in items"
        :key="item.txId"
        :tx-id="item.txId"
        :status="item.status"
        :title="item.title"
        :subtitle="item.subtitle"
        :amount-text="item.amountText"
        :time-text="item.timeText"
        :is-outgoing="item.isOutgoing"
        @click="emit('item-click', item.txId)"
      />
    </template>
  </div>
</template>

<style scoped>
.activity-list {
  display: flex;
  flex-direction: column;
  /* No gap - dividers handled by parent ListGroup */
}

/* Skeleton loading */
.activity-skeleton {
  display: flex;
  align-items: center;
  gap: var(--space-md);
  padding: var(--card-pad-y) var(--card-pad-x);
}

.activity-skeleton__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}

.activity-skeleton__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.activity-skeleton__title {
  width: 120px;
  height: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.1s;
}

.activity-skeleton__subtitle {
  width: 80px;
  height: 10px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.05);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.2s;
}

.activity-skeleton__amount {
  width: 60px;
  height: 14px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.08);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay: 0.3s;
}

@keyframes skeleton-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

/* Empty state */
.activity-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--space-3xl) var(--space-xl);
  text-align: center;
  min-height: 200px;
}

.activity-empty__icon {
  color: var(--color-text-muted);
  opacity: 0.4;
  margin-bottom: var(--space-lg);
}

.activity-empty__title {
  font-size: var(--font-size-base);
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 var(--space-sm) 0;
}

.activity-empty__hint {
  font-size: var(--font-size-sm);
  color: var(--color-text-muted);
  margin: 0;
  max-width: 200px;
}
</style>
