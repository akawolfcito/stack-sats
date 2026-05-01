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
cd den-vault
pnpm install
pnpm build
```

### Step 2: Create ZIP for Chrome Web Store

**IMPORTANT:** The ZIP must have `manifest.json` at the ROOT, not inside a folder.

```bash
# From den-vault directory
cd dist
zip -r ../denvault-v1.1.0.zip . -x "*.DS_Store"
```

### Step 3: Verify ZIP Structure

```bash
unzip -l denvault-v1.1.0.zip | head -10
```

**Expected output:**
```
Archive:  denvault-v1.1.0.zip
  Length      Date    Time    Name
---------  ---------- -----   ----
      459  01-04-2026 11:28   index.html
     4517  01-04-2026 11:28   background.js
     1408  01-04-2026 11:28   manifest.json  <-- Must be at root!
     ...
```

**If you see `den-vault/dist/manifest.json`, the ZIP is WRONG.**

### One-Liner Command

```bash
cd den-vault && pnpm build && cd dist && zip -r ../denvault-v1.1.0.zip . -x "*.DS_Store" && cd .. && unzip -l denvault-v1.1.0.zip | head -10
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

- **Homepage:** `https://akawolfcito.github.io/stack-sats/`
- **Privacy Policy:** `https://akawolfcito.github.io/stack-sats/privacy.html`
- **Support:** `https://akawolfcito.github.io/stack-sats/support.html`

---

## Chrome Web Store Dashboard

### Store Listing Tab

| Field | Value |
|-------|-------|
| Extension name | DenVault - Stacks Wallet |
| Summary | Non-custodial Stacks wallet with AES-256-GCM encryption. Manage STX, SIP-010 tokens, and connect to dApps on Bitcoin Layer 2. |
| Category | Productivity > Developer Tools |
| Language | English |

### Detailed Description

```
DenVault is a secure, non-custodial wallet for the Stacks blockchain — Bitcoin's Layer 2 for smart contracts.

Open-source and built with production-grade security. Independent project by DenLabs — not affiliated with Hiro or Stacks Foundation. Review the source code on GitHub before storing significant funds.

FEATURES:
• Create or import 12/24-word mnemonic seed phrases
• View STX and Bitcoin addresses derived from the same key
• Send STX tokens with transaction confirmation
• View SIP-010 fungible token balances
• Connect to dApps using @stacks/connect v8 standards
• Support for Mainnet, Testnet, and Devnet networks
• Chrome Side Panel mode for persistent access
• Encrypted backup and restore

SECURITY:
• AES-256-GCM encryption for seed phrase storage
• PBKDF2 key derivation with 600,000 iterations (OWASP 2023)
• 6-digit PIN with escalating brute-force lockout (30s → 2m → 10m → 1h)
• Auto-lock after 5 minutes of inactivity
• No data transmitted to external servers
• Strict Content Security Policy (CSP)

SUPPORTED METHODS (WBIP/SIP-030):
• stx_getAddresses - Get wallet addresses
• stx_transferStx - Transfer STX tokens
• stx_signMessage - Sign messages
• stx_signTransaction - Sign transactions
• stx_callContract - Call smart contracts

Built with Vue 3, TypeScript, and official Stacks.js libraries.
Source code: https://github.com/akawolfcito/stack-sats
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
| tabs | Send transaction responses back to the originating tab after user approves or rejects a request. |
| sidePanel | Provide optional persistent wallet view in Chrome's side panel for improved user experience. |

**Host Permission Justification:**

```
Host permissions are limited to official Stacks blockchain API endpoints:
- https://api.hiro.so/* — Mainnet blockchain API (balance queries, transaction broadcasts)
- https://api.testnet.hiro.so/* — Testnet blockchain API (for developers)
- https://api.platform.hiro.so/* — Hiro Platform API (enhanced queries)

All API calls are read-only balance queries or transaction broadcasts. No user data is sent to these APIs.

dApp connectivity is handled via content scripts (not host permissions), which inject a minimal relay script to enable standard WBIP wallet RPC communication. The content script does NOT access or modify page DOM/content.
```

**Data Usage:**

| Data Type | Collected | Usage |
|-----------|-----------|-------|
| Mnemonic seed phrase | Local only | Encrypted with AES-256-GCM + PBKDF2 (600k iterations), stored in chrome.storage.local |
| Wallet addresses | Local only | Derived from seed, shared with dApps only on user approval |
| Transaction data | Not stored | Broadcast to blockchain, not retained |
| Browsing history | NO | Not accessed or collected |

**Remote Code:** No

**Privacy Policy URL:** `https://akawolfcito.github.io/stack-sats/privacy.html`

---

## Host Permissions Analysis

### Current Configuration (v1.1.0)

```json
"host_permissions": [
  "https://api.hiro.so/*",
  "https://api.testnet.hiro.so/*",
  "https://api.platform.hiro.so/*"
]
```

### Risk Assessment

| Permission | Risk Level | Justification |
|------------|------------|---------------|
| api.hiro.so | Low | Official Stacks mainnet blockchain API |
| api.testnet.hiro.so | Low | Official Stacks testnet blockchain API |
| api.platform.hiro.so | Low | Hiro Platform API (enhanced queries) |

### dApp Connectivity

dApp connectivity is handled via `content_scripts` (not host permissions):

```json
"content_scripts": [{
  "matches": ["https://*/*"],
  "js": ["content.js"],
  "run_at": "document_start",
  "all_frames": false
}]
```

This is the same pattern used by Leather and Xverse wallets. The content script injects a minimal relay for WBIP wallet RPC communication without accessing or modifying page content.

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
