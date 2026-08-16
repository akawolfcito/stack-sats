# Smoke v1.1.3: hallazgos

Sesión del 2026-08-16, durante la pasada de pulido previa al envío a CWS.
Verificado contra `main` con los cambios de logo y assets ya aplicados.

---

## H1 · No se puede copiar la dirección desde el Home

**Severidad:** UX, alta frecuencia de uso.

La dirección truncada del header (`ST2NJ5K...QQWSJBQ`) vive dentro de `AccountSwitcher`. Al tocarla se abre el panel de cuentas, no se copia nada.

Copiar sí existe, pero solo en pantallas secundarias:

| Componente | Qué copia |
|---|---|
| `components/ReceiveModal.vue:150` | dirección activa |
| `components/account/AddressCard.vue:25` | dirección de la cuenta |
| `components/account/AddressQrModal.vue:47` | dirección del QR |
| `components/transaction/TxDetailRow.vue:18` | valores de detalle de tx |

O sea, para copiar tu propia dirección hay que abrir Receive. Es la acción más repetida de una wallet y está a dos toques, sin affordance en el sitio donde el usuario la está mirando.

**Propuesta:** hacer copiable la dirección del header, con feedback de "Copied". El componente de toast ya existe (`RecoveryPhraseDisplay.vue:236` usa `message="Copied to clipboard"`), así que es reutilizar, no construir.

---

## H2 · El side panel no tiene entrada desde la interfaz

**Severidad:** funcional, y además afecta al listing.

El handler existe y está completo, con fallback a pestaña completa:

- `public/background.js:398` define `handleOpenSidePanel()`
- `public/background.js:321` lo enruta bajo el mensaje `OPEN_SIDEPANEL`
- `public/manifest.json` declara `side_panel.default_path`

**Nadie envía ese mensaje.** `grep -rn "OPEN_SIDEPANEL" src/` no devuelve nada. El único botón del Home es `openFullPage()` (`views/UserHomeView.vue:523`), que abre pestaña completa, no panel lateral.

La función no es inalcanzable del todo: como el manifest declara `side_panel.default_path`, Chrome ofrece abrirlo desde su propia UI (clic derecho en el icono de la extensión). Pero no hay forma de llegar desde dentro de la wallet, y el propio autor del producto no la encontró durante el smoke. Si el que lo construyó no la ve, el usuario tampoco.

**Impacto en el envío:** la Description que se pega en el dashboard incluye el bullet:

```
• Open the wallet in Chrome's side panel
```

Y la justificación del permiso `sidePanel` dice que se usa vía `chrome.sidePanel.open`. Ambas cosas son técnicamente ciertas, pero el usuario no tiene botón. Conviene cerrar la brecha antes de enviar, no después.

**Propuesta:** añadir la acción al menú, junto a expandir a pantalla completa. El backend ya está hecho; falta un `chrome.runtime.sendMessage({ type: "OPEN_SIDEPANEL" })`.

---

## H3 · mempool.space no responde, y el fetch no tiene timeout

**Severidad:** BLOQUEANTE. Era un tema de redacción; el smoke lo convirtió en bug funcional.

### Medición

Desde esta máquina, el 2026-08-16:

| Host | Resultado |
|---|---|
| `api.hiro.so/extended/v1/status` | HTTP 301 en 0.30s |
| `blockstream.info/testnet/api/blocks/tip/height` | HTTP 200 en 0.41s |
| `mempool.space/testnet/api/blocks/tip/height` | **timeout a los 15s** |
| `mempool.space/api/blocks/tip/height` | **timeout a los 20s** |

No es la red local: blockstream.info responde en 0.4s y expone **la misma API Esplora**, con los mismos shapes de endpoint (`/address/:addr`, `/address/:addr/utxo`, `/fee-estimates`).

### El bug de fondo

Independientemente de qué host se use, `src/utils/bitcoin/balance.ts` y `transfer.ts` **no tienen `AbortController`, ni `setTimeout`, ni `signal`**. Un fetch que no responde deja la UI colgada de forma indefinida, sin spinner que termine, sin mensaje de error y sin reintento.

Esto es lo que hay que arreglar sí o sí. Cambiar de host sin poner timeout solo mueve el problema al día que el host nuevo falle.

### Opciones

1. **Timeout + estado de error** en las llamadas BTC. Obligatorio, sea cual sea el host.
2. **Cambiar a blockstream.info** como principal. Cambio casi directo por ser la misma API.
3. **Fallback en cadena**: intentar uno, y al fallar pasar al otro. Más robusto, más código.

La 1 no es negociable. La 2 o la 3 es decisión de producto.

### Lo que ya era cierto sobre el listing

`mempool.space` **no** está en `host_permissions`, y probablemente no lo necesita: su API envía CORS permisivo. Pero la justificación de hosts que se pega en el dashboard dice:

> Host permissions are limited to the two public Stacks blockchain API endpoints the extension **actually contacts**

La segunda mitad insinúa que son los únicos endpoints contactados, y no lo son. Si se cambia de host, hay que actualizar esa frase igual.

---

## H4 · El provider que ven las dApps lleva icono placeholder y un enlace 404

**Severidad:** alta. Es la cara de DenVault en cada dApp del ecosistema.

`public/injection.js:121-127` registra el provider WBIP004 así:

```js
window.wbip_providers.push({
  id: "DenVault",
  icon: "data:image/svg+xml;base64,...",
  name: "DenVault",
  webUrl: "https://github.com/denvault/denvault",
  methods: SUPPORTED_METHODS,
});
```

**El icono es un placeholder.** Decodificado:

```svg
<rect width="48" height="48" rx="24" fill="#5546FF"/>
<path d="M16 20H24M24 20V28M24 20L32 28M32 20L24 28" stroke="white" stroke-width="3"/>
```

Un círculo con el morado de Stacks y cuatro trazos blancos. Nunca fue el logo de DenVault. Está hardcodeado aquí, así que la migración de iconos no lo tocó.

**El `webUrl` está roto.** Comprobado el 2026-08-16:

| URL | HTTP |
|---|---|
| `github.com/denvault/denvault` (la registrada) | **404** |
| `github.com/akawolfcito/stack-sats` | 200 |
| `akawolfcito.github.io/stack-sats/` | 200 |

Ese `webUrl` es lo que el modal de conexión muestra como origen, por eso aparece "github.com" bajo el nombre. Cada dApp que liste DenVault publica un enlace muerto.

**Propuesta:** icono con el logo real como data URI, y `webUrl` a `https://akawolfcito.github.io/stack-sats/`, el mismo host que declara la Homepage URL del listing.

---

## H5 · Receive obliga a elegir Taproot o Legacy sin decir cuál

**Severidad:** UX, y afecta directamente al público objetivo.

En Receive con BTC el usuario elige entre dos pestañas, **Taproot** y **Legacy**, sin explicación. Por defecto viene Taproot. La dirección aparece truncada y el texto completo está detrás de "Show full".

El problema real: quien viene de Ethereum tiene un modelo mental de "una cuenta, una dirección". Bitcoin con varios formatos de dirección rompe eso, y la UI lo presenta como una elección técnica sin contexto ni recomendación.

Práctico: muchos faucets y servicios de testnet no aceptan direcciones Taproot. Al defaultear a Taproot, el camino más común para un principiante (pedir fondos a un faucet) es el que más probablemente falle.

**Patrones a considerar:**

1. **Defaultear al formato de mayor compatibilidad**, y dejar Taproot como opción.
2. **Etiquetar por propósito, no por protocolo.** "Recomendada" y "Compatibilidad con servicios antiguos" en vez de "Taproot" y "Legacy". El nombre técnico puede ir como subtítulo.
3. **Mostrar la dirección completa por defecto** en Receive. Es una pantalla dedicada a leerla y copiarla; esconderla tras "Show full" no ahorra nada útil.
4. **Una línea de ayuda** que diga cuándo usar cada una.

**Pendiente de verificar:** si `coinfaucet.eu/en/btc-testnet/` acepta `tb1p...` (Taproot) o solo formatos antiguos. Eso decide cuál debe ser el default.


El módulo de Bitcoin llama a mempool.space:

```
src/utils/bitcoin/balance.ts:15-17    mainnet | testnet | devnet
src/utils/bitcoin/transfer.ts:27-28   mainnet | testnet
```

`mempool.space` **no** está en `host_permissions`, y probablemente no necesita estarlo: su API envía CORS permisivo, así que el fetch funciona desde la página de extensión sin permiso de host. Desde el punto de vista de permisos, eso es bueno: menos superficie declarada.

El problema es de redacción. La justificación de hosts que se pega en el dashboard dice:

> Host permissions are limited to the two public Stacks blockchain API endpoints the extension **actually contacts**

La primera mitad es cierta (los host permissions son esos dos). La segunda insinúa que son los únicos endpoints contactados, y no lo son: al consultar saldo de BTC o construir una transacción, se contacta mempool.space con la dirección Bitcoin del usuario.

Esto importa por dos razones:

1. Un revisor que inspeccione tráfico verá un host no mencionado, justo en un item que ya viene de un rechazo por permisos.
2. En la sección **Data usage** la guía indica no marcar nada. Enviar la dirección BTC del usuario a un tercero merece al menos una revisión consciente de esa decisión, aunque sea un dato público de cadena.

**Pendiente de verificar en el smoke:** confirmar en DevTools → Network que la llamada a mempool.space sale sin error de CORS desde el popup. Si fallara, el saldo de BTC no cargaría y sería un bug funcional, no solo de redacción.

**Propuesta de redacción:** cambiar la frase por algo exacto, por ejemplo:

```
Host permissions are limited to the two public Stacks blockchain API endpoints
that require them. The extension also queries the public mempool.space API for
Bitcoin balances and fee estimates; that endpoint sends permissive CORS headers
and needs no host permission. All of these calls carry only public blockchain
addresses and signed transactions.
```

---

## H6 · El `id` del provider WBIP rompía Connect en cualquier dApp

**Severidad:** CRÍTICA. La conectividad con dApps, que el listing vende, crasheaba al pulsar Connect.

### Síntoma

En la consola de la dApp, al seleccionar DenVault en el modal:

```
Uncaught TypeError: Cannot use 'in' operator to search for
'signMultipleTransactions' in undefined
    at handleSelectProvider
```

### Causa

`@stacks/connect-ui` no trata `id` como un nombre. Lo resuelve como **ruta con puntos dentro de `window`** (`dist/collection/providers.js:42`):

```js
export const getProviderFromId = (id) => {
    return id?.split('.').reduce((acc, part) => acc?.[part], window);
};
```

Por eso Xverse se registra como `XverseProviders.StacksProvider`.

`injection.js` registraba `id: "DenVault"`, pero el objeto con `request()` vive en `window.StacksWallet`. Entonces `window["DenVault"]` daba `undefined`, y la sonda de capacidades de la librería (`"signMultipleTransactions" in provider`) lanzaba el TypeError.

Efecto: DenVault aparecía en el selector de toda dApp (los metadatos se leen del array `wbip_providers`) y **reventaba al seleccionarlo**.

### Arreglo

`id: "StacksWallet"`, que coincide con el global asignado tres líneas más arriba. `name: "DenVault"` sigue siendo lo que se muestra.

Guardado por `src/test/provider-registration.test.ts`, que replica `getProviderFromId` contra un window falso y falla si el id deja de resolver. El e2e `smoke.spec.ts` ahora busca el provider por `name` y afirma el `id` por separado.

---

## H7 · El popup de cola nunca recibe la petición, y la dApp expira

**Severidad:** CRÍTICA y ABIERTA. Descubierta al final de la sesión del 2026-08-16, sin arreglar.

### Evidencia

En `chrome://extensions` tras pulsar Connect en `explorer.hiro.so/sandbox/faucet`:

```
background.js:561  [StacksWallet] Origin not allowed: chrome-extension://bajigbjefnldfhoebgkldnnbnjbnjfpj
background.js:153  [StacksWallet] Request timed out: 30030b55-add8-4e1c-9b85-af18524812f3
```

Ese id de extensión es DenVault. Y la ventana de popup mostró la pantalla Home, con saldo y botones Send/Receive, en lugar de una pantalla de aprobación.

### Lo que está PROBADO, por flujo de control

```
554:  if (!sender.tab?.id || !originUrl) {
555:      console.error("Missing sender info");
556:      return;                                  <- sale aqui si NO hay tab
557:  }
560:  if (!isOriginAllowed(originUrl)) {
561:      console.error("Origin not allowed: ...") <- el log real
```

Para alcanzar la 561 hay que pasar la 554, y pasar la 554 exige `sender.tab.id`. Por tanto queda demostrado que llegó un mensaje **con `sender.tab.id`** y **origen `chrome-extension://`**, o sea desde una página de la propia extensión.

Eso falsa la premisa sobre la que se reparten los dos listeners de `background.js`:

- Listener 1, línea 289, atiende al popup con la guarda `if (sender.tab) return;`
- Listener 2, línea 550, atiende a dApps y rechaza cualquier origen que no sea localhost, 127.0.0.1 o https

El popup de cola se crea en `ensurePopupOpenOrFocus()` con `chrome.windows.create({ type: "popup" })`, es decir **una ventana con una pestaña real**. Sus mensajes llevan `sender.tab`, así que el listener 1 los descarta y el listener 2 los rechaza.

### Cadena de fallo, parcialmente inferida

1. La dApp pide conectarse y la petición se encola
2. El background abre el popup de cola
3. El popup envía `UI_READY`
4. Listener 1 lo ignora por tener `sender.tab`
5. Listener 2 lo rechaza por origen y loguea la 561
6. `uiReady` no pasa nunca a `true`
7. `sendToUI` guarda el `DAPP_REQUEST` en `pendingUIMessage` y no lo entrega
8. El popup muestra el Home, que es lo observado
9. A los 55s salta `Request timed out` en la línea 153

### Lo que NO está probado

- **Cuál mensaje concreto disparó el log.** Se asume `UI_READY` por ser el primero que envía el popup, pero pudo ser `GET_ACTIVE_REQUEST` u otro.
- **Que arreglar el enrutado repare el flujo completo.** Hay un eslabón roto demostrado; no está recorrida la cadena entera. El popup en `?mode=queue` nunca ha recibido un `DAPP_REQUEST`, así que su lógica está sin ejercitar.
- **Que el timeout provenga de esta causa.** Encaja con la cronología y con la captura, pero es correlación.

### Por qué los tests no lo vieron

`src/test/background-queue.test.ts:152-166` simula el popup así:

```
popupListener(message, { id: "denvault-test" }, sendResponse);
```

Sin `tab`, y con el comentario "the popup messages are routed by the first registered listener (no sender.tab)". El harness **copia la premisa equivocada**, así que el test la confirma en vez de cuestionarla. Arreglar H7 exige corregir también el harness.

### Dos caminos

1. **Parchear la heurística.** Listener 1 atiende lo que venga de `chrome-extension://${chrome.runtime.id}`, con pestaña o sin ella; listener 2 ignora en silencio ese mismo origen. Cambio pequeño.
2. **Unificar en un solo listener** con enrutado explícito por origen. Más cambio, pero elimina la clase de bug en vez de este caso concreto.

Decisión pendiente del usuario.

### Cómo se verifica de verdad

Ningún test propio lo prueba, porque los escribiría con la premisa ya corregida. La prueba es repetir el camino real: ir al faucet, pulsar Connect, y comprobar que aparece la pantalla de aprobación en lugar del Home.

---

## Errores de consola que NO son nuestros

Del mismo log, para no perseguirlos:

| Mensaje | Origen |
|---|---|
| `The resource <URL> was preloaded using link preload but not used` | La dApp (Next.js en Vercel). Sugerencia de rendimiento suya. |
| `JsonRpcError: User canceled the request` en `handleCloseModal` | `@stacks/connect`. Es lo que emite al cerrar el modal. Comportamiento esperado al cancelar, aunque lo loguee como error. |

---

## Resueltos en esta sesión

- Runes e Inscriptions fuera del Home. Siguen en `ASSETS_REGISTRY` con `available: false`.
- Desajuste `ordinals` vs `inscriptions` que rebotaba la fila de Inscriptions a `/user`.
- `balanceText: '0'` hardcodeado para activos que nunca se consultaban.
- Iconos y logo migrados, con alfa, optimizados.
- Placa y halo del logo neutralizados a azul mediante tokens `--color-mark-*`.
- Em-dashes eliminados del texto de cara al usuario. Regla 10 en `CLAUDE.md`.
