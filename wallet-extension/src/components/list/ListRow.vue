<script setup lang="ts">
defineProps<{
  /** Primary text */
  label: string;
  /** Secondary/subtitle text */
  subtitle?: string;
  /** Primary value text (right side, e.g., balance) */
  value?: string;
  /** Secondary value text (right side, e.g., fiat value) */
  valueSubtitle?: string;
  /** Icon color (CSS color or gradient) */
  iconColor?: string;
  /** Show chevron arrow on right */
  chevron?: boolean;
  /** Show badge text (e.g., "Active") */
  badge?: string;
  /** Visual variant */
  variant?: 'default' | 'danger' | 'add';
  /** Disable interaction */
  disabled?: boolean;
}>();

const emit = defineEmits<{
  click: [];
}>();

function handleClick() {
  emit('click');
}
</script>

<template>
  <button
    type="button"
    class="list-row"
    :class="{
      'list-row--danger': variant === 'danger',
      'list-row--add': variant === 'add',
      'list-row--disabled': disabled,
    }"
    :disabled="disabled"
    @click="handleClick"
  >
    <!-- Icon Slot or Default Icon -->
    <div class="list-row-icon" :style="iconColor ? { background: iconColor } : undefined">
      <slot name="icon">
        <span v-if="variant === 'add'" class="icon-plus">+</span>
      </slot>
    </div>

    <!-- Content -->
    <div class="list-row-content">
      <span class="list-row-label">{{ label }}</span>
      <span v-if="subtitle" class="list-row-subtitle">{{ subtitle }}</span>
    </div>

    <!-- Value (balance, amount) -->
    <div v-if="value || valueSubtitle" class="list-row-value">
      <span v-if="value" class="list-row-value-primary">{{ value }}</span>
      <span v-if="valueSubtitle" class="list-row-value-secondary">{{ valueSubtitle }}</span>
    </div>

    <!-- Badge -->
    <span v-if="badge" class="list-row-badge">{{ badge }}</span>

    <!-- Right Slot (for custom actions like delete) -->
    <slot name="right" />

    <!-- Chevron -->
    <svg
      v-if="chevron"
      class="list-row-chevron"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  </button>
</template>

<style scoped>
/* V66: Tactile Premium - enhanced feedback */
.list-row {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
  padding: var(--card-pad-y) var(--card-pad-x);
  min-height: var(--row-h);
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
  /* V66 G4: Smoother transition + transform */
  transition:
    background var(--transition-base),
    transform var(--transition-fast);
}

.list-row:hover:not(.list-row--disabled) {
  background: var(--surface-hover);
}

/* V66 G3: Tactile press feedback */
.list-row:active:not(.list-row--disabled) {
  background: var(--surface-pressed);
  transform: scale(0.985);
}

.list-row:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}

.list-row--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* V42: Icon chip - premium depth without glow */
.list-row-icon {
  width: var(--icon-btn-size); /* 28px compact, 40px comfy */
  height: var(--icon-btn-size);
  border-radius: var(--radius-chip);
  background: rgba(255, 255, 255, 0.08); /* V42: Slightly less aggressive */
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 1px 2px rgba(0, 0, 0, 0.1); /* V42: Subtle outer shadow for depth */
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-text-primary);
}

/* V64: Add variant - ghost button style (no dashed border) */
.list-row--add .list-row-icon {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: none;
  color: var(--color-text-muted);
}

.list-row--add:hover .list-row-icon {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.16);
  color: var(--color-text-primary);
}

.list-row--danger .list-row-icon {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
}

.icon-plus {
  font-size: 18px;
  font-weight: 300;
  line-height: 1;
}

/* Content */
.list-row-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.list-row-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--color-text-primary);
}

.list-row--add .list-row-label {
  color: var(--color-text-muted);
}

.list-row--add:hover .list-row-label {
  color: var(--color-text-primary); /* v16.1: neutral hover */
}

.list-row--danger .list-row-label {
  color: var(--color-error);
}

.list-row-subtitle {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* V42: Value (balance, amount) - Premium numeric hierarchy */
.list-row-value {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 3px; /* V42: Slightly more gap for clarity */
  flex-shrink: 0;
  min-width: 70px; /* V42: Slightly wider for larger numbers */
}

.list-row-value-primary {
  font-size: var(--font-size-sm);
  font-weight: 600; /* V42: Bold value for instant readability */
  color: var(--color-text-primary);
  font-variant-numeric: tabular-nums;
  letter-spacing: -0.01em; /* V42: Tighter tracking for numbers */
}

.list-row-value-secondary {
  font-size: 11px; /* V42: Slightly smaller for clear hierarchy */
  font-weight: 500;
  color: var(--color-text-muted);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.01em; /* V42: Slightly open for small text */
}

/* Badge - Neutral style (v16.1, lime reserved for CTAs) */
.list-row-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-text-primary);
  background: rgba(255, 255, 255, 0.12);
  padding: 2px 6px;
  border-radius: var(--radius-chip);
  flex-shrink: 0;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

/* Chevron - V29: Unified size and opacity */
.list-row-chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
  opacity: 0.5; /* V29: Subtle, consistent across app */
  width: 16px;
  height: 16px;
}
</style>
