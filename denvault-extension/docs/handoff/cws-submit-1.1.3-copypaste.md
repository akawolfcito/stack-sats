# CWS Submit v1.1.3 — copy/paste

**Item ID:** `npojbdkhjpgfkfjeagfcfhjchcnpkfek` — sube al item existente. **Nunca crear un listing nuevo.**
**Paquete:** `denvault-v1.1.3.zip` (raíz del repo). No subas 1.1.0, 1.1.1 ni 1.1.2, que siguen en disco.

> Todo lo de abajo está verificado contra el código de `main` @ `2d3ffb7`, no copiado de docs previas.
> El bloque equivalente en `docs/RELEASE.md` está **obsoleto**: justifica `tabs` y `api.platform.hiro.so`, que se eliminaron en el PR #28.

---

## Paso 0 — antes de subir nada

Abre la pestaña **Package** y mira el `manifest.json` de la versión que Google revisó. Busca si aparece `scripting`. No está en ninguno de los 463 commits de este repo ni en el ZIP 1.1.0, así que si tampoco está ahí, fue un falso positivo del review automatizado y tienes caso para el formulario de apelación **además** del reenvío.

---

## Store listing

**Name**
```
DenVault
```

**Summary** (132 caracteres máx.)
```
Self-custodial Stacks (STX) and Bitcoin wallet with dApp support
```

**Description**
```
DenVault is a self-custodial wallet extension for the Stacks ecosystem, Bitcoin's layer 2.

Your keys stay on your device. The recovery phrase is encrypted with AES-256-GCM using a key derived from your PIN with PBKDF2 (600,000 iterations) and never leaves your browser.

What you can do:

• Create a new wallet or import an existing recovery phrase
• Send and receive STX, with QR codes and transaction history
• Send and receive Bitcoin, with automatic UTXO selection and fee estimation
• Add and transfer SIP-10 tokens
• Run multiple wallets, each with as many accounts as you need
• Switch between mainnet, testnet and devnet, or add a custom network
• Connect to Stacks dApps to sign messages, call contracts, sign SIP-018 structured data and deploy Clarity contracts
• Export an encrypted backup and restore it later
• Open the wallet in Chrome's side panel

Security:

• Recovery phrase encrypted at rest, never transmitted
• Six-digit PIN with automatic lock after 5 minutes of inactivity
• Escalating lockout after failed PIN attempts, with a visible countdown
• dApp requests are signed against the parameters held by the extension, not by the page, so what you review is what you sign

Open source: https://github.com/akawolfcito/stack-sats
```

**Category** — decide tú. El dashboard tiene **Developer Tools**; para una wallet de usuario final **Productivity** te da mejor alcance. No es una violación en ningún caso.

**Language**
```
English (United States)
```

---

## Additional fields

**Homepage URL** (el dashboard tiene el host viejo `wolfcito.` — cámbialo)
```
https://akawolfcito.github.io/stack-sats/
```

**Support URL**
```
https://akawolfcito.github.io/stack-sats/support.html
```

**Privacy policy URL**
```
https://akawolfcito.github.io/stack-sats/privacy.html
```

Ambas verificadas vivas el 2026-08-11.

---

## Privacy tab

**Single purpose**
```
DenVault lets people hold their own Stacks and Bitcoin keys in the browser: create or import a wallet, view balances and transaction history, send STX, BTC and SIP-10 tokens, and review and approve requests from Stacks dApps before anything is signed.
```

**Permission justifications** — solo hay dos permisos:

`storage`
```
Stores the encrypted wallet vault, network and display settings, and the unlocked session cache using chrome.storage.local and chrome.storage.session. The recovery phrase is encrypted with AES-256-GCM before it is written and is never transmitted anywhere.
```

`sidePanel`
```
Opens the wallet in Chrome's side panel so it stays visible while the user interacts with a dApp in the page. Used by chrome.sidePanel.open and chrome.sidePanel.setOptions in the extension's service worker.
```

**Host permission justification**
```
Host permissions are limited to the two public Stacks blockchain API endpoints the extension actually contacts:

- https://api.hiro.so/* — mainnet: balance and token queries, transaction history, broadcasting signed transactions
- https://api.testnet.hiro.so/* — the same, on testnet

These calls carry only public blockchain addresses and signed transactions. No personal data, no recovery phrase and no private key is ever sent.

dApp connectivity does not use host permissions. A declared content script relays standard WBIP/SIP-030 wallet RPC messages between the page and the extension; it does not read or modify page content.
```

**Remote code**
```
No. The extension executes no remote code. All scripts are bundled in the package, and the content security policy is script-src 'self' 'wasm-unsafe-eval'.
```

**Data usage** — marca lo que aplique. La respuesta honesta es que **no se recoge nada**:

| Tipo de dato | ¿Se recoge? | Nota |
|---|---|---|
| Información personal identificable | No | |
| Información de salud | No | |
| Información financiera y de pago | No | Las claves y la frase de recuperación se cifran y quedan **solo en el dispositivo**; nunca se transmiten |
| Autenticación | No | El PIN nunca sale del dispositivo y no se almacena, solo deriva la clave |
| Comunicaciones personales | No | |
| Ubicación | No | |
| Historial web | No | |
| Actividad de usuario | No | |
| Contenido del sitio web | No | El content script solo relaya mensajes RPC; no lee ni modifica el DOM |

Las tres certificaciones del final (no vender datos a terceros, no usarlos para fines ajenos al propósito único, no usarlos para solvencia crediticia ni préstamos) se pueden marcar las tres.

---

## Graphic assets

Todos en `denvault-extension/assets/store/`, verificados 8/8 con `bash scripts/verify-store-assets.sh`.

| Campo | Archivo | Estado en el dashboard |
|---|---|---|
| Store icon 128x128 | `icon_128.png` | ya subido |
| Screenshot 1 | `cws-01-start.png` | ya subido |
| Screenshot 2 | `cws-02-home.png` | ya subido |
| Screenshot 3 | `cws-03-send.png` | **falta** |
| Screenshot 4 | `cws-04-receive.png` | **falta** |
| Screenshot 5 | `cws-05-settings.png` | **falta** |
| Small promo tile 440x280 | `promo_440x280.png` | **falta** |
| Marquee promo tile 1400x560 | `promo_1400x560.png` | **falta** |

---

## Test instructions (pestaña Access)

Ponlo, porque un revisor que no sepa por dónde empezar es un rechazo evitable:

```
No account or login is required. The extension is self-contained.

To review:
1. Open the extension and choose "Create New Wallet".
2. Write down the recovery phrase and set a 6-digit PIN.
3. The wallet opens on the home screen showing a zero STX balance.
4. Use the network selector in the header to switch to Testnet.
5. "Receive" shows the address and a QR code. Testnet STX can be obtained
   from the public faucet at https://explorer.hyperledger.stacks.co/sandbox/faucet
6. "Send" walks through recipient, amount, fee and a PIN confirmation.
7. To review dApp connectivity, any Stacks dApp using @stacks/connect will
   detect DenVault through the WBIP provider registration.

To review the failed-PIN behaviour: lock the wallet, then enter a wrong PIN
three times. The keypad shows a countdown and re-enables itself when it
expires — no wallet reset is required.
```

---

## Checklist de envío

- [ ] Pestaña **Package**: revisar el manifest de la versión rechazada (`scripting`)
- [ ] Subir `denvault-v1.1.3.zip`
- [ ] Corregir Homepage y Support URL al host `akawolfcito`
- [ ] Subir las 3 screenshots que faltan + los 2 promo tiles
- [ ] Rellenar Single purpose, justificación de los 2 permisos y de los 2 hosts
- [ ] Marcar Data usage y las 3 certificaciones
- [ ] Pegar las Test instructions
- [ ] Decidir categoría (Developer Tools vs Productivity)
- [ ] Submit for review
