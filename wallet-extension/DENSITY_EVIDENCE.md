# Density System Evidence Pack

## 1. Contract Definition

### Supported Values

| Value | Selector | Behavior |
|-------|----------|----------|
| `compact` | `:root[data-density="compact"]` | User explicit choice - always wins |
| `comfy` | `:root[data-density="comfy"]` | User explicit choice - always wins |
| `auto` | `:root[data-density="auto"]` OR `:root:not([data-density])` | Viewport-responsive |

### Auto Mode Triggers

```css
@media (max-width: 480px), (max-height: 640px) {
  /* Applies compact tokens */
}
```

- **Popup** (400x600): Auto mode = Compact
- **Sidepanel** (400x800+): Auto mode = Comfy

---

## 2. Token Comparison Table

| Token | Compact | Comfy | Delta |
|-------|---------|-------|-------|
| `--header-h` | 44px | 56px | -12px |
| `--row-h` | 44px | 52px | -8px |
| `--control-h` | 44px | 52px | -8px |
| `--icon-btn-size` | 32px | 40px | -8px |
| `--section-gap` | 16px | 24px | -8px |
| `--card-pad-x` | 12px | 16px | -4px |
| `--card-pad-y` | 8px | 12px | -4px |
| `--icon-size-xl` | 64px | 80px | -16px |

---

## 3. Measurement Script

Paste in browser DevTools console to measure all elements:

```javascript
// DENSITY EVIDENCE MEASUREMENT SCRIPT
(function() {
  const results = { compact: {}, comfy: {} };

  function measure(mode) {
    document.documentElement.dataset.density = mode;

    // Force reflow
    void document.documentElement.offsetHeight;

    const style = getComputedStyle(document.documentElement);
    const data = {};

    // Token values
    data['--control-h'] = style.getPropertyValue('--control-h').trim();
    data['--row-h'] = style.getPropertyValue('--row-h').trim();
    data['--header-h'] = style.getPropertyValue('--header-h').trim();
    data['--icon-btn-size'] = style.getPropertyValue('--icon-btn-size').trim();
    data['--section-gap'] = style.getPropertyValue('--section-gap').trim();
    data['--card-pad-x'] = style.getPropertyValue('--card-pad-x').trim();
    data['--card-pad-y'] = style.getPropertyValue('--card-pad-y').trim();
    data['--icon-size-xl'] = style.getPropertyValue('--icon-size-xl').trim();

    // Actual element measurements
    const elements = {
      '.tab-item': 'SegmentedTab',
      '.asset-row': 'AssetRow',
      '.activity-row': 'ActivityRow',
      '.list-row': 'ListRow',
      '.action-btn': 'HomeActionBtn',
      '.cta-btn': 'StickyCTA',
      '.btn-primary': 'PrimaryBtn',
      '.form-input': 'FormInput',
      '.account-item': 'AccountItem',
      '.result-icon': 'ResultIcon',
      '.empty-icon': 'EmptyIcon'
    };

    Object.entries(elements).forEach(([selector, name]) => {
      const el = document.querySelector(selector);
      if (el) {
        const rect = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        data[`${name}.height`] = Math.round(rect.height) + 'px';
        data[`${name}.padding`] = cs.padding;
        data[`${name}.fontSize`] = cs.fontSize;
      }
    });

    results[mode] = data;
  }

  measure('compact');
  measure('comfy');

  console.log('\n========== DENSITY EVIDENCE ==========\n');
  console.log('Mode: COMPACT');
  console.table(results.compact);
  console.log('\nMode: COMFY');
  console.table(results.comfy);

  // Delta report
  console.log('\n========== DELTA REPORT ==========');
  Object.keys(results.compact).forEach(key => {
    const c = parseInt(results.compact[key]);
    const f = parseInt(results.comfy[key]);
    if (!isNaN(c) && !isNaN(f) && c !== f) {
      const delta = c - f;
      console.log(`${key}: ${c}px → ${f}px (${delta > 0 ? '+' : ''}${delta}px)`);
    }
  });

  // Restore to auto
  document.documentElement.dataset.density = 'auto';

  return results;
})();
```

---

## 4. Screenshot Capture Instructions

### Setup
1. Open extension popup or panel
2. Open DevTools (right-click > Inspect)

### For Each View

#### /user (Home - Assets Tab)
```javascript
// COMPACT
document.documentElement.dataset.density = 'compact';
// Take screenshot → save as: evidence/user-assets-compact.png

// COMFY
document.documentElement.dataset.density = 'comfy';
// Take screenshot → save as: evidence/user-assets-comfy.png
```

#### /user (Home - Activity Tab)
```javascript
// Click Activity tab first, then:
document.documentElement.dataset.density = 'compact';
// Screenshot → evidence/user-activity-compact.png

document.documentElement.dataset.density = 'comfy';
// Screenshot → evidence/user-activity-comfy.png
```

#### /send
```javascript
document.documentElement.dataset.density = 'compact';
// Screenshot → evidence/send-compact.png

document.documentElement.dataset.density = 'comfy';
// Screenshot → evidence/send-comfy.png
```

#### ReceiveModal (open first)
```javascript
document.documentElement.dataset.density = 'compact';
// Screenshot → evidence/receive-compact.png

document.documentElement.dataset.density = 'comfy';
// Screenshot → evidence/receive-comfy.png
```

#### AccountSwitcher (click to open)
```javascript
document.documentElement.dataset.density = 'compact';
// Screenshot → evidence/account-compact.png

document.documentElement.dataset.density = 'comfy';
// Screenshot → evidence/account-comfy.png
```

#### /manage-tokens
```javascript
document.documentElement.dataset.density = 'compact';
// Screenshot → evidence/manage-compact.png

document.documentElement.dataset.density = 'comfy';
// Screenshot → evidence/manage-comfy.png
```

#### /add-token
```javascript
document.documentElement.dataset.density = 'compact';
// Screenshot → evidence/add-token-compact.png

document.documentElement.dataset.density = 'comfy';
// Screenshot → evidence/add-token-comfy.png
```

---

## 5. Expected Measurements

### CTA Button (StickyCTA, action buttons)
| Property | Compact | Comfy |
|----------|---------|-------|
| height | 44px | 52px |
| padding | 0 16px | 0 16px |
| fontSize | 14px | 16px |

### SegmentedTab (.tab-item)
| Property | Compact | Comfy |
|----------|---------|-------|
| min-height | 44px | 52px |

### AssetRow
| Property | Compact | Comfy |
|----------|---------|-------|
| min-height | 44px | 52px |
| padding | 8px 12px | 12px 16px |

### ActivityRow
| Property | Compact | Comfy |
|----------|---------|-------|
| min-height | 44px | 52px |
| padding | 8px 12px | 12px 16px |

### FormInput
| Property | Compact | Comfy |
|----------|---------|-------|
| height | 44px | 52px |
| padding | 0 16px | 0 16px |

### IconButton
| Property | Compact | Comfy |
|----------|---------|-------|
| size | 32px | 40px |

---

## 6. Visual Checklist

After toggling density mode, verify these visual changes:

- [ ] **Tabs**: Height changes noticeably (44px vs 52px)
- [ ] **Rows**: Asset and Activity rows are tighter/looser
- [ ] **Buttons**: CTA buttons are shorter/taller
- [ ] **Icons**: Header icons are smaller/larger
- [ ] **Spacing**: Gaps between sections change
- [ ] **Empty states**: Large icons resize (64px vs 80px)
- [ ] **Modal buttons**: ReceiveModal buttons resize

---

## 7. Verification Status

| View | Compact Verified | Comfy Verified | Notes |
|------|-----------------|----------------|-------|
| /user (Assets) | [ ] | [ ] | |
| /user (Activity) | [ ] | [ ] | |
| /send | [ ] | [ ] | |
| ReceiveModal | [ ] | [ ] | |
| AccountSwitcher | [ ] | [ ] | |
| /manage-tokens | [ ] | [ ] | |
| /add-token | [ ] | [ ] | |
