/**
 * DensityService - Cross-document density mode synchronization
 *
 * Handles density mode (auto | compact | comfy) with real-time sync
 * between popup and sidepanel using chrome.storage.local
 */

// Strict density type contract
export type DensityMode = 'auto' | 'compact' | 'comfy';

const VALID_MODES: DensityMode[] = ['auto', 'compact', 'comfy'];
const STORAGE_KEY = 'uiDensity';
const BROADCAST_CHANNEL = 'denvault-ui';
const isDev = import.meta.env.DEV;

// Fallback for non-extension contexts (dev server)
let broadcastChannel: BroadcastChannel | null = null;

/**
 * Normalize any value to a valid DensityMode
 * Invalid values map to 'auto' with a dev warning
 */
function normalize(value: unknown): DensityMode {
  if (typeof value === 'string') {
    // Handle legacy 'comfortable' → 'comfy' migration
    if (value === 'comfortable') {
      if (isDev) console.warn('[DensityService] Migrated "comfortable" → "comfy"');
      return 'comfy';
    }

    if (VALID_MODES.includes(value as DensityMode)) {
      return value as DensityMode;
    }
  }

  if (isDev && value !== null && value !== undefined) {
    console.warn(`[DensityService] Invalid density "${value}", defaulting to "auto"`);
  }

  return 'auto';
}

/**
 * Apply density mode to document
 */
function apply(mode: DensityMode): void {
  document.documentElement.dataset.density = mode;
  if (isDev) {
    console.log(`[DensityService] Applied density → ${mode}`);
  }
}

/**
 * Get current persisted density mode
 * Uses chrome.storage.local if available, falls back to localStorage
 */
async function get(): Promise<DensityMode> {
  try {
    // Try chrome.storage.local first (extension context)
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      return normalize(result[STORAGE_KEY]);
    }
  } catch {
    // Fall through to localStorage
  }

  // Fallback to localStorage
  const stored = localStorage.getItem(STORAGE_KEY);
  // Also check legacy key for migration
  const legacyStored = localStorage.getItem('density_mode');
  return normalize(stored ?? legacyStored);
}

/**
 * Set density mode with cross-document sync
 */
async function set(mode: DensityMode): Promise<void> {
  const normalized = normalize(mode);

  // Apply immediately to current document
  apply(normalized);

  try {
    // Try chrome.storage.local first (triggers onChanged in other documents)
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      await chrome.storage.local.set({ [STORAGE_KEY]: normalized });
      if (isDev) {
        console.log(`[DensityService] Persisted to chrome.storage → ${normalized}`);
      }
      return;
    }
  } catch {
    // Fall through to localStorage + BroadcastChannel
  }

  // Fallback: localStorage + BroadcastChannel for cross-tab sync
  localStorage.setItem(STORAGE_KEY, normalized);
  // Also update legacy key for backwards compatibility
  localStorage.setItem('density_mode', normalized);

  if (broadcastChannel) {
    broadcastChannel.postMessage({ type: 'density-change', mode: normalized });
    if (isDev) {
      console.log(`[DensityService] Broadcast density → ${normalized}`);
    }
  }
}

/**
 * Initialize density service
 * - Rehydrates from storage
 * - Registers cross-document listeners
 */
async function init(): Promise<void> {
  // Rehydrate from storage
  const mode = await get();
  apply(mode);

  // Setup cross-document sync listeners
  try {
    // Preferred: chrome.storage.onChanged
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
      chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'local' && changes[STORAGE_KEY]) {
          const newMode = normalize(changes[STORAGE_KEY].newValue);
          apply(newMode);
          if (isDev) {
            console.log(`[DensityService] Sync received (chrome.storage) → ${newMode}`);
          }
        }
      });
      if (isDev) {
        console.log('[DensityService] Initialized with chrome.storage.onChanged');
      }
      return;
    }
  } catch {
    // Fall through to BroadcastChannel
  }

  // Fallback: BroadcastChannel + storage event
  try {
    broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL);
    broadcastChannel.onmessage = (event) => {
      if (event.data?.type === 'density-change') {
        const newMode = normalize(event.data.mode);
        apply(newMode);
        if (isDev) {
          console.log(`[DensityService] Sync received (BroadcastChannel) → ${newMode}`);
        }
      }
    };
    if (isDev) {
      console.log('[DensityService] Initialized with BroadcastChannel');
    }
  } catch {
    if (isDev) {
      console.warn('[DensityService] BroadcastChannel not available');
    }
  }

  // Also listen to storage events for cross-origin fallback
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY && e.newValue) {
      const newMode = normalize(e.newValue);
      apply(newMode);
      if (isDev) {
        console.log(`[DensityService] Sync received (storage event) → ${newMode}`);
      }
    }
  });
}

/**
 * Get current applied density (from DOM)
 */
function current(): DensityMode {
  return normalize(document.documentElement.dataset.density);
}

// Export service singleton
export const DensityService = {
  get,
  set,
  apply,
  init,
  current,
  normalize,
};

export default DensityService;
