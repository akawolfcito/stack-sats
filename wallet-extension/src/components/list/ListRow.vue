<script setup lang="ts">
defineProps<{
  /** Primary text */
  label: string;
  /** Secondary/subtitle text */
  subtitle?: string;
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
  transition: background var(--transition-fast);
}

.list-row:hover:not(.list-row--disabled) {
  background: rgba(255, 255, 255, 0.03);
}

.list-row:active:not(.list-row--disabled) {
  background: rgba(255, 255, 255, 0.05);
}

.list-row--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Icon */
.list-row-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--color-text-primary);
}

.list-row--add .list-row-icon {
  background: transparent;
  border: 1.5px dashed var(--color-text-muted);
  color: var(--color-text-muted);
}

.list-row--add:hover .list-row-icon {
  border-color: var(--color-accent-primary);
  color: var(--color-accent-primary);
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
  color: var(--color-accent-primary);
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

/* Badge */
.list-row-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--color-bg-primary);
  background: var(--color-accent-primary);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* Chevron */
.list-row-chevron {
  color: var(--color-text-muted);
  flex-shrink: 0;
}
</style>
