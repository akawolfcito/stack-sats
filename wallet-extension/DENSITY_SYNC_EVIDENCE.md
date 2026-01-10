# Density Sync Evidence

This document provides reproduction steps and DevTools snippets to verify cross-document density synchronization between popup and sidepanel.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  DensityService (src/services/density.ts)                   │
├─────────────────────────────────────────────────────────────┤
│  - get()     → Read from chrome.storage.local or localStorage│
│  - set()     → Persist + apply + emit cross-doc event       │
│  - apply()   → document.documentElement.dataset.density     │
│  - init()    → Rehydrate + register listeners               │
│  - current() → Read current applied mode from DOM           │
│  - normalize() → Validate/migrate density value             │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│    Popup      │   │   Sidepanel   │   │   Settings    │
│  (index.html) │   │  (index.html) │   │  (UserMenu)   │
└───────────────┘   └───────────────┘   └───────────────┘
```

## Sync Mechanisms

| Context | Primary Sync | Fallback |
|---------|--------------|----------|
| Extension | chrome.storage.onChanged | N/A |
| Dev Server | BroadcastChannel | storage event |

## Steps to Reproduce

### 1. Build and Load Extension
```bash
cd wallet-extension
pnpm build
# Load dist/ folder in chrome://extensions/
```

### 2. Open Both Contexts
1. Click extension icon → Opens popup
2. Right-click extension icon → "Open side panel" → Opens sidepanel

### 3. Change Density in Settings
1. In popup: Navigate to Settings → Appearance → Density
2. Select "Compact" or "Comfy"

### 4. Verify Cross-Document Sync
- Sidepanel should immediately reflect the new density
- No page reload required

## Expected Console Logs (Dev Mode)

When changing density in Settings:

**Popup (source):**
```
[DensityService] Applied density → compact
[DensityService] Persisted to chrome.storage → compact
```

**Sidepanel (receiver):**
```
[DensityService] Sync received (chrome.storage) → compact
```

## DevTools Verification Snippets

### Check Current Density
```javascript
// Run in any document's console
document.documentElement.dataset.density
// Expected: "auto" | "compact" | "comfy"
```

### Read Persisted Density
```javascript
// In extension context
chrome.storage.local.get('uiDensity', console.log)
// Expected: { uiDensity: "compact" }

// In dev server context
localStorage.getItem('uiDensity')
// Expected: "compact"
```

### Manually Trigger Sync (for testing)
```javascript
// Set density and verify propagation
chrome.storage.local.set({ uiDensity: 'comfy' })
// Both popup and sidepanel should update
```

### Verify Token Values
```javascript
// Run in any document's console
const styles = getComputedStyle(document.documentElement);
console.table({
  density: document.documentElement.dataset.density,
  controlH: styles.getPropertyValue('--control-h'),
  rowH: styles.getPropertyValue('--row-h'),
  controlPadX: styles.getPropertyValue('--control-pad-x'),
  rowPadX: styles.getPropertyValue('--row-pad-x'),
  iconBtnSize: styles.getPropertyValue('--icon-btn-size'),
});
```

Expected output by mode:

| Token | Compact | Comfy |
|-------|---------|-------|
| --control-h | 44px | 52px |
| --row-h | 44px | 52px |
| --control-pad-x | 12px | 16px |
| --row-pad-x | 10px | 14px |
| --icon-btn-size | 32px | 40px |

## Troubleshooting

### Density Not Syncing

1. **Check DensityService initialized:**
   ```javascript
   // Should see listener registered
   chrome.storage.onChanged.hasListeners()
   ```

2. **Verify chrome.storage available:**
   ```javascript
   typeof chrome !== 'undefined' && !!chrome.storage?.local
   ```

3. **Force re-init (dev only):**
   ```javascript
   import { DensityService } from './services/density'
   DensityService.init()
   ```

### Legacy Migration

The service automatically migrates:
- `"comfortable"` → `"comfy"`
- Invalid values → `"auto"`

Check migration happened:
```javascript
localStorage.getItem('density_mode')  // Legacy key (also updated)
localStorage.getItem('uiDensity')     // Primary key
```

## Files Changed

| File | Change |
|------|--------|
| `src/services/density.ts` | New DensityService singleton |
| `src/main.ts` | Bootstrap calls `DensityService.init()` |
| `src/views/UserMenu.vue` | Uses `DensityService.get/set` |
| `src/assets/base.css` | Density-aware padding tokens |
| `src/components/ui/Button.vue` | Uses padding tokens |
| `src/components/ui/TextField.vue` | Uses padding tokens |
