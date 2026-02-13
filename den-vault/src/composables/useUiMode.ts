import { ref, computed, onMounted, onUnmounted } from 'vue'

export type UiMode = 'popup' | 'panel' | 'sidepanel' | 'fullpage'

const POPUP_HEIGHT_THRESHOLD = 640
const DEBOUNCE_MS = 150

/**
 * V80: Get view mode from URL query param
 * - ?view=sidepanel → sidepanel mode
 * - ?view=fullpage → fullpage mode
 * - otherwise → detect from viewport height
 */
function getViewFromUrl(): UiMode | null {
  const params = new URLSearchParams(window.location.search)
  const view = params.get('view')
  if (view === 'sidepanel') return 'sidepanel'
  if (view === 'fullpage') return 'fullpage'
  return null
}

/**
 * Composable to detect UI mode based on viewport height or URL param.
 * - popup: height < 640px (Chrome extension popup)
 * - panel: height >= 640px (Chrome side panel)
 * - sidepanel: ?view=sidepanel (explicit side panel)
 * - fullpage: ?view=fullpage (explicit full page)
 */
export function useUiMode() {
  const urlMode = getViewFromUrl()
  const mode = ref<UiMode>(urlMode || getMode())

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
    // V80: Set data-view attribute for CSS targeting
    if (urlMode) {
      document.documentElement.dataset.view = urlMode
    }
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
  const isSidePanel = computed(() => mode.value === 'sidepanel')
  const isFullPage = computed(() => mode.value === 'fullpage')

  return {
    mode,
    isPopup,
    isPanel,
    isSidePanel,
    isFullPage,
  }
}
