# Release Guide

## Chrome Web Store Submission Process

### Prerequisites

- [ ] Google Developer account ($5 one-time fee)
- [ ] All NEEDS_INPUT items resolved
- [ ] Screenshots captured
- [ ] GitHub Pages deployed

---

## Build and Package

### Step 1: Build Extension

```bash
cd wallet-extension
pnpm install
pnpm build
```

### Step 2: Create ZIP for Chrome Web Store

**IMPORTANT:** The ZIP must have `manifest.json` at the ROOT, not inside a folder.

```bash
# From wallet-extension directory
cd dist
zip -r ../stacks-wallet-cws.zip . -x "*.DS_Store"
```

### Step 3: Verify ZIP Structure

```bash
unzip -l stacks-wallet-cws.zip | head -10
```

**Expected output:**
```
Archive:  stacks-wallet-cws.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
      459  01-04-2026 11:28   index.html
     4517  01-04-2026 11:28   background.js
     1408  01-04-2026 11:28   manifest.json  <-- Must be at root!
     ...
```

**If you see `wallet-extension/dist/manifest.json`, the ZIP is WRONG.**

### One-Liner Command

```bash
cd wallet-extension && pnpm build && cd dist && zip -r ../stacks-wallet-cws.zip . -x "*.DS_Store" && cd .. && unzip -l stacks-wallet-cws.zip | head -10
```

---

## Deploy GitHub Pages

### Automatic (GitHub Actions)

1. Push changes to `main` branch
2. GitHub Actions will deploy `/site` to GitHub Pages
3. Wait for deployment to complete

### Manual Setup

1. Go to repository Settings → Pages
2. Source: "Deploy from a branch" or "GitHub Actions"
3. If branch: select `main` and `/site` folder
4. Save and wait for deployment

### Verify URLs

After deployment, verify these URLs work:

- **Homepage:** `https://OWNER.github.io/stack-sats/`
- **Privacy Policy:** `https://OWNER.github.io/stack-sats/privacy.html`
- **Support:** `https://OWNER.github.io/stack-sats/support.html`

---

## Chrome Web Store Dashboard

### Store Listing Tab

| Field | Value |
|-------|-------|
| Extension name | Stacks Wallet - Bitcoin L2 (Educational) |
| Summary | Educational Stacks wallet extension for developers. Supports STX transfers, SIP-010 tokens, and dApp connections on Bitcoin Layer 2. |
| Category | Productivity > Developer Tools |
| Language | English |

### Detailed Description

```
Stacks Wallet is an educational browser extension template for developers building on the Stacks blockchain - Bitcoin's Layer 2 for smart contracts.

⚠️ EDUCATIONAL USE ONLY - This wallet is for learning and testing purposes.

FEATURES:
• Create or import 24-word mnemonic seed phrases
• View STX and Bitcoin addresses derived from the same key
• Send STX tokens with transaction confirmation
• View SIP-010 fungible token balances
• Connect to dApps using @stacks/connect v8 standards
• Support for Mainnet, Testnet, and Devnet networks
• Chrome Side Panel mode for persistent access

SECURITY:
• AES-256-GCM encryption for seed phrase storage
• PBKDF2 key derivation with 100,000 iterations
• 6-digit PIN protection
• Auto-lock after 5 minutes of inactivity
• No data transmitted to external servers

SUPPORTED METHODS (WBIP/SIP-030):
• stx_getAddresses - Get wallet addresses
• stx_transferStx - Transfer STX tokens
• stx_signMessage - Sign messages
• stx_signTransaction - Sign transactions
• stx_callContract - Call smart contracts

Built with Vue 3, TypeScript, and official Stacks.js libraries.

For production use, see Leather or Xverse wallets.
```

### Privacy Tab

**Single Purpose:**
```
This extension enables users to manage Stacks blockchain wallets, view token balances, and authorize transactions for decentralized applications.
```

**Permission Justifications:**

| Permission | Justification |
|------------|---------------|
| storage | Store encrypted wallet data locally using chrome.storage.local. No data is transmitted externally. |
| scripting | Inject wallet provider script (window.StacksWallet) into web pages to enable dApp communication via standard WBIP protocols. |
| tabs | Send transaction responses back to the originating tab after user approves or rejects a request. |
| activeTab | Validate the origin URL of wallet connection requests to prevent phishing and unauthorized access. |
| sidePanel | Provide optional persistent wallet view in Chrome's side panel for improved user experience. |

**Host Permission Justification (https://*/*):**

```
This wallet extension requires broad HTTPS access because users may connect to ANY legitimate Stacks decentralized application (dApp). The Stacks ecosystem has hundreds of dApps across various domains.

The extension:
- Does NOT read or collect browsing history
- Does NOT track user behavior across websites
- Does NOT inject content unless the user explicitly initiates a wallet connection
- Only responds to explicit wallet RPC requests from dApps
- Validates all request origins before processing
- Requires user confirmation for all transactions

The single purpose is wallet management and dApp connectivity. Without broad host access, users would be unable to connect to new or lesser-known dApps.
```

**Data Usage:**

| Data Type | Collected | Usage |
|-----------|-----------|-------|
| Mnemonic seed phrase | Local only | Encrypted with AES-256-GCM, stored in chrome.storage.local |
| Wallet addresses | Local only | Derived from seed, shared with dApps only on user approval |
| Transaction data | Not stored | Broadcast to blockchain, not retained |
| Browsing history | NO | Not accessed or collected |

**Remote Code:** No

**Privacy Policy URL:** `https://OWNER.github.io/stack-sats/privacy.html`

---

## Host Permissions Analysis

### Current Configuration

```json
"host_permissions": [
  "http://localhost/*",
  "http://127.0.0.1/*",
  "https://*/*",
  "https://api.hiro.so/*",
  "https://api.platform.hiro.so/*",
  "https://stacks-node-api.testnet.stacks.co/*",
  "https://stacks-node-api.mainnet.stacks.co/*"
]
```

### Risk Assessment

| Permission | Risk Level | Justification |
|------------|------------|---------------|
| localhost | Low | Development only |
| https://*/* | Medium | Required for dApp connectivity |
| api.hiro.so | Low | Official blockchain API |

### Why https://*/* is Necessary

1. **dApp Ecosystem:** Stacks dApps exist on hundreds of different domains
2. **User Expectation:** Users expect wallet to work on any dApp
3. **Competitive Parity:** Leather, Xverse use same pattern
4. **Technical Requirement:** Content script must inject on page load

### Alternative: Optional Permissions (NOT IMPLEMENTED)

Could use `optional_host_permissions` + `chrome.permissions.request()` to request access on-demand. However:

- **Pros:** Smaller initial permissions, better privacy perception
- **Cons:** Worse UX (permission prompt on every new site), complex implementation
- **Estimate:** 2-3 days of refactoring

**Recommendation:** Keep current approach, document thoroughly in Privacy tab.

---

## Pre-Submission Checklist

### Code & Build
- [ ] `pnpm build` succeeds without errors
- [ ] ZIP has manifest.json at root
- [ ] No console.log statements with sensitive data
- [ ] Version number updated in manifest.json

### Assets
- [ ] Icon 128x128 uploaded
- [ ] At least 1 screenshot (1280x800 or 640x400)
- [ ] Small promo tile 440x280
- [ ] All images are PNG or JPEG

### URLs (GitHub Pages)
- [ ] Homepage URL works
- [ ] Privacy Policy URL works
- [ ] Support URL works
- [ ] All NEEDS_INPUT placeholders replaced

### Privacy Tab
- [ ] Single purpose statement filled
- [ ] All permissions justified
- [ ] Host permissions explained
- [ ] Data usage declared
- [ ] Privacy Policy URL set

### Store Listing
- [ ] Extension name (max 45 chars)
- [ ] Summary (max 132 chars)
- [ ] Detailed description
- [ ] Category selected
- [ ] Language set

---

## Post-Submission

### Review Timeline
- Initial review: 1-3 business days
- If rejected: Fix issues and resubmit
- Appeals: Available if rejection is disputed

### Common Rejection Reasons
1. Missing privacy policy
2. Undeclared permissions
3. Misleading description
4. Broken functionality
5. Security vulnerabilities

### After Approval
1. Monitor reviews and ratings
2. Respond to user feedback
3. Update regularly
4. Keep privacy policy current
