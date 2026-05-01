# Support

**Stacks Wallet Browser Extension**

> **Public URL:** https://akawolfcito.github.io/stack-sats/support.html

## Getting Help

### Documentation

- [README](../README.md) - Installation and setup
- [Security](./SECURITY.md) - Security documentation
- [Privacy Policy](./PRIVACY_POLICY.md) - Data handling

### Issue Tracker

Report bugs and request features:
https://github.com/akawolfcito/stack-sats/issues

### Community

- Stacks Discord: https://discord.gg/stacks
- Stacks Forum: https://forum.stacks.org

## Frequently Asked Questions

### How do I create a wallet?

1. Click the extension icon
2. Click "Create New Wallet"
3. **Write down your 24-word seed phrase** (offline!)
4. Set a 6-digit PIN
5. Confirm your PIN

### How do I import an existing wallet?

1. Click the extension icon
2. Click "Import Existing Wallet"
3. Enter your 24-word seed phrase
4. Set a 6-digit PIN

### I forgot my PIN, what do I do?

Your PIN unlocks the encrypted seed phrase. If you forgot your PIN:

1. You'll need your original 24-word seed phrase
2. Click "Delete Wallet" to remove the current wallet
3. Import your wallet again using the seed phrase
4. Set a new PIN

**Important:** Without your seed phrase, you cannot recover your wallet.

### Why does the wallet auto-lock?

For security, the wallet automatically locks after 5 minutes of inactivity. This prevents unauthorized access if you leave your computer unattended.

### What networks are supported?

- **Mainnet** - Production Stacks network
- **Testnet** - Test network for development
- **Devnet** - Local development network

### How do I connect to a dApp?

1. Visit a Stacks dApp (e.g., on localhost or HTTPS)
2. Click "Connect Wallet" on the dApp
3. Approve the connection request in the wallet popup
4. Your addresses are now shared with the dApp

### Is my seed phrase safe?

Your seed phrase is:
- Encrypted with AES-256-GCM
- Protected by your 6-digit PIN
- Stored only locally on your device
- Never transmitted to any server

However, this is an educational wallet. For significant funds, use a production-grade wallet like Leather or Xverse.

### What permissions does the extension need?

| Permission | Why |
|------------|-----|
| Storage | Save your encrypted wallet |
| Scripting | Enable dApp connections |
| Tabs | Route messages to dApps |
| ActiveTab | Validate connection requests |
| SidePanel | Optional persistent view |

## Troubleshooting

### Extension not loading

1. Go to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked"
4. Select the `wallet-extension/dist` folder

### dApp connection not working

1. Verify you're on localhost or HTTPS
2. Check browser console for errors
3. Try refreshing the page
4. Reload the extension

### Transaction failed

1. Check you have enough STX for the amount + fee
2. Verify recipient address format
3. Ensure you're on the correct network
4. Check the blockchain explorer for status

### Balance not updating

1. Pull down to refresh
2. Check network connection
3. Verify correct network is selected
4. API may be temporarily unavailable

## Contact

- Email: wolfcito.learn+support@gmail.com
- Twitter/X: @wolfcito

---

*For security vulnerabilities, please see [SECURITY.md](./SECURITY.md)*
