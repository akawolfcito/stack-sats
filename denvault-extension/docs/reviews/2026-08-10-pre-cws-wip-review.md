# Pre-CWS — Revisión del WIP sin commitear

**Fecha:** 2026-08-10
**Objetivo:** determinar si el trabajo pendiente del 2-may está completo para empaquetar y subir al Chrome Web Store.
**Base:** `main` @ `472000e` + working tree sin commitear.

---

## 1. Verificación ejecutada (toda verde)

| Check | Comando | Resultado |
|---|---|---|
| Tipos | `pnpm type-check` | limpio, sin salida de error |
| Unit tests | `pnpm test` | **936/936** en 40 archivos |
| Contratos UI | `pnpm contract:check` | **160/160** |
| Build | `pnpm build` | ✓ en 5.37s |
| Hardening build | `pnpm verify:production` | PASS (1 warning, ver §4) |

Nota: la memoria del proyecto registraba 415 tests. El número real hoy es **936** — la suite creció con los PRs #17–#26 de mayo.

Los tests nuevos del WIP corren y pasan:
- `src/composables/useCanonicalRequest.test.ts` — 8 tests
- `src/test/background-queue.test.ts` — 9 tests

---

## 2. Qué hace el WIP (P0-3 + P1-4)

**Archivos nuevos**
- `src/composables/useCanonicalRequest.ts` — `fetchCanonicalRequest(requestId)` pide a background los params canónicos vía `GET_ACTIVE_REQUEST`. Devuelve `null` ante cualquier anomalía (sin id, sin `chrome`, `ok:false`, id que no coincide, canal roto, respuesta vacía). Los 8 tests cubren exactamente esos 8 caminos.

**Archivos modificados**
- `public/background.js` (+118/-8) — handler `handleGetActiveRequest` (valida que el id coincida con `activeRequest.id`), `notifyPopupResponseError` que emite `DAPP_RESPONSE_ERROR`, y validación de id en `handleDappApprove` / `handleDappReject` que ahora responden con error explícito en vez de un `console.warn` silencioso.
- `src/components/Confirmation.vue` (+62/-13) — en modo cola, `handleConfirm` busca los params canónicos y **firma contra esos bytes**; si no los consigue, aborta y rechaza en vez de firmar a ciegas. Se suscribe a `DAPP_RESPONSE_ERROR` con limpieza en `onBeforeUnmount`.

**Veredicto:** el WIP es trabajo sólido, coherente y bien testeado para lo que declara. Debe commitearse.

---

## 3. Huecos encontrados

### H1 — Divergencia entre lo que se muestra y lo que se firma (nuevo, no documentado)

La firma pasó a usar `signingPayload` (canónico), pero **toda la capa de display sigue leyendo `props.payload`**:

- `Confirmation.vue:116` — descripción del método
- `:121-154` — params renderizados (destinatario, monto, contrato)
- `:172, :196` — lógica de presentación
- `:535` — panel de payload crudo (`JSON.stringify(props.payload)`)

Bajo la amenaza exacta que este fix ataca (payload del popup mutado entre display y aprobación), el resultado es que **el usuario ve una cosa y firma otra**. Antes ambos venían de la misma fuente mutada; ahora la firma quedó protegida y el display no.

**Cierre propuesto:** traer el canónico en `onMounted` y renderizar desde él, dejando `props.payload` solo como fallback del modo legacy. Es la continuación natural del mismo fix.

### H2 — P0-3 queda parcialmente cerrado (el propio autor lo documentó)

Comentario textual en `background.js`:

> *"the popup still constructs the signed `result` (the mnemonic lives in the popup session)... Future hardening: move signing to the background so `activeRequest.params` becomes the only source of payload bytes."*

La garantía real que aporta el WIP es **anti-replay / anti-stale** (un approve viejo no puede secuestrar otro request), no integridad criptográfica extremo a extremo. El cierre completo es mover la firma al background: cambio arquitectónico, no apto para un sprint de salida.

### H3 — Issue #18 sigue sin arreglar

`src/views/UnlockView.vue:63` continúa mostrando `"Too many attempts. Reset wallet to continue."` y la línea `:124` deshabilita el input de forma terminal (`attemptsRemaining <= 0`). No hay countdown ni reenganche por timer, pese a que `LockoutManager` sí implementa la escalada 30s→2m→10m→1h.

El plan pre-CWS del 9-may lo marca **bloqueador explícito**. Es además el hueco con más probabilidad de que lo toque un reviewer de Google: fallar el PIN tres veces es lo primero que se prueba en una wallet, y hoy el único camino de salida es resetear la wallet.

### H4 — El WIP está sin commitear, sobre `main`, sin rama ni PR

Contradice la regla de trabajar siempre en feature branch. Riesgo real de pérdida: son ~180 líneas de código más dos specs que llevan 3 meses solo en disco.

---

## 4. Menor

`verify:production` reporta **3 `console.log` en `dist/`**, uno de ellos en `dist/background.js`. No filtra material sensible (el logger redacta mnemonic/PIN/privateKey), pero conviene limpiarlo antes de publicar.

---

## 5. Estado del artefacto

`denvault-v1.1.0.zip` en la raíz del repo es del **1-may** y no contiene nada de esto. **Hay que regenerarlo** con `pnpm release:zip` después de aplicar los cambios. No reutilizar ese ZIP.

Sobre P0-2 del audit (API key de Hiro en el bundle): **no aplica**. La key solo se usa en la rama `devnet` (`src/utils/balance/index.ts:22-32`), mainnet y testnet usan endpoints públicos sin credencial, y el ZIP no contiene ninguna ocurrencia de `v1/ext/`. La única mención de `api.platform.hiro.so` en el bundle está dentro del allowlist de hosts. Queda como tarea de proceso: un guard en `verify-production.sh` que falle si algún día se compila con una `.env` que traiga la key.

---

## 6. Camino propuesto al submit

| # | Tarea | Tipo |
|---|---|---|
| 1 | Rama `fix/pre-cws-p0-hardening` + commit del WIP tal cual (todo verde) | mecánico |
| 2 | H1 — renderizar el display desde el canónico | TDD, acotado |
| 3 | H3 — countdown de lockout y reenganche en `UnlockView` (cierra #18) | TDD, acotado |
| 4 | H4 menor — limpiar los `console.log` de `dist` + guard de la key en `verify-production.sh` | mecánico |
| 5 | `pnpm verify:production` + `pnpm release:zip` → ZIP nuevo | verificación |
| 6 | Subir al dashboard con el mapeo de `docs/handoff/cws-submission-handoff.md` | manual |

**En paralelo desde ya:** registrar la cuenta Google Developer ($5). Es el único paso cuya duración no controlamos y bloquea el punto 6.

**Se difiere con justificación escrita:** P0-1 (mnemonic en `SecureBuffer`) y H2 (firma en background). Ambos son arquitectónicos y van a v1.2.0.
