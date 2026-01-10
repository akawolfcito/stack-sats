# Density Audit Report

## Executive Summary

La auditoría revela que el sistema de densidad está correctamente implementado a nivel de bootstrap (`main.ts`) y tokens CSS (`base.css`), pero **múltiples componentes usan valores hardcodeados** que ignoran los tokens de densidad, causando que los cambios de modo no sean perceptibles en toda la UI.

## Token Coverage Status

### ✅ Componentes con Buena Cobertura
| Componente | Tokens Usados |
|------------|---------------|
| `AppHeader.vue` | `--header-h`, `--icon-btn-size`, `--icon-size-md` |
| `ScreenShell.vue` | `--section-gap`, `--space-lg` |
| `ListRow.vue` | `--row-h`, `--card-pad-x`, `--card-pad-y` |
| `AssetRow.vue` | `--icon-btn-size`, `--card-pad-x`, `--card-pad-y` |
| `UserHomeView.vue` (header/actions) | `--icon-btn-size`, `--control-h`, `--font-size-sm` |

### ❌ Componentes con Hardcodes Críticos

## Hardcode Inventory (Priority Order)

### P0 - Critical (Blocks density perception in main flows)

| File | Line | Hardcode | Suggested Token | Impact |
|------|------|----------|-----------------|--------|
| `TokenRow.vue` | 61 | `min-height: 56px` | `--row-h` | Token rows don't shrink |
| `SendView.vue` | 764 | `height: 56px` | `--control-h` | Input fields fixed size |
| `SendView.vue` | 938 | `height: 56px` | `--control-h` | Continue button fixed |
| `SendView.vue` | 788 | `height: 44px; width: 44px` | `--icon-btn-size` | Action buttons fixed |
| `SendTokenView.vue` | 620 | `height: 56px` | `--control-h` | Icon container fixed |
| `SendTokenView.vue` | 689 | `height: 52px` | `--row-h` | Input height fixed |
| `SendTokenView.vue` | 971 | `height: 56px` | `--control-h` | CTA button fixed |

### P1 - High (Visible elements in main routes)

| File | Line | Hardcode | Suggested Token | Impact |
|------|------|----------|-----------------|--------|
| `UserHomeView.vue` | 1021 | `width: 32px; height: 32px` | `--icon-btn-size` | Refresh btn doesn't scale |
| `UserHomeView.vue` | 1100-1101 | `width: 40px; height: 40px` | `--icon-btn-size` | Token icons don't scale |
| `ManageTokensView.vue` | 302-303 | `width: 40px; height: 40px` | `--icon-btn-size` | Spinner fixed |
| `UserMenu.vue` | 847 | `height: 56px` | `--control-h` | Primary buttons fixed |
| `UserMenu.vue` | 886,903,920 | `height: 56px` | `--control-h` | Menu buttons fixed |
| `TokenRow.vue` | 81-82 | `width: 36px; height: 36px` | calc(var(--icon-btn-size) - 4px) | Token icons fixed |
| `AddTokenView.vue` | 392 | `height: 52px` | `--row-h` | Input fixed |
| `AddTokenView.vue` | 482 | `height: 44px; width: 44px` | `--icon-btn-size` | Preview icon fixed |

### P2 - Medium (Secondary components)

| File | Line | Hardcode | Suggested Token | Impact |
|------|------|----------|-----------------|--------|
| `UnlockView.vue` | 576,597 | `height: 56px` | `--control-h` | Buttons fixed |
| `UnlockView.vue` | 493 | `height: 52px` | `--row-h` | PIN button fixed |
| `ReceiveModal.vue` | 659,695 | `height: 48px` | `--row-h` | Tab buttons fixed |
| `Confirmation.vue` | 381 | `height: 40px` | `--icon-btn-size` | Close button fixed |
| `BottomNav.vue` | 180 | `height: 64px` | calc(var(--header-h) + 8px) | Nav height fixed |
| `AccountDetailsView.vue` | 348 | `height: 64px` | `--control-h` or custom | Avatar container |
| `PinInput.vue` | 326 | `height: 56px` | `--control-h` | Keypad buttons fixed |

### P3 - Low (Font sizes - would need new tokens)

| File | Line | Hardcode | Notes |
|------|------|----------|-------|
| `UserHomeView.vue` | 899,907 | `font-size: 48px` | Balance display - intentional large |
| `SendView.vue` | 983 | `font-size: 40px` | Amount display - intentional large |
| Multiple files | Various | `font-size: NNpx` | Would need `--font-size-*` density variants |

## Density Token Values

```css
/* Comfortable (default) */
--header-h: 56px;
--row-h: 52px;
--control-h: 52px;
--icon-btn-size: 40px;
--section-gap: 24px;

/* Compact */
--header-h: 44px;
--row-h: 44px;
--control-h: 44px;
--icon-btn-size: 32px;
--section-gap: 16px;
```

## Recommended Fix Order

1. **Phase 1 - Critical Routes** (P0)
   - `TokenRow.vue` - fix `min-height`
   - `SendView.vue` - fix control heights
   - `SendTokenView.vue` - fix control heights

2. **Phase 2 - Main UI** (P1)
   - `UserHomeView.vue` - fix icon buttons
   - `UserMenu.vue` - fix button heights
   - `ManageTokensView.vue` - fix spinner
   - `AddTokenView.vue` - fix input/icon

3. **Phase 3 - Secondary** (P2)
   - `UnlockView.vue` - fix buttons
   - `ReceiveModal.vue` - fix tabs
   - `PinInput.vue` - fix keypad
   - Modals and other components

## Verification Checklist

After fixes, verify in browser console:
```javascript
// Get computed density values
const root = document.documentElement;
const style = getComputedStyle(root);
console.table({
  density: root.dataset.density || 'auto',
  headerH: style.getPropertyValue('--header-h'),
  rowH: style.getPropertyValue('--row-h'),
  controlH: style.getPropertyValue('--control-h'),
  iconBtnSize: style.getPropertyValue('--icon-btn-size'),
  sectionGap: style.getPropertyValue('--section-gap'),
});
```

Test elements bounding box:
```javascript
// Measure specific elements
['header-btn', 'list-row', 'action-btn', 'continue-btn'].forEach(cls => {
  const el = document.querySelector(`.${cls}`);
  if (el) console.log(cls, el.getBoundingClientRect().height);
});
```
