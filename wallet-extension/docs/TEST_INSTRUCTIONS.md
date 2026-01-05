# Test Instructions for Chrome Web Store Reviewers

**Stacks Wallet Browser Extension**
**Version:** 1.0.0

## Overview

This extension enables users to manage Stacks blockchain wallets, view balances, and authorize transactions for decentralized applications.

---

## Installation

1. Unzip the extension package
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the unzipped `dist` folder
6. The extension icon should appear in your toolbar

---

## Test Scenarios

### 1. Create New Wallet

**Steps:**
1. Click the extension icon to open popup
2. Click "Create New Wallet"
3. A 24-word seed phrase is displayed

**Expected Result:**
- 24 words displayed in a grid
- Warning message about backing up seed phrase

**Continue:**
4. Click "I've backed it up"
5. Enter wallet name (optional)
6. Click "Continue"
7. Enter 6-digit PIN (e.g., `123456`)
8. Click "Continue"
9. Re-enter the same PIN
10. Click "Create Wallet"

**Expected Result:**
- Wallet home screen displays
- STX address shown (starts with `ST` for testnet)
- BTC address shown
- Balance shows "0 STX"

---

### 2. Lock and Unlock Wallet

**Lock:**
1. Click menu icon (three dots)
2. Click "Lock Wallet"

**Expected Result:**
- Lock screen appears with PIN input

**Unlock:**
3. Enter your 6-digit PIN
4. Click "Unlock"

**Expected Result:**
- Returns to wallet home screen
- All data preserved

---

### 3. Import Wallet (Using Test Mnemonic)

> **Test Mnemonic (DO NOT USE FOR REAL FUNDS):**
> ```
> abandon abandon abandon abandon abandon abandon
> abandon abandon abandon abandon abandon about
> ```

**Steps:**
1. If wallet exists, delete it first (Menu → Delete Wallet)
2. Click "Import Existing Wallet"
3. Enter the test mnemonic above
4. Set a PIN (e.g., `654321`)
5. Confirm PIN

**Expected Result:**
- Wallet created with address: `ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM` (testnet)

---

### 4. View Balance (Requires Network)

**Steps:**
1. Ensure wallet is unlocked
2. Observe the STX balance on home screen

**Expected Result:**
- Balance fetched from Hiro API
- Shows "X STX" or "0 STX"
- Loading indicator while fetching

---

### 5. Switch Networks

**Steps:**
1. Click menu icon
2. Click "Settings"
3. Select network: Mainnet / Testnet / Devnet

**Expected Result:**
- Address prefix changes:
  - Mainnet: `SP...`
  - Testnet/Devnet: `ST...`
- Balance re-fetches for new network

---

### 6. View SIP-010 Tokens

**Steps:**
1. Ensure wallet is on Testnet with tokens
2. Scroll to "Tokens" section

**Expected Result:**
- Token list displays (if wallet has tokens)
- Token symbol, name, and balance shown
- Collapsible section

---

### 7. Send STX (Testnet Only)

> **Note:** Requires testnet STX. Get test tokens from faucet.

**Steps:**
1. Click "Send" button
2. Enter recipient: `ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG`
3. Enter amount: `1`
4. Click "Review & Send"
5. Enter PIN when prompted
6. Click "Confirm"

**Expected Result:**
- Transaction broadcasts
- Explorer link displayed
- "Transaction Sent" confirmation

---

### 8. Side Panel Mode

**Steps:**
1. Right-click the extension icon
2. Select "Open in side panel"

**Expected Result:**
- Wallet opens in Chrome's side panel
- All functionality works same as popup

---

### 9. dApp Connection (Requires Local Dev Server)

> **Note:** This test requires running the companion front-end app.

**Steps:**
1. Start front-end: `npm run dev:frontend` in the repo
2. Open `http://localhost:5173` in browser
3. Click "Connect Wallet" on the dApp
4. Approve connection in wallet popup
5. Enter PIN if locked

**Expected Result:**
- Popup shows connection request with origin
- After approval, dApp receives wallet addresses
- Subsequent requests auto-approve

---

### 10. Auto-Lock (5 minutes)

**Steps:**
1. Unlock wallet
2. Leave idle for 5+ minutes

**Expected Result:**
- Wallet automatically locks
- Lock screen appears on next interaction

---

### 11. Delete Wallet

**Steps:**
1. Click menu icon
2. Click "Delete Wallet"
3. Confirm deletion

**Expected Result:**
- All wallet data removed
- Returns to "Create/Import" screen
- No data in chrome.storage.local

---

## Validation Checklist

| Test | Pass/Fail |
|------|-----------|
| Create wallet | |
| Lock/unlock | |
| Import wallet | |
| View balance | |
| Switch networks | |
| View tokens | |
| Send STX | |
| Side panel | |
| dApp connect | |
| Auto-lock | |
| Delete wallet | |

---

## Notes for Reviewers

1. **Educational Purpose:** This wallet is a demonstration template for developers learning Stacks wallet development.

2. **Encryption:** All seed phrases are encrypted with AES-256-GCM before storage.

3. **No Analytics:** The extension does not collect or transmit any user data.

4. **API Calls:** Only blockchain API calls to fetch public data (balances, transactions).

5. **Permissions:** All permissions are necessary for core wallet functionality.

---

*For questions, contact: wolfcito.learn+testing@gmail.com*
