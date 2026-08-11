# Pre-CWS E2E Review Plan — DenVault v1.1.0

**Date:** 2026-05-09 (revisado security-first)
**Goal:** Validar flujos E2E contra estándares existentes del ecosistema Stacks (no creamos normas) y confirmar que nuestra propuesta **security-first con UX que no fricciona** se sostiene antes de subir al Chrome Web Store.

## Filosofía de la revisión

1. **Adoptar, no inventar.** Cumplimos contra:
   - `@stacks/connect v8` (request/response shape)
   - WBIP (Wallet Best Practices)
   - SIP-030 (wallet integration)
   - SIP-018 (structured data signing)
   - JSON-RPC 2.0 envelope
   - BIP-39 (mnemonic 12/24)
   - Manifest V3 + CSP estricto

2. **Security-first, UX-driven.** Orden de prioridad innegociable:
   - **Seguridad** > **claridad** > **velocidad** > **estética**.
   - Si una mejora de UX reduce visibilidad de un riesgo (origen, post-conditions, fees, network mismatch), **se rechaza**.
   - Ganamos contra Leather/Xverse haciendo que **lo seguro sea también lo más fácil** (no escondiendo seguridad detrás de "advanced").

### ¿Qué es un "UX delta"?

Un **UX delta** es la diferencia medible (en clicks, segundos, decisiones, o claridad de información) entre el flujo en DenVault vs el mismo flujo en Leather o Xverse para un usuario nuevo.

Tipos de delta:
- **Delta de fricción**: clicks/segundos hasta completar tarea (menos = mejor).
- **Delta de claridad**: información de seguridad visible sin abrir submenús (más = mejor).
- **Delta de error**: cuántos pasos toma recuperarse de un error (menos = mejor).
- **Delta de confianza**: cuántas veces el usuario tiene que adivinar qué pasa (menos = mejor).

**Ejemplo concreto** (T2.2 conectar a dApp):
- Leather: dApp → click connect → popup → click "Approve" → click "OK" = **3 clicks, no muestra origen verificado, no muestra qué método se va a llamar después**
- DenVault objetivo: dApp → click connect → popup muestra **origen + favicon + lista de métodos que pedirá** → click "Connect" = **1 click, muestra todo lo que importa para decidir**

El delta no es "menos clicks" — es "menos clicks **y** más información de seguridad".

---

## Estado actual (cubierto)

| Área | Spec | Cobertura |
|---|---|---|
| Confirmation UI | `confirmation.approval.e2e.spec.ts` | ✅ |
| getAddresses + signMessage + transferStx (legacy popup) | `dapp-rpc.spec.ts` | ✅ |
| Send STX flow | `send-flow.spec.ts`, `tx-flow-guards.spec.ts` | ✅ |
| Wallet creation/import/unlock | `wallet-flows.spec.ts`, `entry-flow-guards.spec.ts` | ✅ |
| Home dashboard contract | `home.dashboard.e2e.spec.ts` | ✅ |
| Density / responsive | `density.spec.ts` | ✅ |
| Visual regression (golden) | `golden-*.spec.ts` | ✅ |
| DenSignal emit hooks | `denlabs-integration.spec.ts` | ✅ |
| ROI primitives | `v55-primitives.spec.ts` | ✅ |

---

## Gaps a cubrir antes del CWS submit

### Tier 0 — SEGURIDAD CRÍTICA (promovido por security-first)

> Antes era Tier 4 "compliance"; con security-first sube a Tier 0 porque es el **diferenciador**.

| # | Check | Cómo se prueba |
|---|---|---|
| T0.1 | No `eval` / `Function` / `importScripts` en bundle final | `grep -rE "eval\(\|new Function\|importScripts" dist/` → cero hits |
| T0.2 | No logs con mnemonic / PIN / private key / seed | Auditar todas las invocaciones de `console.*` y `secureLog` en bundle minificado |
| T0.3 | CSP estricto (sin `unsafe-eval`; solo `wasm-unsafe-eval`) | Leer `manifest.json` dentro del ZIP, comparar con baseline |
| T0.4 | Auto-lock dispara a 5 min de inactividad | E2E vitest con fake timer + verificar que mnemonic se borra de memoria |
| T0.5 | Brute-force lockout escalonado (30s→2m→10m→1h) tras N intentos fallidos | E2E que falla PIN N veces y verifica countdown UI + bloqueo persistente cross-reload |
| T0.6 | Origen de la dApp **siempre visible** en Confirmation (no truncado, con tooltip si es largo) | E2E con origen largo + visual regression |
| T0.7 | Network mismatch warning: si dApp pide mainnet pero wallet está en testnet, banner rojo bloqueante | E2E |
| T0.8 | Post-conditions de `stx_callContract` se renderizan legibles (no JSON crudo) | E2E con post-condition real de ALEX |
| T0.9 | Storage no se desborda con 5+ wallets, 20+ tokens, 100+ tx history | E2E con seed grande + medir bytes |
| T0.10 | Side-channel: el popup no expone mnemonic vía `chrome.storage` accesible por content scripts | Auditoría manual + test que content script intenta leer y falla |

### Tier 1 — COMPATIBILIDAD ESTÁNDAR (bloqueador funcional)

| # | Flow | Estándar | Por qué bloquea |
|---|---|---|---|
| T1.1 | `stx_signStructuredData` E2E con payload SIP-018 real | SIP-018 | Implementado, sin E2E. Si rompe, DEX/governance no funcionan |
| T1.2 | `stx_callContract` con post-conditions (ver también T0.8) | WBIP / SIP-005 | Crítico DeFi |
| T1.3 | `stx_deployContract` confirm + broadcast | SIP-030 | Devs lo prueban primero |
| T1.4 | Queue mode (no solo legacy popup) full content-script flow | WBIP | `dapp-rpc.spec.ts` solo cubre legacy popup |
| T1.5 | Carga unpacked en Chrome estable + Brave + Edge (smoke manual) | Manifest V3 | 5 min cada uno |
| T1.6 | Cambio de network mid-session refleja en getAddresses + Confirmation | SIP-030 | Falta E2E de cambio caliente |

### Tier 2 — UX DELTAS (security-aware)

> Reformulado: ya no buscamos "menos clicks por menos clicks". Buscamos **delta de claridad de seguridad** sin agregar fricción.

| # | Flow | Delta esperado vs Leather/Xverse | Métrica |
|---|---|---|---|
| T2.1 | Onboarding (instalar → crear → backup phrase → PIN → home) | DenVault muestra **fortaleza del PIN visualmente** y **forzar verificación de phrase** sin sentir tutorial pesado | Tiempo + comprensión |
| T2.2 | Conectar a dApp 1ª vez (consent screen) | Mostrar **origen + favicon + métodos que la dApp pedirá** (no solo "do you allow?") en 1 pantalla | # clicks + info visible |
| T2.3 | Recovery tras 3 PIN fallidos (issue #18) | **Countdown visible** + opción "import phrase to reset" sin perder UX | Sin reload manual |
| T2.4 | Account switcher (3+ cuentas) | Cambio < 1s **y** cada cuenta muestra address truncada + checksum visible | Latencia + claridad |
| T2.5 | Send STX: campo Memo, fee dinámica, network chip | Memo opcional con hint de "visible público en chain"; fee siempre visible antes de confirm | UX text + visibilidad |
| T2.6 | Error de red en transferStx | Toast con retry **explica si la TX se broadcasted o no** (no ambigüedad) | Mensaje exacto |
| T2.7 | Receive: copy address con QR | Feedback < 200ms **y** address completa visible (no truncada al copy) | Time-to-feedback |
| T2.8 | Side panel mode | Persiste sin re-unlock al cambiar de tab; lock manual con 1 click visible | Persistencia + lock |

### Tier 3 — COMPATIBILIDAD CON dApps REALES (smoke manual)

**Setup común:**
- Cargar DenVault como `unpacked` desde `dist/`
- Importar la **canonical test phrase** documentada en `internal-docs/test-phrase-v1.1.0.md` (ver sección "Canonical Test Phrase" más abajo). Esta phrase tiene **0 fondos en mainnet** (verificado) y **STX testnet vía faucet**.
- Network chip → Testnet por defecto. Para T3.2/T3.3/T3.4/T3.5/T3.7 conectamos a mainnet **en modo preview** (NUNCA firmar TX), seguros porque la address mainnet derivada tiene balance 0.
- DevTools abierto en Network + Console todo el tiempo
- Documentar: ✅ pass / ⚠️ warn / ❌ fail con screenshot + nota

**Criterio global de éxito:** 8/8 conectan sin errores de consola, address correcta, y `connect.stacks.com` ejecuta los 5 métodos RPC sin romper.

#### T3.1 — Hiro Explorer (`explorer.hiro.so`)
**Tipo:** infra / read-only
**Pasos:**
1. Abrir explorer.hiro.so
2. Click "Connect Wallet" (esquina sup. derecha)
3. Verificar que el popup de DenVault muestra origen `explorer.hiro.so` con favicon
4. Approve → verificar que el explorer muestra la address STX testnet de DenVault
5. Click "Disconnect" en explorer → verificar que DenVault no muestra sesión activa
**Pass criteria:** address coincide, origen visible, disconnect limpio.

#### T3.2 — ALEX (`app.alexlab.co`)
**Tipo:** DEX (mainnet, **no firmamos TX**)
**Pasos:**
1. Abrir app.alexlab.co (mainnet)
2. Connect wallet → DenVault popup
3. Approve → ALEX debe mostrar address mainnet
4. Abrir un swap STX → aBTC, ingresar 0.001 STX, hacer **preview** (NO firmar)
5. Cuando ALEX dispare `stx_callContract`, verificar en DenVault Confirmation:
   - Función contrato visible: `swap-helper`
   - **Post-conditions** legibles (no JSON crudo)
   - Fee dinámica visible
6. **Cancelar** (no firmar)
**Pass criteria:** post-conditions render legible, no error de consola, cancelar no rompe la sesión.

#### T3.3 — Arkadiko (`arkadiko.finance`)
**Tipo:** DeFi vaults
**Pasos:**
1. Abrir arkadiko.finance
2. Connect → Approve en DenVault
3. Verificar dashboard muestra address + balance USDA/STX
4. Abrir un vault existente (read-only) — si hay vaults dummy en testnet, mejor
5. Click "Create vault" → llenar datos → cuando dispare `stx_callContract`, verificar en DenVault:
   - Múltiples post-conditions (STX out, USDA in)
   - Origen + función contrato visibles
6. **Cancelar**
**Pass criteria:** multi-step contract call preview legible.

#### T3.4 — Bitflow (`app.bitflow.finance`)
**Tipo:** DEX / aggregator
**Pasos:**
1. Abrir app.bitflow.finance
2. Connect wallet
3. Verificar lista de pools carga sin error
4. Seleccionar pool STX/aeUSDC, ingresar amount
5. Disparar swap → verificar en DenVault Confirmation:
   - Función + contrato + post-conditions
6. **Cancelar**
**Pass criteria:** aggregator routing visible en Confirmation, no rompe con swaps multi-hop.

#### T3.5 — Velar (`app.velar.com`)
**Tipo:** DEX / perps
**Pasos:**
1. Abrir app.velar.com
2. Connect wallet
3. Abrir swap STX/USDh
4. Disparar swap → en DenVault verificar:
   - Provider list (Velar muestra varios providers para connect)
   - DenVault aparece como opción
   - Confirmation muestra contrato + post-conditions
5. **Cancelar**
**Pass criteria:** DenVault aparece en provider list de @stacks/connect, no es rechazado.

#### T3.6 — Lockstacks (`lockstacks.com`)
**Tipo:** Stacking / PoX
**Pasos:**
1. Abrir lockstacks.com
2. Connect wallet
3. Ver opciones de Stack/Delegate
4. Seleccionar "Stack independently" → llenar amount
5. Disparar `stx_callContract` (al `pox-4` contract) → verificar en DenVault:
   - Contrato `SP000000...pox-4` visible
   - Función `stack-stx` visible
   - Post-conditions de lock STX legibles
   - Cycles count visible si la dApp lo manda en function args
6. **Cancelar**
**Pass criteria:** PoX contract calls (alta sensibilidad de seguridad) muestran toda la info crítica.

#### T3.7 — Gamma (`gamma.io`)
**Tipo:** NFT marketplace (SIP-009)
**Pasos:**
1. Abrir gamma.io
2. Connect wallet
3. Ver perfil + cualquier NFT testnet asociado
4. Si hay opción de "list NFT" o "make offer" en testnet, disparar la firma:
   - Puede ser `stx_signStructuredData` (SIP-018) para offers off-chain
   - O `stx_callContract` para list on-chain
5. Verificar en DenVault Confirmation que el structured data es **legible** (no hex crudo)
6. **Cancelar**
**Pass criteria:** SIP-018 structured data se renderiza human-readable.

#### T3.8 — Stacks Connect Demo (`connect.stacks.com`) ⭐ BENCHMARK
**Tipo:** Reference dApp oficial
**Pasos (los 5 métodos):**
1. Abrir connect.stacks.com
2. Connect → DenVault popup → approve
3. **Método 1 — getAddresses:** verificar que la demo muestra BTC + STX addresses correctas
4. **Método 2 — stx_signMessage:** ingresar mensaje "hello denvault" → sign → DenVault muestra el mensaje literal en Confirmation → approve → demo verifica firma
5. **Método 3 — stx_signStructuredData (SIP-018):** ingresar payload estructurado → sign → DenVault renderiza campos legibles → approve → demo verifica
6. **Método 4 — stx_transferStx:** ingresar 0.0001 STX hacia la misma address (testnet) → DenVault muestra fee + post-conditions → approve → broadcast → verificar txid en Hiro Explorer testnet
7. **Método 5 — stx_callContract:** llamar a un contrato testnet de prueba → DenVault muestra función + args + post-conditions → approve → broadcast
**Pass criteria:** los 5 ejecutan sin error, las firmas verifican, los txids existen en explorer testnet.

> **Esta es la prueba más importante.** Si los 5 pasan en `connect.stacks.com`, las otras 7 dApps probablemente funcionarán por inercia.

---

## Recomendación de ejecución (revisada con security-first)

**Fase A — Imprescindible antes de subir** (~3-4 días):
- **T0.1 — T0.7** (todo Tier 0 excepto T0.9 y T0.10 que son hardening)
- **T1.1, T1.4, T1.5** (compatibilidad estándar)
- **T2.2, T2.3** promovidos a Fase A (consent screen + lockout recovery son **seguridad visible**)
- **T3.1, T3.2, T3.6, T3.8** (Hiro Explorer + ALEX + Lockstacks + Stacks Connect Demo — cubren read, swap con post-conditions, PoX y reference)

**Fase B — Nice-to-have, no bloquea CWS** (post-submit, antes de promover):
- T0.9, T0.10
- T1.2, T1.3, T1.6
- T2.1, T2.4–T2.8 (UX deltas restantes)
- T3.3, T3.4, T3.5, T3.7 (dApps secundarias)

**Fase C — Si sale rejection:** lo que el reviewer pida específicamente.

---

## Decisiones (resueltas 2026-05-09)

1. ✅ **T2.2 + T2.3 promovidos a Fase A** (consent screen claro + lockout recovery son seguridad visible).

2. ✅ **Fase A en Tier 3 = T3.1 + T3.2 + T3.6 + T3.8** (explorer/read, swap con post-conditions, PoX/staking, reference oficial).

3. ✅ **Reformulada — la frontera de seguridad NO es testnet vs mainnet**, es phrase-con-fondos vs phrase-sin-fondos. Una BIP-39 deriva ambas redes desde el mismo seed; el network chip solo cambia a qué chain consultas/transmites. Por lo tanto:
   - Usamos **una sola canonical test phrase** sin fondos mainnet (verificado en explorer)
   - Network chip por defecto: testnet
   - Los smokes mainnet (T3.2/T3.3/T3.4/T3.5/T3.7) son **modo preview** — nunca firmamos. Si por accidente se firmara, no hay nada que perder porque la address mainnet derivada tiene balance 0.

4. ✅ **Issue #18 (lockout recovery) es BLOQUEADOR** — se cierra antes del submit.

5. ✅ **Generamos canonical test phrase**: ver sección "Canonical Test Phrase" más abajo.

---

## Canonical Test Phrase (operativa)

**Qué es:** una BIP-39 phrase de 12 palabras dedicada al testing E2E manual de DenVault. Reutilizable entre sesiones y releases.

**Por qué importa:** con security-first, no queremos depender de phrases ad-hoc generadas en cada smoke (riesgo de filtración accidental, riesgo de mezclar con phrase real). Una phrase canónica documentada en `internal-docs/` (gitignored) elimina ese riesgo.

**Plan de generación (recomendado):**

1. Cargar DenVault como unpacked desde `dist/`
2. Click **"Create Wallet"** → guardar las 12 palabras
3. Crear archivo `internal-docs/test-phrase-v1.1.0.md` (ya gitignored) con:
   ```
   # Canonical Test Phrase — DenVault v1.1.0

   **Date generated:** YYYY-MM-DD
   **Source:** DenVault Create Wallet flow
   **Purpose:** E2E manual smokes, Tier 3 dApps testing

   ## Phrase
   word1 word2 word3 ... word12

   ## Derived addresses
   - STX mainnet (account 0): SP...
   - STX testnet (account 0): ST...
   - BTC mainnet (account 0): bc1...

   ## Verification (mainnet must be empty)
   - explorer.hiro.so/address/SP... → 0 TX, 0 STX → ✅ confirmed empty
   ```
4. Verificar la address STX mainnet derivada en https://explorer.hiro.so/ → debe mostrar **0 TX, 0 balance**. Si no, regenerar y repetir.
5. Network chip en DenVault → Testnet
6. Pedir STX testnet en https://explorer.hiro.so/sandbox/faucet?chain=testnet (envía a la address `ST...`)
7. Esperar 1-2 bloques, verificar balance > 0 en testnet
8. Listo — esta phrase queda como referencia oficial para Fase A y siguientes

**Reglas de uso:**
- ⛔ Nunca enviar fondos reales (mainnet) a esta phrase
- ⛔ Nunca compartir el archivo `test-phrase-v1.1.0.md` (verificar `git status` no la rastree)
- ⛔ No reusar entre máquinas físicas — si necesitas testear en otra máquina, regenera otra phrase y documenta `test-phrase-v1.1.0-machine-N.md`
- ✅ Reusable entre sesiones de Claude Code en la misma máquina
- ✅ Si se filtra accidentalmente: rotar (generar nueva, actualizar doc), sin pánico — no hay valor en juego

---

## Próximos pasos (post-aprobación)

1. Crear issues GitHub en `wolfcito/stack-sats` para cada item de Fase A
2. Branch `chore/pre-cws-e2e-hardening`
3. Implementar tests T1.1, T1.4, T0.4–T0.8 (los que requieren código nuevo)
4. Cerrar issue #18 (T2.3 / lockout recovery)
5. Ejecutar Tier 3 manual y documentar resultados aquí mismo (sección "Resultados Tier 3")
6. Si todo verde: subir al CWS dashboard usando `cws-submission-handoff.md`

## Resultados Tier 3 (a llenar durante ejecución)

| dApp | Fecha | Resultado | Notas | Screenshot |
|---|---|---|---|---|
| T3.1 Hiro Explorer | — | ⏳ | — | — |
| T3.2 ALEX | — | ⏳ | — | — |
| T3.3 Arkadiko | — | ⏳ | — | — |
| T3.4 Bitflow | — | ⏳ | — | — |
| T3.5 Velar | — | ⏳ | — | — |
| T3.6 Lockstacks | — | ⏳ | — | — |
| T3.7 Gamma | — | ⏳ | — | — |
| T3.8 Stacks Connect Demo | — | ⏳ | — | — |
