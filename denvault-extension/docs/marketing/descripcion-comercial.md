# DenVault: descripción comercial

> Documento de marketing. Toda afirmación aquí está verificada contra el código en `main` @ `86ed173` (v1.1.3).
> Antes de reutilizar cualquier bloque, lee la sección **Qué NO afirmar** al final.

---

## Una línea

**DenVault es la wallet self-custodial para Stacks, la capa 2 de Bitcoin, en tu navegador, con tus llaves en tu dispositivo.**

Variantes según el espacio:

| Contexto | Texto |
|---|---|
| Tagline (≤50 car.) | Tu wallet de Stacks. Tus llaves, tu dispositivo. |
| Chrome Web Store short (≤132 car.) | Wallet self-custodial para Stacks y Bitcoin. Frase de recuperación cifrada con AES-256-GCM, siempre en tu navegador. |
| Bio de redes | Wallet open-source para Stacks (L2 de Bitcoin). STX, BTC, tokens SIP-10 y dApps. Apache-2.0. |

---

## Pitch corto (párrafo)

DenVault es una extensión de navegador que te da control total sobre tus activos en Stacks, la capa 2 de Bitcoin. Creas o importas tu wallet, y la frase de recuperación se cifra con AES-256-GCM bajo una clave derivada de tu PIN. Nunca sale de tu navegador, nunca viaja a un servidor. Desde ahí envías y recibes STX y Bitcoin, gestionas tokens SIP-10, y te conectas a dApps de Stacks para firmar mensajes, llamar contratos y desplegar Clarity. Todo el código es abierto bajo Apache-2.0: puedes auditarlo antes de confiarle un solo satoshi.

---

## Pitch largo (para landing o store listing)

### El problema

Custodiar cripto significa elegir entre comodidad y control. Las wallets custodiadas son fáciles pero tus llaves son de otro. Las self-custodial te devuelven el control, pero muchas piden permisos amplios sobre tu navegación, dependen de servicios opacos, o son cajas negras que no puedes auditar.

### La propuesta

DenVault es self-custodial, open-source y de permisos mínimos. Se instala como extensión de Chrome (Manifest V3) y pide exactamente dos permisos (`storage` y `sidePanel`) más acceso a dos hosts de la API pública de Stacks. Nada de acceso a tus pestañas, nada de inyectar scripts en las páginas que visitas.

### Los pilares

**1 · Tus llaves no se mueven de tu dispositivo**
La frase de recuperación se cifra en reposo con AES-256-GCM. La clave se deriva de tu PIN de 6 dígitos con PBKDF2 a 600.000 iteraciones (recomendación OWASP 2023). Nunca se transmite.

**2 · Defensa en profundidad contra el acceso físico**
Bloqueo escalado tras intentos fallidos de PIN (30s → 2m → 10m → 1h). Auto-bloqueo tras 5 minutos de inactividad. Las llaves privadas se limpian de memoria inmediatamente después de firmar. Content Security Policy estricta en el manifest.

**3 · Bitcoin y Stacks en la misma wallet**
Direcciones Stacks (SP/ST), Bitcoin legacy (P2PKH) y Taproot (P2TR, compatible con Ordinals). Envío de BTC con selección automática de UTXOs y estimación de comisiones. Códigos QR para recibir en cualquiera de los tres formatos.

**4 · Multi-wallet de verdad**
Varias wallets con nombre propio, cada una con tantas cuentas derivadas como necesites. Cambio entre mainnet, testnet y devnet, o red personalizada.

**5 · Listo para dApps**
Conecta con aplicaciones del ecosistema Stacks para firmar mensajes, llamar contratos inteligentes, transferir STX, firmar datos estructurados SIP-018 y desplegar contratos Clarity. Implementa los estándares WBIP y SIP-030, y habla `@stacks/connect` v8.

**6 · Abierto y verificable**
Licencia Apache-2.0, código público. 997 tests unitarios y una suite end-to-end que corre contra la extensión real cargada en el navegador. Desarrollo independiente por DenLabs, sin afiliación con Hiro ni la Stacks Foundation.

---

## Tabla de funcionalidades (por beneficio)

| Lo que quieres hacer | Cómo lo resuelve DenVault |
|---|---|
| Empezar sin fricción | Crear wallet nueva o importar tu frase de recuperación existente |
| Mover STX | Envío y recepción con QR e historial de transacciones |
| Mover Bitcoin | Envío y recepción con selección de UTXOs y estimación de fee automáticas |
| Gestionar tokens | Añadir y transferir tokens SIP-10 |
| Separar contextos | Varias wallets, cada una con múltiples cuentas |
| Desarrollar y probar | Mainnet, testnet, devnet o red personalizada |
| Usar dApps | Firmar mensajes, llamar contratos, SIP-018, desplegar Clarity |
| No perder el acceso | Backup cifrado exportable y restaurable |
| Trabajar cómodo | Abrir la wallet en el panel lateral de Chrome |

---

## Diferenciadores frente a la competencia

1. **Permisos mínimos auditables.** Dos permisos y dos hosts. Hay tests que fallan el build si alguien reintroduce `scripting` o `tabs` (`src/test/manifest-permissions.test.ts`). No es una promesa de marketing: está en CI.
2. **Bitcoin nativo, no solo Stacks.** Taproot incluido y compatible con Ordinals.
3. **Parámetros de cifrado publicados.** AES-256-GCM + PBKDF2 600k está escrito y es verificable en el código, no escondido tras "seguridad de grado bancario".
4. **Open source real.** Apache-2.0, repo público, sin build propietario.

---

## Qué NO afirmar

Estas afirmaciones **no** están respaldadas por la v1.1.3 y no deben aparecer en ninguna copia comercial:

- ❌ **"Precios en fiat" / "valor de tu portafolio en USD".** El módulo `utils/prices/index.ts` existe pero está deliberadamente desconectado: llamaría a CoinGecko, lo que exigiría un host extra y declarar un tercero en privacidad. Diferido hasta la aprobación en la store.
- ❌ **"Integridad criptográfica extremo a extremo en la firma".** La garantía actual del flujo de firma es anti-replay / anti-stale. La firma se construye en el popup. Es una decisión arquitectónica documentada, diferida a v1.2.0 (PR #27).
- ❌ **"La frase de recuperación nunca está en memoria en claro".** Durante la sesión desbloqueada el mnemonic vive como string JS inmutable, recuperable del heap. Migrarlo a `SecureBuffer` está diferido a v1.2.0 (hallazgo P0-1, PR #27).
- ❌ **Cualquier afiliación con Hiro o la Stacks Foundation.** El README lo desmiente explícitamente y debe mantenerse el disclaimer.
- ⚠️ **"Balance en tiempo real"**: es refresco manual, no streaming. Usa "balance actualizable" o "consulta tu saldo cuando quieras".

---

## Enlaces oficiales

- Repo: https://github.com/akawolfcito/stack-sats
- Política de privacidad: https://akawolfcito.github.io/stack-sats/privacy.html
- Soporte: https://akawolfcito.github.io/stack-sats/support.html
- Licencia: Apache-2.0
