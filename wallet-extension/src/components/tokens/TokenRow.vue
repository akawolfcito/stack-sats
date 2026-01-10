<script setup lang="ts">
const props = defineProps<{
  symbol: string;
  name: string;
  color: string;
  enabled: boolean;
  isLocked?: boolean;
  isCustom?: boolean;
}>();

const emit = defineEmits<{
  toggle: [enabled: boolean];
}>();

function handleToggle(event: Event) {
  const target = event.target as HTMLInputElement;
  emit("toggle", target.checked);
}
</script>

<template>
  <div class="token-row" :class="{ 'token-row--custom': isCustom }">
    <div class="token-info">
      <div
        class="token-icon"
        :style="{
          backgroundColor: color + '20',
          borderColor: color + '40',
        }"
      >
        <span class="token-letter" :style="{ color }">
          {{ symbol.charAt(0) }}
        </span>
      </div>
      <div class="token-details">
        <span class="token-symbol">{{ symbol }}</span>
        <span class="token-name">{{ name }}</span>
      </div>
    </div>
    <label class="toggle" :class="{ disabled: isLocked }">
      <input
        type="checkbox"
        :checked="enabled"
        :disabled="isLocked"
        @change="handleToggle"
      />
      <span class="toggle-slider"></span>
    </label>
  </div>
</template>

<style scoped>
.token-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-sm) var(--space-md);
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  min-height: 56px;
  transition: border-color 0.15s ease;
}

.token-row:hover {
  border-color: rgba(255, 255, 255, 0.15);
}

.token-row--custom {
  border-style: dashed;
}

.token-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  min-width: 0;
}

.token-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1.5px solid;
  flex-shrink: 0;
}

.token-letter {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
}

.token-details {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.token-symbol {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--color-text-primary);
}

.token-name {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Toggle Switch */
.toggle {
  position: relative;
  display: inline-block;
  width: 40px;
  height: 22px;
  flex-shrink: 0;
}

.toggle.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: var(--color-bg-elevated);
  border-radius: 22px;
  transition: all 0.2s ease;
}

.toggle-slider::before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 2px;
  bottom: 2px;
  background-color: var(--color-text-muted);
  border-radius: 50%;
  transition: all 0.2s ease;
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-accent-primary);
}

.toggle input:checked + .toggle-slider::before {
  transform: translateX(18px);
  background-color: var(--color-bg-primary);
}

.toggle.disabled .toggle-slider {
  cursor: not-allowed;
}
</style>
