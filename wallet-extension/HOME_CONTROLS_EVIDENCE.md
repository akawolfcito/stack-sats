# Home Controls Polish - Evidence

This document provides evidence of the pro polish applied to SegmentedTabs and Home action buttons.

## Changes Summary

### 1. SegmentedTabs - Subtle Accent-Tinted Thumb

**Before:**
- Solid neon green indicator (`var(--color-accent-primary)`)
- Dark text on green (`#0a0a0a`)
- Fixed 36px height
- `border-radius: var(--radius-md)`

**After:**
- Subtle accent-tinted background (`var(--color-accent-primary-muted)`)
- Accent border (`rgba(215, 248, 46, 0.25)`)
- White text on selected (`var(--color-text-primary)`)
- Height: `calc(var(--row-h) - 8px)` (density-aware)
- `border-radius: var(--radius-pill)`
- Focus-visible outline for accessibility

```css
.tab-indicator {
  background: var(--color-accent-primary-muted);
  border: 1px solid rgba(215, 248, 46, 0.25);
  border-radius: calc(var(--radius-pill) - 4px);
}

.tab-item--active {
  color: var(--color-text-primary);
}
```

### 2. Button Primary - Subtle Glow

**Before:**
- Heavy glow: `0 0 20px rgba(215, 248, 46, 0.25)`
- Hover: `0 0 35px rgba(215, 248, 46, 0.4)` (halo effect)

**After:**
- Subtle shadow: `0 2px 8px rgba(215, 248, 46, 0.15)`
- Hover: `0 4px 12px rgba(215, 248, 46, 0.25)`
- Active: `0 1px 4px rgba(215, 248, 46, 0.1)` (pressed feel)

### 3. Button Secondary - Dark Fill + Border

**Before:**
- `background: transparent`
- Empty outline appearance

**After:**
- `background: var(--color-bg-card)` (#1D1D1C)
- `border: 1px solid var(--color-border)`
- Hover: `background: var(--color-bg-card-hover)` (#252524)
- Solid, weighted appearance

## Verification

### DevTools Console Snippet

```javascript
// Check SegmentedTabs computed styles
const tabs = document.querySelector('.segmented-tabs');
const tabItem = document.querySelector('.tab-item');
const indicator = document.querySelector('.tab-indicator');

if (tabs) {
  const tabsStyle = getComputedStyle(tabs);
  const itemStyle = getComputedStyle(tabItem);
  const indicatorStyle = getComputedStyle(indicator);

  console.table({
    'Tabs Container': {
      background: tabsStyle.background,
      borderRadius: tabsStyle.borderRadius,
      padding: tabsStyle.padding,
    },
    'Tab Item': {
      height: itemStyle.height,
      color: itemStyle.color,
    },
    'Indicator': {
      background: indicatorStyle.background,
      border: indicatorStyle.border,
    },
  });
}

// Check Button computed styles
const primaryBtn = document.querySelector('.btn--primary');
const secondaryBtn = document.querySelector('.btn--secondary');

if (primaryBtn) {
  const pStyle = getComputedStyle(primaryBtn);
  const sStyle = secondaryBtn ? getComputedStyle(secondaryBtn) : {};

  console.table({
    'Primary Button': {
      height: pStyle.height,
      background: pStyle.background,
      boxShadow: pStyle.boxShadow,
      borderRadius: pStyle.borderRadius,
    },
    'Secondary Button': {
      height: sStyle.height || 'N/A',
      background: sStyle.background || 'N/A',
      border: sStyle.border || 'N/A',
      borderRadius: sStyle.borderRadius || 'N/A',
    },
  });
}
```

### Expected Values by Density

| Component | Property | Compact | Comfy |
|-----------|----------|---------|-------|
| **SegmentedTabs** | container height | ~44px | ~52px |
| Tab item | height | 36px | 44px |
| **Button Primary** | height | 44px | 52px |
| **Button Secondary** | height | 44px | 52px |
| Button | border-radius | 9999px | 9999px |

## Files Modified

| File | Changes |
|------|---------|
| `src/components/SegmentedTabs.vue` | Subtle thumb, pill radius, density height, focus state |
| `src/components/ui/Button.vue` | Subtle glow, dark fill secondary |

## Visual Checklist

- [x] Tabs indicator is subtle accent-tinted (not solid neon)
- [x] Selected tab text is white (not dark)
- [x] Tabs have pill radius
- [x] Tabs height responds to density
- [x] Primary button glow is subtle (not a halo)
- [x] Secondary button has dark fill (not transparent)
- [x] Both buttons use `--control-h` height
- [x] Both buttons use `--radius-pill`
- [x] Focus states are accessible
