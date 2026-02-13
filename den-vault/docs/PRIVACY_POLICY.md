# Privacy Policy

**DenVault - Stacks Wallet Browser Extension**
**Last Updated:** January 2025

> **Public URL:** https://wolfcito.github.io/stack-sats/privacy.html

## Overview

DenVault is a browser extension that enables users to manage Stacks blockchain wallets, view token balances, and authorize transactions for decentralized applications (dApps).

## Data Collection

**We do NOT collect, transmit, or store any personal data on external servers.**

All wallet data remains exclusively in your browser's local storage under your control.

## Data Storage

The following data is stored locally on your device using Chrome's secure storage API (`chrome.storage.local`):

| Data Type | Storage | Encryption |
|-----------|---------|------------|
| Mnemonic seed phrase | Local only | AES-256-GCM with PBKDF2 key derivation |
| Wallet addresses | Local only | Not encrypted (derived from seed) |
| Network preferences | Local only | Not encrypted |
| Transaction history | Not stored | Fetched on-demand from blockchain |

### Encryption Details

- **Algorithm:** AES-256-GCM (authenticated encryption)
- **Key Derivation:** PBKDF2 with SHA-256, 600,000 iterations (OWASP 2023)
- **Salt:** 16 bytes, cryptographically random per wallet
- **IV:** 12 bytes, cryptographically random per encryption

## External Communications

The extension communicates only with the following services:

| Service | Purpose | Data Sent |
|---------|---------|-----------|
| Hiro Stacks API (api.hiro.so) | Fetch blockchain data (balances, transactions) | Wallet addresses only |
| Stacks blockchain nodes | Broadcast signed transactions | Transaction data |

**No personal information is transmitted in these requests.**

## Permissions Used

| Permission | Purpose |
|------------|---------|
| `storage` | Store encrypted wallet data locally |
| `scripting` | Inject wallet provider for dApp communication |
| `tabs` | Route responses to requesting tabs |
| `activeTab` | Validate origin of connection requests |
| `sidePanel` | Provide persistent wallet view option |

## What We Do NOT Do

- We do NOT collect analytics or telemetry
- We do NOT track your browsing history
- We do NOT share any data with third parties
- We do NOT store your seed phrase on any server
- We do NOT have access to your wallet or funds

## Data Deletion

You can delete all wallet data at any time by:

1. Opening the extension
2. Going to Settings (menu icon)
3. Selecting "Delete Wallet"

This permanently removes all stored data from your browser.

## Security Recommendations

1. **Keep your seed phrase offline** - Write it down and store securely
2. **Use a strong PIN** - 6-digit PIN protects your wallet
3. **Lock your wallet** - Auto-locks after 5 minutes of inactivity
4. **Verify URLs** - Always check you're on the correct dApp

## Open Source

This extension is open source. You can review the code at:
https://github.com/wolfcito/stack-sats

## Contact

For privacy concerns or questions:
- Email: wolfcito.learn+privacy@gmail.com
- Support: https://wolfcito.github.io/stack-sats/support.html

## Changes to This Policy

We may update this Privacy Policy from time to time. Changes will be posted in the extension's documentation with an updated "Last Updated" date.

---

*This extension is provided by DenLabs. Use at your own risk.*
