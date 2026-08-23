# CWS Submit v1.1.4: guía lista para rellenar

**Item ID:** `npojbdkhjpgfkfjeagfcfhjchcnpkfek`. Sube al item existente. **Nunca crear un listing nuevo**: un duplicado es en sí una violación de política.
**Paquete:** `denvault-v1.1.4.zip`, en la raíz del repo. No subas 1.1.0, 1.1.1, 1.1.2 ni 1.1.3, que siguen en disco.

> Verificado el 2026-08-23 contra `main` (`8e492ef`, tag `v1.1.4`): **1298 unit en 85 ficheros con exit 0**, **27/27 e2e** contra la extensión real cargada, `type-check`, `lint` y `verify:production` 5/5, y el `manifest.json` dentro del ZIP es byte a byte el mismo que `public/manifest.json` (`60d4fe1d...4047a83`).
> El bloque equivalente de `docs/RELEASE.md` está **obsoleto**: justifica `tabs` y `api.platform.hiro.so`, eliminados en el PR #28.

Las secciones van en el orden en que aparecen en el menú lateral del dashboard. Cada bloque en ``` se pega tal cual.

---



## Paso 0: por qué te rechazaron, y por qué esta vez no

El dashboard dice **Version 1.0.0**, violation date **7-ene-2026**. Nunca revisaron la 1.1.0.

Esa 1.0.0 salió del commit inicial `36b7d6e` (23-dic-2025), cuando el proyecto se llamaba *Stacks-Wallet* y su manifest vivía en `wallet-extension/public/manifest.json`:

```json
"permissions": ["scripting", "tabs", "activeTab"],
"host_permissions": ["http://*/*", "https://*/*"]
```

`scripting` estaba y no se usaba. El rechazo era correcto. El commit `164728b` (1.0.1) ya lo había quitado, pero ese build nunca se subió y el draft quedó congelado en 1.0.0 durante un año.

**No apeles.** El manifest de 1.1.4 pide exactamente:

```json
"permissions": ["storage", "sidePanel", "clipboardRead"],
"host_permissions": ["https://api.hiro.so/*", "https://api.testnet.hiro.so/*"]
```

Los **tres** permisos y los dos hosts se usan, y hay tests que fallan si vuelve `scripting` o `tabs` (`src/test/manifest-permissions.test.ts`).

---



## 1 · Package

- [ ] **Upload new package** → `denvault-v1.1.4.zip`

Sube el ZIP antes que nada: hasta que el paquete no esté en 1.1.4, el resto del formulario describe una versión que ya no existe.

---



## 2 · Store listing



### Product details

**Name**: viene del paquete, no se edita. Debe leer `DenVault`.

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

**Category**: el dashboard tiene **Developer Tools**. Para una wallet de usuario final, **Productivity** te da mejor alcance. Ninguna de las dos es una violación; decídelo tú.

**Language**: `English (United States)`. Ya está puesto.

### Graphic assets

Todos en `denvault-extension/assets/store/`. `bash scripts/verify-store-assets.sh` da PASS en dimensiones y en ausencia de alfa.


| Campo del dashboard         | Archivo               | Acción              |
| --------------------------- | --------------------- | ------------------- |
| Store icon 128x128          | `icon_128.png`        | ya subido, no tocar |
| Global promo video          | n/a                   | ya puesto, no tocar |
| Screenshot 1                | `cws-01-start.png`    | **reemplazar**      |
| Screenshot 2                | `cws-02-home.png`     | **reemplazar**      |
| Screenshot 3                | `cws-03-send.png`     | subir               |
| Screenshot 4                | `cws-04-receive.png`  | subir               |
| Screenshot 5                | `cws-05-settings.png` | subir               |
| Small promo tile 440x280    | `promo_440x280.png`   | subir               |
| Marquee promo tile 1400x560 | `promo_1400x560.png`  | subir               |


- [ ] **Borra las 2 screenshots que ya están** y sube las 5 de `assets/store/`.
  Las 2 del dashboard son de mayo y llevan el pill de Vue DevTools encima de la UI; el checklist de entonces las dio por buenas y estaba mal. Las de agosto lo eliminan (`vite.config.ts` omite `vueDevTools()` bajo `VITE_UI_SNAPSHOT`) y fijan el saldo con `mockBalances()`, porque la dirección de prueba fue drenada en testnet y las cards salían con "Your balance is too low to send STX" en una pieza de marketing.

- [ ] Sube los 2 promo tiles.
  El 440x280 se regeneró el 2026-08-12: el dibujado a mano en febrero llevaba **canal alfa**, y este campo exige "24-bit PNG, no alpha", así que el dashboard habría rechazado la subida. Ahora sale del mismo spec que el marquee y `verify-store-assets.sh` falla si el alfa vuelve.



### Additional fields

**Official URL**: déjalo en `None`. Requiere verificar dominio en Search Console y no aporta nada aquí.

**Homepage URL**: el dashboard tiene el host viejo `wolfcito.`; la cuenta se renombró a `akawolfcito`. El redirect de GitHub no está bajo tu control y se rompe si alguien reclama el handle viejo.

```
https://akawolfcito.github.io/stack-sats/
```

**Support URL**

```
https://akawolfcito.github.io/stack-sats/support.html
```

**Mature content**: off.

---



## 3 · Privacy

**Privacy policy URL**

```
https://akawolfcito.github.io/stack-sats/privacy.html
```

**Single purpose**

```
DenVault lets people hold their own Stacks and Bitcoin keys in the browser: create or import a wallet, view balances and transaction history, send STX, BTC and SIP-10 tokens, and review and approve requests from Stacks dApps before anything is signed.
```

**Permission justification:** `storage`

```
Stores the encrypted wallet vault, network and display settings, and the unlocked session cache using chrome.storage.local and chrome.storage.session. The recovery phrase is encrypted with AES-256-GCM before it is written and is never transmitted anywhere.
```

**Permission justification:** `sidePanel`

```
Opens the wallet in Chrome's side panel so it stays visible while the user interacts with a dApp in the page. Used by chrome.sidePanel.open and chrome.sidePanel.setOptions in the extension's service worker.
```

**Permission justification:** `clipboardRead`

```
Lets the user paste into the four fields where typing by hand is the error-prone path: the recipient address when sending STX, the recipient address when sending Bitcoin, a SIP-10 contract identifier when adding a token, and a recovery phrase when importing an existing wallet. A mistyped blockchain address sends funds to the wrong place irreversibly, so paste is a safety feature here, not a convenience.

Reading happens only inside those four screens, in direct response to the user pressing a Paste button. The extension never reads the clipboard in the background, on page load, or from any web page. The clipboard contents are placed in the form field the user is looking at and are never transmitted.
```

**Host permission justification**

```
Host permissions are limited to the two public Stacks blockchain API endpoints:

- https://api.hiro.so/* for mainnet: balance and token queries, transaction history, broadcasting signed transactions
- https://api.testnet.hiro.so/* for the same queries on testnet

The wallet also holds Bitcoin, and reads Bitcoin balances, UTXOs and fee estimates from a public block explorer API, blockstream.info, falling back to mempool.space when it cannot be reached. Those are CORS requests and need no host permission, which is why they are not in the list above; they are declared here because the extension does contact them.

Every one of these calls carries only public blockchain addresses and signed transactions. No personal data, no recovery phrase and no private key is ever sent.

dApp connectivity does not use host permissions either. A declared content script relays standard WBIP/SIP-030 wallet RPC messages between the page and the extension; it does not read or modify page content.
```

**Remote code**: "No, I am not using remote code".

```
No. The extension executes no remote code. All scripts are bundled in the package, and the content security policy is script-src 'self' 'wasm-unsafe-eval'.
```

**Data usage**: no marques **nada**. La respuesta honesta es que no se recoge ningún dato:


| Tipo de dato                        | ¿Marcar? | Por qué                                                                       |
| ----------------------------------- | -------- | ----------------------------------------------------------------------------- |
| Personally identifiable information | No       |                                                                               |
| Health information                  | No       |                                                                               |
| Financial and payment information   | No       | Claves y frase se cifran y quedan solo en el dispositivo; nunca se transmiten |
| Authentication information          | No       | El PIN no se almacena ni sale del dispositivo, solo deriva la clave           |
| Personal communications             | No       |                                                                               |
| Location                            | No       |                                                                               |
| Web history                         | No       |                                                                               |
| User activity                       | No       |                                                                               |
| Website content                     | No       | El content script solo relaya mensajes RPC; no lee ni modifica el DOM         |


- [ ] Marca las **tres certificaciones** del final: no vender datos a terceros, no usarlos para fines ajenos al propósito único, no usarlos para solvencia crediticia ni préstamos. Las tres aplican.

---



## 4 · Distribution

Sin cambios. Visibilidad pública, todas las regiones.

---



## 5 · Test instructions

Un revisor que no sepa por dónde empezar es un rechazo evitable.

```
No account or login is required. The extension is self-contained.

To review:
1. Open the extension and choose "Create New Wallet".
2. Write down the recovery phrase and set a 6-digit PIN.
3. The wallet opens on the home screen showing a zero STX balance.
4. Use the network selector in the header to switch to Testnet.
5. "Receive" shows the address and a QR code. Testnet STX can be obtained
   from the Stacks Explorer sandbox at https://explorer.hiro.so/sandbox
   (connect the wallet, then use the Faucet tab), or from the public
   faucet at https://learnweb3.io/faucets/stacks/
6. "Send" walks through recipient, amount, fee and a PIN confirmation.
7. To review dApp connectivity, any Stacks dApp using @stacks/connect will
   detect DenVault through the WBIP provider registration.

To review the failed-PIN behaviour: lock the wallet, then enter a wrong PIN
three times. The keypad shows a countdown and re-enables itself when it
expires. No wallet reset is required.
```

---



## Checklist de envío

- [x] ~~Revisar el manifest de la versión rechazada~~. Resuelto en el Paso 0. No apelar.
- [ ] **Package**: subir `denvault-v1.1.4.zip`
- [ ] **Store listing**: pegar la Description
- [ ] **Store listing**: decidir categoría (Developer Tools vs Productivity)
- [ ] **Store listing**: borrar las 2 screenshots viejas y subir las 5 nuevas
- [ ] **Store listing**: subir Small promo tile y Marquee
- [ ] **Store listing**: Homepage y Support URL al host `akawolfcito`
- [ ] **Privacy**: Single purpose
- [ ] **Privacy**: justificación de `storage`, de `sidePanel`, de `clipboardRead` y de los 2 hosts, incluyendo el explorador de Bitcoin que se contacta por CORS
- [ ] **Privacy**: Remote code = No
- [ ] **Privacy**: Data usage sin marcar nada + las 3 certificaciones
- [ ] **Test instructions**: pegar el bloque
- [ ] **Submit for review**



## Después de enviar

- [ ] Borrar `denvault-v1.1.0.zip`, `denvault-v1.1.1.zip`, `denvault-v1.1.2.zip` y `denvault-v1.1.3.zip` de la raíz del repo
- [ ] Corregir el nombre en el issue [#3](https://github.com/akawolfcito/stack-sats/issues/3): aún dice "Stack-SATs", la marca es **DenVault**