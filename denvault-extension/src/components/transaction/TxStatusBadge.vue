<script setup lang="ts">
import { computed } from "vue";

type TxStatus = "pending" | "success" | "failed";

const props = defineProps<{
  status: TxStatus;
  compact?: boolean;
}>();

const statusConfig = computed(() => {
  switch (props.status) {
    case "success":
      return {
        icon: "success" as const,
        label: "Confirmed",
        class: "status-success",
      };
    case "pending":
      return {
        icon: "pending" as const,
        label: "Pending",
        class: "status-pending",
      };
    case "failed":
    default:
      return {
        icon: "failed" as const,
        label: "Failed",
        class: "status-failed",
      };
  }
});
</script>

<template>
  <span class="tx-status-badge" :class="[statusConfig.class, { compact }]">
    <span class="status-icon" aria-hidden="true">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <polyline v-if="statusConfig.icon === 'success'" points="20 6 9 17 4 12" />
        <template v-else-if="statusConfig.icon === 'failed'">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </template>
        <template v-else>
          <circle cx="5" cy="12" r="1.5" />
          <circle cx="12" cy="12" r="1.5" />
          <circle cx="19" cy="12" r="1.5" />
        </template>
      </svg>
    </span>
    <span v-if="!compact" class="status-label">{{ statusConfig.label }}</span>
  </span>
</template>

<style scoped>
.tx-status-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-xs);
  padding: var(--space-xs) var(--space-sm);
  border-radius: var(--radius-pill);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  line-height: 1;
}

.tx-status-badge.compact {
  padding: 4px 8px;
  gap: 2px;
}

.status-icon {
  font-size: 10px;
}

.status-label {
  text-transform: capitalize;
}

/* Success */
.status-success {
  background: rgba(34, 197, 94, 0.15);
  color: #22c55e;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

/* Pending */
.status-pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
  border: 1px solid rgba(251, 191, 36, 0.3);
}

/* Failed */
.status-failed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border: 1px solid rgba(239, 68, 68, 0.3);
}
</style>
