# DenVault — Scan de UX/producto y análisis de modelo de negocio

**Fecha:** 2026-08-11 · **Base:** `main` @ `1cd6eec`, v1.1.2
**Contexto:** proyecto de práctica. El valor está en la UI y la seguridad, no en vender un producto.
**Objetivo del scan:** no llevar problemas a Google, y decidir qué se arregla ahora vs. qué se difiere.

---

## 1. El arreglo del selector de cuentas

**Archivo:** `src/components/Confirmation.vue:41-46`

Hoy:

```ts
const selectedAccountIndex = ref(0);
const availableAccounts = ref<Array<{ index: number; label: string }>>([
  { index: 0, label: "Account 1" },
  { index: 1, label: "Account 2" },
  { index: 2, label: "Account 3" },
]);
```

Dos defectos independientes:

1. **Lista fija de 3.** El default real de cuentas es 5 y el máximo 100. Con 5 cuentas, las dos últimas no aparecen en el selector.
2. **Ignora la cuenta activa.** `UserHomeView` guarda `selected_account_index` en localStorage, pero la pantalla de aprobación arranca siempre en `0`. Ese índice se pasa tal cual a `handleTransferStx` / `handleCallContract` / etc. para derivar la clave privada.

**Consecuencia:** si operas en la cuenta 3 y llega una petición de una dApp, por defecto firma con la cuenta 1. El usuario ve "Account 1" en un desplegable que probablemente no mira, y firma con una identidad distinta a la que cree.

### Arreglo propuesto

Construir la lista desde el estado real, en `onMounted`:

```ts
import { getAccountCount, getAllAccountNames } from "@/utils/accounts/settings";

const ACCOUNT_STORAGE_KEY = "selected_account_index"; // mismo que UserHomeView

onMounted(async () => {
  const count = await getAccountCount();
  const names = await getAllAccountNames();
  availableAccounts.value = Array.from({ length: count }, (_, index) => ({
    index,
    label: names[index] ?? `Account ${index + 1}`,
  }));

  const stored = Number(localStorage.getItem(ACCOUNT_STORAGE_KEY));
  selectedAccountIndex.value =
    Number.isInteger(stored) && stored >= 0 && stored < count ? stored : 0;
});
```

Notas de implementación:

- Respeta los nombres personalizados que ya soporta `settings.ts` (`getAllAccountNames`), cosa que la lista fija no hacía.
- El clamp (`stored < count`) importa: si el usuario borró cuentas con `removeLastAccount`, el índice guardado puede quedar fuera de rango y derivaría una clave de una cuenta que ya no muestra la UI.
- **Extraer `ACCOUNT_STORAGE_KEY` a un módulo compartido.** Hoy la constante vive solo en `UserHomeView.vue:94`; duplicar el string en Confirmation es exactamente cómo se desincronizan después.
- Test primero: la lógica de "resolver cuenta activa con clamp" es pura y se testea sin montar el componente, igual que hicimos con `resolveDisplayPayload`.

**Esfuerzo:** bajo (~1h con tests). **Prioridad: alta** — es corrección, no cosmética.

---

## 2. La pregunta del millón: ¿5 cuentas por defecto o 1?

**Recomendación: 1.** Cambiar `DEFAULT_ACCOUNT_COUNT` de 5 a 1 (`src/utils/accounts/settings.ts:19`).

### Por qué 5 es un antipatrón aquí

**No es una decisión de producto, es un accidente.** Las 5 cuentas no aportan nada que el usuario haya pedido: son 4 direcciones vacías que tiene que aprender a ignorar. El coste es real y el beneficio es cero.

1. **Ruido en la decisión más delicada.** Un selector con 5 opciones idénticas ("Account 1..5"), todas en cero, en la pantalla donde se firma dinero. Cada opción extra es una forma más de firmar con la cuenta equivocada — que es justamente el bug del punto 1.

2. **Coste de arranque medible.** `generateInitialAccounts` deriva, por cada cuenta: clave privada BIP32, dirección STX, conversión c32→b58, y **una dirección Taproot P2TR** (`generateP2TR`, que inicializa `ecc` de bitcoinjs). Son 5 rondas de eso en cada desbloqueo en vez de 1. Y peor: la función deriva secuencialmente hasta `count` (`generateNewAccount` en cadena), así que el coste crece lineal.

3. **Contradice el modelo mental de HD wallets.** Una wallet jerárquica tiene infinitas cuentas por definición matemática; no "se crean", se derivan. Materializar 5 sugiere que hay 5 cosas reales, cuando en realidad hay una seed. Empezar en 1 y derivar bajo demanda es exactamente lo que hace el patrón.

4. **Es la convención.** MetaMask, Rabby y las wallets EVM en general arrancan con una cuenta y añades más a mano. *No pude verificar en la búsqueda el default exacto de Leather ni Xverse* (las wallets Stacks con las que compites directamente) — si esto va a ser una decisión de producto y no solo de higiene, vale la pena instalarlas y mirar.

### Sobre "agregar de a una"

Eso ya está bien y no lo tocaría: `addAccount()` suma `currentCount + 1` con tope de 100. Es el comportamiento correcto y coincide con lo que hace todo el mundo. El problema es solo el punto de partida.

**Esfuerzo:** trivial (una constante) + revisar que ninguna vista asuma ≥2 cuentas. **Prioridad: media.** No bloquea a Google; mejora la UI, que es donde está tu interés.

---

## 3. Scan: lo que encontré, por riesgo

### A1 — La wallet le miente a las dApps sobre lo que sabe hacer 🔴

`public/injection.js:9-21` publica 11 métodos en `SUPPORTED_METHODS`, que además expone como API pública en `window.StacksWallet.methods`. **Cuatro no están implementados**: `stx_transferSip10Ft`, `stx_signTransaction`, `signPsbt`, `sendTransfer` (`Confirmation.vue:354-364`, los cuatro `// TODO: implement`).

El recorrido completo del usuario hoy:

1. La dApp llama `signPsbt`. `injection.js` lo acepta porque está en la lista.
2. Se abre la pantalla de aprobación, y hasta muestra una etiqueta cuidada: **"Sign PSBT (Bitcoin)"** (`methodDescription`, línea 113).
3. El usuario mete el PIN y aprueba.
4. `result.status` nunca es `COMPLETE` → se responde **`-32603 Internal Error`**.

Es un callejón sin salida que pide el PIN antes de fallar. **Este es el hallazgo con más riesgo para el reenvío**: un revisor de Google que pruebe la integración con una dApp puede caer aquí, y "funcionalidad rota" es motivo de rechazo por sí solo — distinto y peor que el de permisos.

**Arreglo:** sacar los 4 métodos de `SUPPORTED_METHODS`. `injection.js` ya devuelve `Method X is not supported` (línea 39) de forma limpia e inmediata, sin abrir popup ni pedir PIN. Es borrar 4 líneas.

**Esfuerzo:** minutos. **Prioridad: alta, antes de reenviar.** Anunciar menos de lo que haces es correcto; anunciar de más es lo que rompe.

### A2 — Selector de cuentas 🔴

Ver sección 1. Mismo nivel de riesgo: firma con la cuenta equivocada.

### A3 — El precio en USD está muerto 🟡

`src/utils/prices/index.ts` está **completo y testeado** (`fetchPrices`, `microStxToUsd`, `formatUsd`, con caché y su `index.test.ts`). **Ninguna vista lo importa.** `UserHomeView.vue:110` tiene `const stxPriceUsd = ref(0); // TODO: Fetch from price API`.

Se nota en la screenshot de tienda: `94.67 STX` junto a `$0.00 USD`. Un saldo con valor cero al lado lee como wallet rota.

Hay una guarda (`if (stxPriceUsd.value === 0) return null`) que oculta el texto en algunos sitios, pero el pill de `$0.00 USD` igual aparece — vale la pena rastrear de dónde sale ese segundo camino.

**Arreglo:** cablear `fetchPrices()` en `UserHomeView`. El trabajo difícil ya está hecho.
**Esfuerzo:** bajo. **Prioridad: media** — es el defecto visual más visible que queda.

### A4 — "Coming soon" en Account Details 🟢

`AccountDetailsView.vue:317` — una función tras verificación de PIN, marcada como próximamente. Es secundaria, no está en el camino principal, y el checklist de mayo ya la evaluó como no bloqueante. **Dejar.**

### A5 — Biometría fantasma 🟢

`UnlockView.vue:72` — `showBiometricOption` retorna `false` fijo con un TODO de WebAuthn. Como nunca se muestra, no hay defecto visible para el usuario. Es deuda honesta. **Dejar.**

### A6 — 7 errores de lint preexistentes 🟢

`SendBtcView.vue` (4) y `utils/bitcoin/transfer.ts` (3), todos `no-unused-vars`. No afectan runtime. **Dejar**, o limpiar cuando toques esos archivos.

### Ya diferido con justificación escrita (de PR #27)

- **P0-1** — mnemonic como string JS inmutable en vez de `SecureBuffer`; recuperable del heap.
- **H2** — la firma se construye en el popup porque ahí vive el mnemonic. La garantía actual es anti-replay/anti-stale, no integridad criptográfica extremo a extremo.

Ambos son arquitectónicos. Para un proyecto de práctica que ya declara su modelo de amenaza por escrito, diferirlos es defendible.

### Orden sugerido

| # | Qué | Riesgo | Esfuerzo |
|---|---|---|---|
| 1 | A1 — quitar los 4 métodos no implementados | Alto (rechazo) | Minutos |
| 2 | A2 — selector de cuentas real + cuenta activa | Alto (firma equivocada) | ~1h |
| 3 | Sección 2 — default de cuentas a 1 | Bajo | Trivial |
| 4 | A3 — cablear precios | Bajo | Bajo |

Los cuatro caben en una sesión. Todo lo demás se difiere sin culpa.

---

## 4. ¿De qué viven MetaMask y Rabby?

Sí, tienen modelo de negocio, y es el mismo en los dos: **comisión sobre swaps que ocurren dentro de la wallet.**

### Los números

**MetaMask** cobra **0.875%** por swap (el rango citado va de 0.3% a 0.875% según el caso). Resultado: **$198.64M acumulados**, **~$52.94M anualizados**, con **30M de usuarios activos mensuales** y 143M de descargas. Su ingreso recurrente anual supera los $150M sumando Swaps y ConsenSys Staking. El 70.3% de las comisiones acumuladas vienen solo de Ethereum mainnet.

**Rabby** (de DeBank) cobra por swap y bridge dentro de la wallet: **~$94k en 30 días**, **~$3.95M anualizados**. El dato más útil para calibrar es su eficiencia: **$2.50 de ingreso por cada $1,000 de volumen** — deliberadamente barato, porque su público compara comisiones. En septiembre de 2025 añadieron Rabby Perps (futuros) como segunda vía. Notablemente, **no lanzaron token**: priorizan producto.

### Qué significa esto para DenVault

El patrón es claro y es el único que funciona a escala: **la wallet es gratis, el dinero está en el flujo de transacciones que pasa por ella.** No se cobra por custodiar; se cobra por enrutar.

Ahora la parte incómoda. A la tasa de Rabby —la más eficiente de las dos— **$1,000/mes de ingreso exigiría ~$400,000 de volumen mensual de swaps**. En Stacks, con la base de usuarios que tiene el ecosistema frente a EVM, eso no es un objetivo realista para una wallet nueva sin distribución. Y MetaMask no llegó a $52M por cobrar 0.875%, sino por tener 30 millones de usuarios: **el modelo no es el fee, es la distribución.** El fee solo monetiza distribución que ya existe.

Dicho eso, no creo que sea la pregunta correcta para este proyecto, y tú mismo diste la razón: esto es práctica, no un producto que quieras vender.

### Dónde sí veo "vida" para DenVault

Ordenado por relación esfuerzo/retorno real:

1. **Como pieza de portfolio, que ya es.** Una extensión con 958 tests, un red team documentado con hallazgos aceptados y diferidos por escrito, contratos de UI verificados en CI y un pipeline de release con guardas es más convincente que la mayoría de wallets en producción. Publicarla en CWS convierte "casi hecho" en "publicado", y ese es el retorno concreto que ya está a un paso.

2. **Como referencia del ecosistema Stacks.** Stacks tiene pocas wallets y poca documentación de implementación. Una wallet Manifest V3 limpia, con `@stacks/connect` v8 y WBIP/SIP-030 bien implementados, tiene valor como referencia para otros. Eso se capitaliza en reputación y en grants del ecosistema, no en fees. Encaja además con el mapa que ya tienes en `denlabs-os/funding-opportunities.md`.

3. **Grants antes que fees.** Aprendiste con Prezenti que el criterio suele exigir contratos propios desplegados. Los programas del propio ecosistema Stacks son otra categoría: ahí una wallet **es** infraestructura. Verificar el criterio de elegibilidad *antes* de redactar, que fue la lección de Prezenti.

4. **El fee de swap, solo si aparece volumen.** Es un `if`, no un plan. La arquitectura no te lo impide: si algún día hay flujo, se añade. No construyas para eso ahora.

Mi lectura: el modelo de negocio no es el cuello de botella. La distribución lo es, y la distribución empieza por estar publicado. Terminar el reenvío vale más que cualquier diseño de monetización que hagamos hoy.

---

## Fuentes

- [MetaMask hits 30 million MAU, $198.64 million cumulative revenue, 0.875% swap fee — Coinlaw](https://coinlaw.io/metamask-wallet-statistics/)
- [MetaMask Wallet Review 2026: Multichain Now, but Swaps Cost 0.875% — CryptoSlate](https://cryptoslate.com/crypto-wallets/metamask-review/)
- [MetaMask Wallet Fees & Revenue — DefiLlama](https://defillama.com/protocol/metamask-wallet)
- [Rabby Fees, Revenue & Volume — DefiLlama](https://defillama.com/protocol/rabby)
- [Rabby Wallet Review 2026 — CryptoSlate](https://cryptoslate.com/crypto-wallets/rabby-wallet-review/)
