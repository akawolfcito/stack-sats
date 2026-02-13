# Chrome Web Store Assets

## Required Assets for Submission

### Status Checklist

| Asset | Required | Spec | Status | File |
|-------|----------|------|--------|------|
| Store Icon | Yes | 128x128 PNG | ✅ READY | `icon_128.png` |
| Screenshot 1 | Yes | 1280x800 | ✅ READY | `screenshot_1.png` |
| Screenshot 2 | Recommended | 1280x800 | OPTIONAL | - |
| Small Promo Tile | Required | 440x280 PNG | ✅ READY | `promo_440x280.png` |
| YouTube Video | Dashboard field | Unlisted OK | NEEDS_INPUT | See below |

---

## Icon (icon_128.png)

**Status:** ✅ Ready

**Source:** `internal-docs/denvault-icon.png` (1024x1024)
**Resized:** 128x128 for store, also generated 16/32/48 for manifest

**Requirements:**
- 128x128 pixels ✅
- PNG format ✅
- No transparency issues ✅
- Clear at small sizes ✅

---

## Screenshot (screenshot_1.png)

**Status:** ✅ Ready (composite placeholder)

**Current:** Composite of Add Wallet + Receive + Send screens
**Dimensions:** 1280x800 ✅

**To Replace with Real Screenshots:**

Capture these screens at 1280x800:

1. **Wallet Home Screen**
   - Show STX balance
   - Show addresses
   - Caption: "Manage your STX and tokens in one place"

2. **Unlock Screen**
   - Show PIN entry
   - Caption: "Secure access with 6-digit PIN"

3. **Send Transaction**
   - Show send form
   - Caption: "Send STX with a simple interface"

4. **dApp Connection**
   - Show approval popup
   - Caption: "Connect securely to Stacks dApps"

5. **Network Selection**
   - Show network menu
   - Caption: "Switch between Mainnet, Testnet, and Devnet"

### How to Capture Screenshots

**Method 1: Chrome DevTools**
1. Open extension popup
2. Right-click → Inspect
3. In DevTools, press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Win)
4. Type "screenshot" and select "Capture full size screenshot"

**Method 2: Manual Composite**
1. Capture popup screens
2. Use ImageMagick montage to combine:
   ```bash
   montage screen1.png screen2.png screen3.png -tile 3x1 -geometry +20+0 -background '#1a1a2e' out.png
   magick out.png -resize 1280x800! screenshot_1.png
   ```

---

## Small Promo Tile (promo_440x280.png)

**Status:** ✅ Ready

**Dimensions:** 440x280 ✅
**Design:** DenVault icon centered on dark background with text

---

## YouTube Video (NEEDS_INPUT)

**Requirements:**
- Can be unlisted
- Should demonstrate key features
- 1-3 minutes recommended

**Suggested Content:**
1. Extension installation
2. Create/import wallet
3. View balance
4. Send transaction
5. Connect to dApp

**Placeholder URL:** `[NEEDS_INPUT: YouTube demo URL]`

---

## File Inventory

```
assets/store/
├── icon_128.png          # 128x128 - Store icon ✅
├── icon_128_original.png # 1024x1024 - Backup
├── screenshot_1.png      # 1280x800 - Main screenshot ✅
├── promo_440x280.png     # 440x280 - Small promo tile ✅
└── README.md             # This file
```

---

## Upload Checklist

Before submitting to Chrome Web Store:

- [x] icon_128.png uploaded (128x128)
- [x] At least 1 screenshot uploaded (1280x800)
- [x] Small promo tile uploaded (440x280)
- [ ] All screenshots have captions (add in CWS dashboard)
- [ ] Preview verified in store listing
- [ ] YouTube video link added (optional)

---

## NEEDS_INPUT Summary

| Item | Action Required | Status |
|------|-----------------|--------|
| YouTube video | Record demo video | OPTIONAL |
| Better screenshots | Replace composite with polished screens | RECOMMENDED |

---

## Verification Script

Run to verify assets meet CWS requirements:

```bash
bash scripts/verify-store-assets.sh
```
