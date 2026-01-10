# Density Coverage Report

## 1. Density Token Audit

### Token Values by Mode

| Token | Compact (44px viewport) | Comfortable (default) | Delta |
|-------|------------------------|----------------------|-------|
| `--header-h` | 44px | 56px | -12px (21%) |
| `--row-h` | 44px | 52px | -8px (15%) |
| `--control-h` | 44px | 52px | -8px (15%) |
| `--icon-btn-size` | 32px | 40px | -8px (20%) |
| `--section-gap` | 16px | 24px | -8px (33%) |
| `--card-pad-x` | 12px | 16px | -4px (25%) |
| `--card-pad-y` | 8px | 12px | -4px (33%) |

### Viewport Behavior

| Context | Viewport | Auto Mode | Compact Forced | Comfy Forced |
|---------|----------|-----------|----------------|--------------|
| Popup | 400x600 | Compact | Compact | Comfortable |
| Sidepanel | 400x800 | Comfortable | Compact | Comfortable |

---

## 2. Consumption Coverage Report

### Priority 1 (HIGH) - Row Components Missing min-height

| File | Current | Should Be | Impact |
|------|---------|-----------|--------|
| `AssetRow.vue:46` | No min-height | `min-height: var(--row-h)` | Assets list rows inconsistent |
| `ActivityRow.vue:75` | No min-height | `min-height: var(--row-h)` | Activity list rows inconsistent |
| `AccountSwitcher.vue:252` | No min-height | `min-height: var(--row-h)` | Account items inconsistent |

### Priority 2 (HIGH) - Padding/Gap Hardcodes

| File | Line | Hardcode | Should Be |
|------|------|----------|-----------|
| `ActivityRow.vue` | 78 | `gap: 12px` | `gap: var(--space-md)` |
| `ActivityRow.vue` | 80 | `padding: 14px 16px` | `padding: var(--card-pad-y) var(--card-pad-x)` |
| `AccountSwitcher.vue` | 126 | `gap: 8px` | `gap: var(--space-sm)` |
| `AccountSwitcher.vue` | 127 | `padding: 6px 12px` | `padding: var(--space-sm) var(--space-md)` |
| `AccountSwitcher.vue` | 212 | `padding: 14px 16px` | `padding: var(--card-pad-y) var(--card-pad-x)` |
| `AccountSwitcher.vue` | 255 | `gap: 10px` | `gap: var(--space-md)` |
| `AccountSwitcher.vue` | 257 | `padding: 12px` | `padding: var(--space-md)` |
| `AccountSwitcher.vue` | 314 | `padding: 8px` | `padding: var(--space-sm)` |
| `AccountSwitcher.vue` | 321 | `padding: 12px` | `padding: var(--space-md)` |

### Priority 3 (MEDIUM) - Button/Icon Size Hardcodes

| File | Line | Hardcode | Should Be |
|------|------|----------|-----------|
| `AccountSwitcher.vue` | 228-229 | `width: 28px; height: 28px` | `width: var(--icon-btn-size); height: var(--icon-btn-size)` |
| `ActivityRow.vue` | 104-105 | `width: 10px; height: 10px` | Keep (status dot - intentional small) |

### Priority 4 (LOW) - Font Size Hardcodes

| File | Line | Hardcode | Note |
|------|------|----------|------|
| `AssetRow.vue` | 81 | `font-size: 16px` | Consider `--font-size-base` |
| `AssetRow.vue` | 94,100,115,122 | Various px | Consider font tokens |
| `ActivityRow.vue` | 147,152,168,187,194 | Various px | Consider font tokens |
| `AccountSwitcher.vue` | 166,174,218,234,295,301,308,326 | Various px | Consider font tokens |

---

## 3. Row Unification Plan

### Current State

| Component | Uses min-height? | Uses --row-h? | Uses padding tokens? |
|-----------|-----------------|---------------|---------------------|
| `ListRow.vue` | ✅ `min-height: var(--row-h)` | ✅ | ✅ `var(--card-pad-y) var(--card-pad-x)` |
| `AssetRow.vue` | ❌ None | ❌ | ✅ `var(--card-pad-y) var(--card-pad-x)` |
| `ActivityRow.vue` | ❌ None | ❌ | ❌ `14px 16px` |
| `TokenRow.vue` | ✅ `min-height: var(--row-h)` | ✅ | ⚠️ `var(--space-sm) var(--space-md)` |
| `AccountSwitcher` items | ❌ None | ❌ | ❌ `12px` |

### Recommended Refactors

#### AssetRow.vue
```css
.asset-row {
  /* ADD */
  min-height: var(--row-h);
}
```

#### ActivityRow.vue
```css
.activity-row {
  /* CHANGE */
  gap: var(--space-md);           /* was: 12px */
  padding: var(--card-pad-y) var(--card-pad-x);  /* was: 14px 16px */
  border-radius: var(--radius-md); /* was: 12px */
  /* ADD */
  min-height: var(--row-h);
}
```

#### AccountSwitcher.vue (account-item)
```css
.account-item {
  /* CHANGE */
  gap: var(--space-md);           /* was: 10px */
  padding: var(--space-md);       /* was: 12px */
  border-radius: var(--radius-md); /* was: 12px */
  /* ADD */
  min-height: var(--row-h);
}
```

---

## 4. Verification Console Script

Paste in browser DevTools to verify density changes:

```javascript
// Density Verification Script
(function() {
  const measures = {};

  function measure(mode) {
    if (mode === 'auto') {
      delete document.documentElement.dataset.density;
    } else {
      document.documentElement.dataset.density = mode;
    }

    const style = getComputedStyle(document.documentElement);
    const data = {
      '--header-h': style.getPropertyValue('--header-h').trim(),
      '--row-h': style.getPropertyValue('--row-h').trim(),
      '--control-h': style.getPropertyValue('--control-h').trim(),
      '--icon-btn-size': style.getPropertyValue('--icon-btn-size').trim(),
      '--section-gap': style.getPropertyValue('--section-gap').trim(),
      '--card-pad-x': style.getPropertyValue('--card-pad-x').trim(),
      '--card-pad-y': style.getPropertyValue('--card-pad-y').trim(),
    };

    // Measure actual elements
    const selectors = {
      'AssetRow': '.asset-row',
      'ActivityRow': '.activity-row',
      'ListRow': '.list-row',
      'AccountItem': '.account-item',
    };

    Object.entries(selectors).forEach(([name, sel]) => {
      const el = document.querySelector(sel);
      if (el) {
        data[name + ' height'] = Math.round(el.getBoundingClientRect().height) + 'px';
      }
    });

    measures[mode] = data;
  }

  measure('compact');
  measure('comfortable');

  console.log('\n=== DENSITY VERIFICATION ===\n');
  console.table(measures);

  // Show delta
  console.log('\n=== DELTA (compact - comfortable) ===');
  Object.keys(measures.compact).forEach(key => {
    const c = parseInt(measures.compact[key]);
    const f = parseInt(measures.comfortable[key]);
    if (!isNaN(c) && !isNaN(f)) {
      console.log(`${key}: ${c - f}px (${Math.round((c-f)/f*100)}%)`);
    }
  });

  // Restore auto
  delete document.documentElement.dataset.density;
})();
```

---

## 5. Expected Before/After

### Home Assets List (AssetRow)

| Property | Before Fix (compact) | After Fix (compact) |
|----------|---------------------|---------------------|
| Row height | ~56px (no min-height) | 44px |
| Icon size | 32px ✅ | 32px ✅ |
| Padding | 8px 12px ✅ | 8px 12px ✅ |

### Activity List (ActivityRow)

| Property | Before Fix (compact) | After Fix (compact) |
|----------|---------------------|---------------------|
| Row height | ~50px (content-based) | 44px |
| Gap | 12px (hardcoded) | 12px (token) |
| Padding | 14px 16px (hardcoded) | 8px 12px (token) |

### Account Switcher (account-item)

| Property | Before Fix (compact) | After Fix (compact) |
|----------|---------------------|---------------------|
| Row height | ~48px (content-based) | 44px |
| Close button | 28px (hardcoded) | 32px (token) |
| Padding | 12px (hardcoded) | 12px (token) |
