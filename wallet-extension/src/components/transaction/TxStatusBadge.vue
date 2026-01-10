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
        icon: "✓",
        label: "Confirmed",
        class: "status-success",
      };
    case "pending":
      return {
        icon: "…",
        label: "Pending",
        class: "status-pending",
      };
    case "failed":
      return {
        icon: "✕",
        label: "Failed",
        class: "status-failed",
      };
  }
});
</script>

<template>
  <span class="tx-status-badge" :class="[statusConfig.class, { compact }]">
    <span class="status-icon">{{ statusConfig.icon }}</span>
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
