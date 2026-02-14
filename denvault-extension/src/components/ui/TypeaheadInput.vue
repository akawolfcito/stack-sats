<script setup lang="ts">
/**
 * TypeaheadInput - V54.4 BIP39 Typeahead Component
 *
 * Controlled typeahead input with local suggestions.
 * Used for recovery phrase verification with BIP39 wordlist.
 *
 * Features:
 * - Prefix-filtered suggestions (max 8)
 * - Keyboard navigation (ArrowUp/Down, Enter, Esc)
 * - Mouse selection
 * - Accessibility (combobox/listbox ARIA roles)
 * - Premium visual styling
 *
 * Security:
 * - autocomplete="off", autocapitalize="none", spellcheck="false"
 * - Suggestions from BIP39 list only, not user's phrase
 * - No localStorage/sessionStorage storage
 */
import { ref, computed, watch, nextTick } from 'vue';
import { filterBip39Words } from '@/lib/bip39/wordlist-en';

const props = defineProps<{
  modelValue: string;
  id?: string;
  placeholder?: string;
  label?: string;
  dataRoi?: string; // V54.4: Optional data-roi for E2E testing
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
  'keydown': [event: KeyboardEvent];
}>();

// State
const inputRef = ref<HTMLInputElement | null>(null);
const isOpen = ref(false);
const highlightedIndex = ref(-1);

// Computed suggestions
const suggestions = computed(() => {
  const value = props.modelValue.trim();
  if (!value || value.length === 0) return [];
  return filterBip39Words(value, 8);
});

// Close dropdown when no suggestions
watch(suggestions, (newSuggestions) => {
  if (newSuggestions.length === 0) {
    isOpen.value = false;
    highlightedIndex.value = -1;
  }
});

// Open dropdown when typing and has suggestions
watch(() => props.modelValue, (newValue) => {
  if (newValue.trim().length > 0 && suggestions.value.length > 0) {
    isOpen.value = true;
    highlightedIndex.value = -1;
  }
});

// Handle input
function handleInput(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('update:modelValue', target.value);
}

// Handle keyboard navigation
function handleKeydown(event: KeyboardEvent) {
  // Always emit keydown for parent to handle if needed
  emit('keydown', event);

  if (!isOpen.value && suggestions.value.length > 0 && event.key === 'ArrowDown') {
    // Open dropdown on ArrowDown if closed
    isOpen.value = true;
    highlightedIndex.value = 0;
    event.preventDefault();
    return;
  }

  // If dropdown is closed, let parent handle all keys
  if (!isOpen.value) return;

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      highlightedIndex.value = Math.min(
        highlightedIndex.value + 1,
        suggestions.value.length - 1
      );
      scrollToHighlighted();
      break;

    case 'ArrowUp':
      event.preventDefault();
      highlightedIndex.value = Math.max(highlightedIndex.value - 1, 0);
      scrollToHighlighted();
      break;

    case 'Enter':
      // Only handle Enter if we have a highlighted suggestion
      if (highlightedIndex.value >= 0 && highlightedIndex.value < suggestions.value.length) {
        event.preventDefault();
        selectSuggestion(suggestions.value[highlightedIndex.value]);
      }
      // Otherwise, let parent handle Enter (e.g., for form navigation)
      break;

    case 'Escape':
      event.preventDefault();
      closeDropdown();
      break;
  }
}

// Scroll highlighted item into view
function scrollToHighlighted() {
  nextTick(() => {
    const list = document.querySelector(`#${props.id}-listbox`);
    const highlighted = list?.querySelector('[data-highlighted="true"]');
    highlighted?.scrollIntoView({ block: 'nearest' });
  });
}

// Select a suggestion
function selectSuggestion(word: string) {
  emit('update:modelValue', word);
  closeDropdown();
  inputRef.value?.focus();
}

// Close dropdown
function closeDropdown() {
  isOpen.value = false;
  highlightedIndex.value = -1;
}

// Handle blur (close after small delay to allow click)
function handleBlur() {
  setTimeout(() => {
    closeDropdown();
  }, 150);
}

// Handle focus
function handleFocus() {
  if (props.modelValue.trim().length > 0 && suggestions.value.length > 0) {
    isOpen.value = true;
  }
}

// Expose focus method for parent
function focus() {
  inputRef.value?.focus();
}

defineExpose({ focus });
</script>

<template>
  <div class="typeahead" :class="{ 'typeahead--open': isOpen && suggestions.length > 0 }">
    <!-- Label -->
    <label v-if="label" :for="id" class="typeahead__label">{{ label }}</label>

    <!-- Input wrapper with combobox role -->
    <div class="typeahead__wrapper">
      <input
        :id="id"
        ref="inputRef"
        type="text"
        class="typeahead__input"
        :value="modelValue"
        :placeholder="placeholder"
        :data-roi="dataRoi"
        autocomplete="off"
        autocorrect="off"
        autocapitalize="none"
        spellcheck="false"
        role="combobox"
        :aria-expanded="isOpen && suggestions.length > 0"
        :aria-controls="`${id}-listbox`"
        :aria-activedescendant="highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined"
        aria-autocomplete="list"
        @input="handleInput"
        @keydown="handleKeydown"
        @focus="handleFocus"
        @blur="handleBlur"
      />

      <!-- Dropdown suggestions -->
      <Transition name="dropdown">
        <ul
          v-if="isOpen && suggestions.length > 0"
          :id="`${id}-listbox`"
          class="typeahead__dropdown"
          role="listbox"
          :aria-label="`Suggestions for ${label}`"
        >
          <li
            v-for="(word, index) in suggestions"
            :id="`${id}-option-${index}`"
            :key="word"
            class="typeahead__option"
            :class="{ 'typeahead__option--highlighted': index === highlightedIndex }"
            :data-highlighted="index === highlightedIndex"
            role="option"
            :aria-selected="index === highlightedIndex"
            @mousedown.prevent="selectSuggestion(word)"
            @mouseenter="highlightedIndex = index"
          >
            <!-- Highlight matching prefix -->
            <span class="typeahead__match">{{ word.slice(0, modelValue.length) }}</span>
            <span class="typeahead__rest">{{ word.slice(modelValue.length) }}</span>
          </li>
        </ul>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
/* V54.4: Typeahead container */
.typeahead {
  display: flex;
  flex-direction: column;
  gap: 4px;
  position: relative;
}

/* V54.4: Label - consistent with VerifyPhraseStep */
.typeahead__label {
  color: var(--color-text-muted);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
}

/* V54.4: Input wrapper - relative for dropdown positioning */
.typeahead__wrapper {
  position: relative;
}

/* V54.4: Input - premium material, matches verify-input */
.typeahead__input {
  width: 100%;
  height: 40px;
  padding: 0 var(--space-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: var(--radius-md);
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  box-sizing: border-box;
  transition: all var(--transition-fast);
}

.typeahead__input:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.04);
}

.typeahead__input:focus {
  outline: none;
  border-color: var(--color-accent-primary);
  background: rgba(255, 255, 255, 0.05);
}

.typeahead__input::placeholder {
  color: var(--color-text-muted);
  font-family: var(--font-family);
  font-size: var(--font-size-xs);
}

/* V54.4: Open state - connected border radius */
.typeahead--open .typeahead__input {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom-color: transparent;
}

/* V54.4: Dropdown - premium surface, same card style */
.typeahead__dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  margin: 0;
  padding: var(--space-xs) 0;
  list-style: none;
  background: rgba(30, 30, 30, 0.98);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-top: none;
  border-radius: 0 0 var(--radius-md) var(--radius-md);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  max-height: 200px;
  overflow-y: auto;
  z-index: 10;
}

/* V54.4: Option item */
.typeahead__option {
  padding: var(--space-xs) var(--space-md);
  cursor: pointer;
  font-family: var(--font-mono);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: background var(--transition-fast);
}

.typeahead__option:hover,
.typeahead__option--highlighted {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

/* V54.4: Match highlight - accent color for typed prefix */
.typeahead__match {
  color: var(--color-accent-primary);
  font-weight: var(--font-weight-medium);
}

.typeahead__rest {
  color: inherit;
}

/* V54.4: Dropdown transition */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

/* V54.4: Scrollbar styling for dropdown */
.typeahead__dropdown::-webkit-scrollbar {
  width: 4px;
}

.typeahead__dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.typeahead__dropdown::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}
</style>
