# Home UI Consistency Sweep - Evidence

This document provides evidence of the UI unification work done on the Home (/user) screen to match the Settings pattern.

## Changes Made

### 1. SegmentedTabs - Matches Density Selector

**Before:**
- White/transparent indicator
- Large padding
- Muted text on active

**After:**
- Accent color (green) indicator background
- Compact padding (3px container, 36px height)
- Dark text on active (matches density selector exactly)

```css
/* Key style changes */
.segmented-tabs {
  background: var(--color-bg-elevated);
  border-radius: var(--radius-md);
  padding: 3px;
  gap: 2px;
}

.tab-indicator {
  background: var(--color-accent-primary);
}

.tab-item--active {
  color: #0a0a0a; /* Dark text on green */
}
```

### 2. Assets Section - Card Stack Pattern

**Before:**
- Floating rows with gaps
- Separate section header
- Inconsistent styling

**After:**
- Wrapped in `ListGroup` component
- Card background with border
- Dividers between rows
- Unified header slot pattern

```vue
<ListGroup title="Assets">
  <template #headerAction>
    <div class="section-actions">
      <button class="manage-btn">Manage</button>
      <button class="refresh-btn">...</button>
    </div>
  </template>
  <AssetList :items="assetItems" />
</ListGroup>
```

### 3. Activity Section - Card Stack Pattern

**Before:**
- Floating rows with gaps
- Separate section header

**After:**
- Wrapped in `ListGroup` component
- Same card styling as Assets/Settings

```vue
<ListGroup title="Recent Activity">
  <template #headerAction>
    <button class="refresh-btn">...</button>
  </template>
  <ActivityList :items="activityItems" />
</ListGroup>
```

### 4. Tokens Section - Card Stack Pattern

**Before:**
- Floating `.token-item` cards with gaps
- Custom standalone styling

**After:**
- Wrapped in `ListGroup` component
- `.token-row` buttons inside card
- Same row pattern as ListRow

### 5. Row Components Updated

All row components (AssetRow, ActivityRow) now use:
- `gap: var(--space-sm)` (same as ListRow)
- `transition: background var(--transition-fast)`
- Hover: `rgba(255, 255, 255, 0.03)`
- Active: `rgba(255, 255, 255, 0.05)`

## Density Token Usage

| Component | Token | Compact | Comfy |
|-----------|-------|---------|-------|
| AssetRow | `--row-h` | 44px | 52px |
| ActivityRow | `--row-h` | 44px | 52px |
| Token row | `--row-h` | 44px | 52px |
| SegmentedTabs | Fixed 36px | 36px | 36px |
| Buttons | `--control-h` | 44px | 52px |

## Verification Checklist

### Visual Consistency
- [x] SegmentedTabs matches density selector style
- [x] Assets section has card container
- [x] Tokens section has card container
- [x] Activity section has card container
- [x] All rows use same hover/active states
- [x] Dividers appear between rows (from ListGroup)

### Density Response
- [x] Rows resize with density mode
- [x] Send/Receive buttons resize with density
- [x] Header buttons use `--icon-btn-size`

### Pattern Alignment with Settings
- [x] Same ListGroup component
- [x] Same header slot pattern (title + headerAction)
- [x] Same row padding (`--card-pad-y` / `--card-pad-x`)
- [x] Same border and background colors

## Files Modified

| File | Changes |
|------|---------|
| `src/components/SegmentedTabs.vue` | Accent color indicator, compact sizing |
| `src/views/UserHomeView.vue` | ListGroup wrappers, token-row pattern |
| `src/components/AssetList.vue` | Remove gaps (dividers from parent) |
| `src/components/AssetRow.vue` | Unified hover/transition styles |
| `src/components/activity/ActivityList.vue` | Remove gaps |
| `src/components/activity/ActivityRow.vue` | Unified hover/transition styles |

## DevTools Verification

```javascript
// Check ListGroup cards are present
document.querySelectorAll('.list-group-items').length
// Expected: 2-3 (Assets, Tokens if present, Activity)

// Check density tokens applied
const styles = getComputedStyle(document.documentElement);
console.table({
  density: document.documentElement.dataset.density,
  rowH: styles.getPropertyValue('--row-h'),
  cardPadY: styles.getPropertyValue('--card-pad-y'),
  cardPadX: styles.getPropertyValue('--card-pad-x'),
});
```

## Screenshots Reference

To capture before/after screenshots:

1. Navigate to `/user` (Home)
2. Open DevTools → Device toolbar → Set to 400x600 (popup size)
3. Toggle density in Settings between Compact/Comfy
4. Compare:
   - Tab indicator color (should be green)
   - Card containers around lists
   - Row heights and spacing
