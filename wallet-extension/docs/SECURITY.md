# Security Documentation

**Stacks Wallet Browser Extension**
**Version:** 1.0.0

> **Homepage URL:** https://wolfcito.github.io/stack-sats/

## Security Model

### Threat Model

This wallet is designed to protect against:

1. **Unauthorized access** - PIN-based encryption prevents access without user password
2. **Memory exposure** - Sensitive data cleared from memory after use
3. **Malicious websites** - Origin validation and user confirmation for all transactions
4. **Rate limiting attacks** - 30 requests/minute limit per origin

### Known Limitations

> **EDUCATIONAL USE ONLY**
>
> This wallet is a demonstration/educational template. While it implements
> encryption best practices, it has NOT undergone a professional security audit.
>
> **Do NOT use with significant funds.**

## Encryption Architecture

### At-Rest Encryption

```
User PIN (6 digits)
       ↓
PBKDF2 (SHA-256, 100,000 iterations, random salt)
       ↓
AES-256-GCM Key
       ↓
Encrypt mnemonic → ciphertext + IV + salt
       ↓
Store in chrome.storage.local
```

### Key Derivation Parameters

| Parameter | Value |
|-----------|-------|
| Algorithm | PBKDF2 |
| Hash | SHA-256 |
| Iterations | 100,000 |
| Salt length | 16 bytes |
| Key length | 256 bits |

### Encryption Parameters

| Parameter | Value |
|-----------|-------|
| Algorithm | AES-GCM |
| Key length | 256 bits |
| IV length | 12 bytes |
| Auth tag | 128 bits |

## Session Security

### Auto-Lock

- Wallet auto-locks after **5 minutes** of inactivity
- Activity is tracked via mouse/keyboard events
- Lock clears mnemonic from memory immediately

### Failed Attempts

- Maximum **3 failed unlock attempts**
- Counter resets on successful unlock
- No permanent lockout (intentional for demo)

### Memory Handling

- Mnemonic only decrypted when needed
- Cleared from variables after signing
- `scheduleCleanup()` called on lock

## dApp Communication Security

### Message Flow

```
dApp → injection.js → content.js → background.js → popup
                                                    ↓
                                              User confirms
                                                    ↓
popup → chrome.tabs.sendMessage → content.js → dApp
```

### Protections

1. **Origin Validation**
   - Only HTTPS sites allowed (plus localhost for dev)
   - Origin checked before processing any request

2. **Rate Limiting**
   - 30 requests per minute per origin
   - Prevents spam attacks

3. **User Confirmation**
   - All transactions require explicit user approval
   - Request details shown before signing

4. **Restricted postMessage**
   - `targetOrigin` set to `window.location.origin`
   - Prevents cross-origin message interception

## Storage Security

### chrome.storage.local vs localStorage

| Aspect | chrome.storage.local | localStorage |
|--------|---------------------|--------------|
| Scope | Extension only | Domain-accessible |
| Persistence | Extension lifecycle | Until cleared |
| Size | 10MB+ | 5MB |
| API | Async | Sync |

The extension uses `chrome.storage.local` for all sensitive data.

### Data Stored

```json
{
  "wallet_vault": {
    "entries": [
      {
        "id": "wallet_xxx",
        "name": "Wallet 1",
        "encryptedData": {
          "ciphertext": "base64...",
          "iv": "base64...",
          "salt": "base64..."
        },
        "createdAt": 1234567890,
        "version": 1
      }
    ],
    "activeId": "wallet_xxx",
    "version": 1
  }
}
```

## Manifest Permissions

### Permissions Used

| Permission | Necessity | Justification |
|------------|-----------|---------------|
| `storage` | Required | Store encrypted wallet data |
| `scripting` | Required | Inject wallet provider |
| `tabs` | Required | Send responses to dApps |
| `activeTab` | Required | Validate request origins |
| `sidePanel` | Optional | Alternative UI mode |

### Host Permissions

| Pattern | Purpose |
|---------|---------|
| `http://localhost/*` | Development |
| `https://*/*` | Production dApps |
| `https://api.hiro.so/*` | Blockchain API |

## Reporting Vulnerabilities

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Contact us privately at: wolfcito.learn+security@gmail.com
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact

## Security Checklist for Users

- [ ] Keep your 24-word seed phrase offline and secure
- [ ] Never share your seed phrase with anyone
- [ ] Verify transaction details before confirming
- [ ] Check the URL of dApps you connect to
- [ ] Lock your wallet when not in use
- [ ] Keep your browser and extension updated

## Audit Status

| Audit Type | Status |
|------------|--------|
| Internal code review | Completed |
| External security audit | Not performed |
| Penetration testing | Not performed |

**Recommendation:** Request a professional audit before production use.

---

*Last updated: January 2025*
