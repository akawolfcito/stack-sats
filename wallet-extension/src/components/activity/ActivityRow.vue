<script setup lang="ts">
export type ActivityStatus = 'pending' | 'success' | 'failed'

export interface ActivityRowProps {
  txId: string
  status: ActivityStatus
  title: string
  subtitle?: string
  amountText?: string
  timeText?: string
  isOutgoing?: boolean
}

defineProps<ActivityRowProps>()

const emit = defineEmits<{
  (e: 'click', txId: string): void
}>()

const getStatusDotClass = (status: ActivityStatus) => {
  switch (status) {
    case 'success': return 'activity-row__dot--success'
    case 'pending': return 'activity-row__dot--pending'
    case 'failed': return 'activity-row__dot--failed'
    default: return ''
  }
}

const getStatusLabel = (status: ActivityStatus) => {
  switch (status) {
    case 'success': return 'Confirmed'
    case 'pending': return 'Pending'
    case 'failed': return 'Failed'
    default: return status
  }
}
</script>

<template>
  <button class="activity-row" @click="emit('click', txId)">
    <!-- Status indicator -->
    <div class="activity-row__status">
      <span class="activity-row__dot" :class="getStatusDotClass(status)"></span>
    </div>

    <!-- Main content -->
    <div class="activity-row__content">
      <div class="activity-row__main">
        <span class="activity-row__title">{{ title }}</span>
        <span v-if="subtitle" class="activity-row__subtitle">{{ subtitle }}</span>
      </div>
      <div class="activity-row__meta">
        <span class="activity-row__status-label" :class="`activity-row__status-label--${status}`">
          {{ getStatusLabel(status) }}
        </span>
        <span v-if="timeText" class="activity-row__time">{{ timeText }}</span>
      </div>
    </div>

    <!-- Amount (if applicable) -->
    <div v-if="amountText" class="activity-row__amount" :class="{ 'activity-row__amount--outgoing': isOutgoing }">
      {{ isOutgoing ? '-' : '+' }}{{ amountText }}
    </div>

    <!-- Chevron -->
    <div class="activity-row__chevron">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  </button>
</template>

<style scoped>
.activity-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  min-height: var(--row-h);
  padding: var(--card-pad-y) var(--card-pad-x);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background var(--transition-fast);
  text-align: left;
}

.activity-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.activity-row:active {
  background: rgba(255, 255, 255, 0.05);
}

/* Status dot */
.activity-row__status {
  flex-shrink: 0;
}

.activity-row__dot {
  display: block;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.activity-row__dot--success {
  background: var(--color-success, #22c55e);
  box-shadow: 0 0 8px rgba(34, 197, 94, 0.4);
}

.activity-row__dot--pending {
  background: var(--color-warning, #f59e0b);
  box-shadow: 0 0 8px rgba(245, 158, 11, 0.4);
  animation: pulse-pending 1.5s infinite;
}

.activity-row__dot--failed {
  background: var(--color-error, #ef4444);
  box-shadow: 0 0 8px rgba(239, 68, 68, 0.4);
}

@keyframes pulse-pending {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Content */
.activity-row__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity-row__main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.activity-row__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.activity-row__subtitle {
  font-size: 12px;
  color: var(--color-text-muted);
  font-family: monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.activity-row__meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.activity-row__status-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.activity-row__status-label--success {
  color: var(--color-success, #22c55e);
}

.activity-row__status-label--pending {
  color: var(--color-warning, #f59e0b);
}

.activity-row__status-label--failed {
  color: var(--color-error, #ef4444);
}

.activity-row__time {
  font-size: 12px;
  color: var(--color-text-muted);
}

/* Amount */
.activity-row__amount {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 700;
  font-family: monospace;
  color: var(--color-success, #22c55e);
}

.activity-row__amount--outgoing {
  color: var(--color-text-primary);
}

/* Chevron */
.activity-row__chevron {
  flex-shrink: 0;
  color: var(--color-text-muted);
}
</style>
