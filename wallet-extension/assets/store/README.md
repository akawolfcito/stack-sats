# Chrome Web Store Assets

## Required Assets Checklist

### Icons

| Asset | Size | Format | Status |
|-------|------|--------|--------|
| Store icon | 128x128 | PNG | NEEDS_INPUT |

**Note:** The extension uses `ironvault.png` for all icon sizes. A dedicated 128x128 store icon with higher detail is recommended.

### Screenshots (Minimum 1, Recommended 3-5)

| Screenshot | Size | Description | Status |
|------------|------|-------------|--------|
| Screenshot 1 | 1280x800 or 640x400 | Wallet Home | NEEDS_INPUT |
| Screenshot 2 | 1280x800 or 640x400 | Send Transaction | NEEDS_INPUT |
| Screenshot 3 | 1280x800 or 640x400 | dApp Connection | NEEDS_INPUT |
| Screenshot 4 | 1280x800 or 640x400 | Network Selection | NEEDS_INPUT |
| Screenshot 5 | 1280x800 or 640x400 | Token View | NEEDS_INPUT |

### Promotional Tiles

| Asset | Size | Format | Status |
|-------|------|--------|--------|
| Small promo tile | 440x280 | PNG/JPEG | NEEDS_INPUT |
| Marquee promo | 1400x560 | PNG/JPEG | Optional |

### Video

| Asset | Format | Status |
|-------|--------|--------|
| YouTube video | Unlisted OK | Optional |

---

## Screenshot Plan

### Screenshot 1: Wallet Home
**What to capture:**
- Full wallet popup showing:
  - Wallet name
  - STX address
  - STX balance
  - BTC address
  - Tokens section (expanded)

**Suggested copy:**
> "Manage your STX and tokens in one place"

### Screenshot 2: Send Transaction
**What to capture:**
- Send form with:
  - Recipient address field
  - Amount field
  - Fee display
  - Review button

**Suggested copy:**
> "Send STX with a simple, secure interface"

### Screenshot 3: dApp Connection
**What to capture:**
- Connection approval popup showing:
  - dApp origin/URL
  - Request method
  - Approve/Reject buttons

**Suggested copy:**
> "Connect securely to your favorite dApps"

### Screenshot 4: Network Selection
**What to capture:**
- Settings/menu with network options:
  - Mainnet
  - Testnet
  - Devnet

**Suggested copy:**
> "Switch between Mainnet, Testnet, and Devnet"

### Screenshot 5: SIP-010 Tokens
**What to capture:**
- Token list showing:
  - Token icons
  - Token names/symbols
  - Balances

**Suggested copy:**
> "View all your SIP-010 fungible tokens"

---

## Design Guidelines

### Colors
- Primary: `#646cff` (button background)
- Background: `#1a1a1a` (dark mode)
- Text: `#ffffff` (primary)
- Text secondary: `#888888`

### Typography
- Font: System default (Inter-like sans-serif)
- Headings: 700 weight
- Body: 400 weight

### Screenshots Tips
1. Use a clean browser with no other extensions visible
2. Ensure testnet/devnet with test data
3. Show realistic (but fake) balances
4. Capture at 2x resolution for retina displays
5. Add subtle shadows/borders if placing on colored background

---

## How to Capture Screenshots

### macOS

```bash
# Full screen capture
Cmd + Shift + 3

# Selection capture
Cmd + Shift + 4

# Window capture
Cmd + Shift + 4, then Space
```

### Extension Popup

1. Open extension popup
2. Right-click → Inspect
3. In DevTools, click device toolbar (mobile icon)
4. Set custom resolution: 640x400 or 1280x800
5. Capture with browser DevTools screenshot feature

### Chrome DevTools

1. Open popup
2. Right-click → Inspect
3. Press `Cmd+Shift+P` (Mac) or `Ctrl+Shift+P` (Win)
4. Type "screenshot"
5. Select "Capture node screenshot"

---

## Promotional Copy

### Short Description (132 chars max)
```
Educational Stacks wallet extension for developers. Supports STX transfers, SIP-010 tokens, and dApp connections on Bitcoin Layer 2.
```

### Taglines for Tiles
- "Your Gateway to Stacks"
- "Bitcoin Layer 2 Wallet"
- "STX + Tokens + dApps"

---

## File Naming Convention

```
stacks-wallet-screenshot-1-home.png
stacks-wallet-screenshot-2-send.png
stacks-wallet-screenshot-3-connect.png
stacks-wallet-screenshot-4-network.png
stacks-wallet-screenshot-5-tokens.png
stacks-wallet-promo-small.png
stacks-wallet-promo-marquee.png
stacks-wallet-icon-128.png
```

---

## Upload Checklist

- [ ] Icon 128x128 uploaded
- [ ] At least 1 screenshot uploaded
- [ ] All screenshots have captions
- [ ] Small promo tile uploaded (if using)
- [ ] Video link added (if using)
- [ ] Preview tested in store listing

---

*Place completed assets in this directory before store submission.*
