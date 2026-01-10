# Density Coverage Report

## Session Summary

This report documents the UI Kit enforcement work to ensure density mode (auto/compact/comfy) has REAL visual impact across the entire app.

---

## 1. Tokens Added

### New: `--icon-size-xl`

| Mode | Value |
|------|-------|
| Compact | 64px |
| Comfy | 80px |

Used for: Empty state icons, result icons

---

## 2. Components Fixed

### SegmentedTabs.vue
- Added `min-height: var(--row-h)` to `.tab-item`
- Added flexbox centering for proper alignment
- **Impact**: Tabs now respond to density changes (44px compact / 52px comfy)

### AssetList.vue
- `gap: 4px` -> `var(--space-xs)`
- `padding: 32px 16px` -> `var(--space-2xl) var(--space-lg)`
- `font-size: 14px` -> `var(--font-size-sm)`

### ActivityList.vue
- `gap: 4px` -> `var(--space-xs)`
- Skeleton: `gap: 12px` -> `var(--space-md)`
- Skeleton: `padding: 14px 16px` -> `var(--card-pad-y) var(--card-pad-x)`
- Skeleton content: `gap: 6px` -> `var(--space-sm)`
- Empty state: `padding: 40px 24px` -> `var(--space-3xl) var(--space-xl)`
- Empty state: font sizes tokenized

### AccountSwitcher.vue
- Pill: `gap: 8px` -> `var(--space-sm)`
- Pill: `padding: 6px 12px` -> `var(--space-xs) var(--space-md)`
- Pill: `border-radius: 24px` -> `var(--radius-pill)`

### ReceiveModal.vue (12+ fixes)
- Header: `gap: 12px` -> `var(--space-md)`
- Asset icon: 36px -> `var(--icon-btn-size)`
- Close button: 36px -> `var(--icon-btn-size)`
- Tab button: `height: 40px` -> `var(--control-h)`
- Type button: `height: 34px` -> `var(--row-h)`
- QR inner: `padding: 10px` -> `var(--space-md)`
- Expand button: padding tokenized
- Action buttons: `gap: 10px` -> `var(--space-md)`
- Primary button: `height: 48px` -> `var(--control-h)`
- Secondary button: `height: 48px` -> `var(--control-h)`
- Button gaps: `6px` -> `var(--space-sm)`
- Home indicator: `margin: 12px auto` -> `var(--space-md) auto`

### SendView.vue
- Result icon: `80px` -> `var(--icon-size-xl)`
- From info: `gap: 4px` -> `var(--space-xs)`

### ManageTokensView.vue
- Empty icon: `80px` -> `var(--icon-size-xl)`

---

## 3. Token Reference

### Compact Mode (`data-density="compact"`)

| Token | Value |
|-------|-------|
| `--header-h` | 44px |
| `--row-h` | 44px |
| `--control-h` | 44px |
| `--icon-btn-size` | 32px |
| `--section-gap` | 16px |
| `--icon-size-xl` | 64px |

### Comfy Mode (`data-density="comfy"`)

| Token | Value |
|-------|-------|
| `--header-h` | 56px |
| `--row-h` | 52px |
| `--control-h` | 52px |
| `--icon-btn-size` | 40px |
| `--section-gap` | 24px |
| `--icon-size-xl` | 80px |

---

## 4. Remaining Hardcodes (Low Priority)

These are intentional or decorative:

| File | Value | Reason |
|------|-------|--------|
| `ActivityRow.vue` | `gap: 4px, 6px, 8px` | Fine typography spacing |
| `ActivityRow.vue` | `10px` status dot | Intentional small indicator |
| `ActivityList.vue` | Skeleton heights | Animation elements |
| `PinInput.vue` | Keypad sizing | Fixed numpad layout |
| `BottomNav.vue` | `64px` QR button | Design-specific prominent button |
| `NetworkChip.vue` | `8px` dot | Status indicator |
| Various | `gap: 1px, 2px` | Micro typography gaps |

---

## 5. Verification

### Console Script
```javascript
['compact', 'comfy'].forEach(mode => {
  document.documentElement.dataset.density = mode;
  const style = getComputedStyle(document.documentElement);
  console.log(`=== ${mode.toUpperCase()} ===`);
  console.log('--control-h:', style.getPropertyValue('--control-h'));
  console.log('--row-h:', style.getPropertyValue('--row-h'));
  console.log('--icon-size-xl:', style.getPropertyValue('--icon-size-xl'));

  ['.tab-item', '.btn-primary', '.asset-row', '.activity-row'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) console.log(`${sel}: ${Math.round(el.getBoundingClientRect().height)}px`);
  });
});
```

### Expected Results

| Element | Compact | Comfy |
|---------|---------|-------|
| `.tab-item` | 44px | 52px |
| `.asset-row` | 44px | 52px |
| `.activity-row` | 44px | 52px |
| `.btn-primary` (ReceiveModal) | 44px | 52px |
| `.result-icon` (SendView) | 64px | 80px |
| `.empty-icon` (ManageTokens) | 64px | 80px |

---

## 6. Acceptance Criteria

1. Toggle Settings > Density Mode between Compact and Comfy
2. Navigate to Home (`/user`) - tabs, asset rows, activity rows should resize
3. Open Receive modal - buttons should be 44px (compact) or 52px (comfy)
4. Navigate to Send (`/send`) - result icon should be 64px (compact) or 80px (comfy)
5. Navigate to Manage Tokens - empty state icon should resize

**All controls now respond to density mode selection.**
