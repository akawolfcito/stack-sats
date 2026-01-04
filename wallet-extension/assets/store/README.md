# Chrome Web Store Assets

## Required Assets for Submission

### Status Checklist

| Asset | Required | Spec | Status |
|-------|----------|------|--------|
| Store Icon | Yes | 128x128 PNG | icon_128.png (from ironvault.png) |
| Screenshot 1 | Yes | 1280x800 or 640x400 | NEEDS_INPUT |
| Screenshot 2 | Recommended | 1280x800 or 640x400 | NEEDS_INPUT |
| Screenshot 3 | Recommended | 1280x800 or 640x400 | NEEDS_INPUT |
| Small Promo Tile | Required | 440x280 PNG/JPEG | NEEDS_INPUT |
| Large Promo Tile | Optional | 920x680 | Optional |
| Marquee | Optional | 1400x560 | Optional |
| YouTube Video | Dashboard field | Unlisted OK | NEEDS_INPUT |

---

## Icon (icon_128.png)

**Status:** Available (copied from ironvault.png)

**Requirements:**
- 128x128 pixels
- PNG format
- No transparency issues
- Clear at small sizes

---

## Screenshots (NEEDS_INPUT)

**Requirements:**
- Minimum 1, recommended 3-5
- Size: 1280x800 or 640x400 pixels
- PNG or JPEG
- Must show actual extension UI

### Recommended Screenshots to Capture

1. **Wallet Home Screen**
   - Show STX balance
   - Show addresses
   - Show tokens section
   - Caption: "Manage your STX and tokens in one place"

2. **Unlock Screen**
   - Show PIN entry
   - Caption: "Secure access with 6-digit PIN"

3. **Send Transaction**
   - Show send form with recipient and amount
   - Caption: "Send STX with a simple interface"

4. **dApp Connection**
   - Show approval popup
   - Show origin URL
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

**Method 2: Browser Extension**
Use a screenshot extension set to capture at 1280x800 or 640x400.

**Method 3: Manual Resize**
1. Capture popup
2. Place on background matching your design
3. Export at required dimensions

---

## Small Promo Tile (NEEDS_INPUT)

**Requirements:**
- 440x280 pixels
- PNG or JPEG
- Include extension name/logo
- Eye-catching design

**Suggested Design:**
- Dark background (#1a1a1a)
- Extension icon centered or left
- "Stacks Wallet" text
- "Bitcoin Layer 2" tagline

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

---

## File Naming Convention

```
icon_128.png           # Store icon
screenshot_1_home.png  # Wallet home
screenshot_2_unlock.png # Unlock screen
screenshot_3_send.png  # Send transaction
screenshot_4_connect.png # dApp connection
screenshot_5_network.png # Network selection
promo_440x280.png      # Small promo tile
```

---

## Upload Checklist

Before submitting to Chrome Web Store:

- [ ] icon_128.png uploaded (128x128)
- [ ] At least 1 screenshot uploaded (1280x800 or 640x400)
- [ ] Small promo tile uploaded (440x280)
- [ ] All screenshots have captions
- [ ] Preview verified in store listing
- [ ] YouTube video link added (if available)

---

## NEEDS_INPUT Summary

| Item | Action Required |
|------|-----------------|
| Screenshots | Capture 3-5 screenshots of extension UI |
| Small promo tile | Create 440x280 promotional image |
| YouTube video | Record demo video (optional but recommended) |
| Contact email | Provide support email for store listing |
| GitHub repo URL | Provide public repository URL |
