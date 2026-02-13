<script setup lang="ts">
export type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error' | 'info';

defineProps<{
  /** Visual variant - neutral by default, NO lime */
  variant?: BadgeVariant;
}>();
</script>

<template>
  <span
    class="badge"
    :class="{
      'badge--neutral': !variant || variant === 'neutral',
      'badge--success': variant === 'success',
      'badge--warning': variant === 'warning',
      'badge--error': variant === 'error',
      'badge--info': variant === 'info',
    }"
  >
    <slot />
  </span>
</template>

<style scoped>
/* Badge - Neutral selection indicator (v16.1)
 * NEVER uses lime accent - that's reserved for primary CTAs only
 */
.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: var(--radius-chip);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Neutral - default for "Active", selection states */
.badge--neutral {
  background: rgba(255, 255, 255, 0.12);
  color: var(--color-text-primary);
}

/* Success - confirmations, connected states */
.badge--success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-success);
}

/* Warning - pending, attention needed */
.badge--warning {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

/* Error - failed, disconnected */
.badge--error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
}

/* Info - informational, network labels */
.badge--info {
  background: rgba(96, 165, 250, 0.15);
  color: #60a5fa;
}
</style>
