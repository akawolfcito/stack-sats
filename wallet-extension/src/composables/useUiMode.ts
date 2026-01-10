import { ref, computed, onMounted, onUnmounted } from 'vue'

export type UiMode = 'popup' | 'panel'

const POPUP_HEIGHT_THRESHOLD = 640
const DEBOUNCE_MS = 150

/**
 * Composable to detect UI mode based on viewport height.
 * - popup: height < 640px (Chrome extension popup)
 * - panel: height >= 640px (Chrome side panel)
 */
export function useUiMode() {
  const mode = ref<UiMode>(getMode())

  function getMode(): UiMode {
    return window.innerHeight < POPUP_HEIGHT_THRESHOLD ? 'popup' : 'panel'
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function handleResize() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      mode.value = getMode()
    }, DEBOUNCE_MS)
  }

  onMounted(() => {
    window.addEventListener('resize', handleResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleResize)
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
  })

  const isPopup = computed(() => mode.value === 'popup')
  const isPanel = computed(() => mode.value === 'panel')

  return {
    mode,
    isPopup,
    isPanel,
  }
}
