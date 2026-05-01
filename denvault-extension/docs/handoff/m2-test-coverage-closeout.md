# M2 Test Coverage Closeout

**Date:** 2026-05-01
**Milestone:** Test Coverage — Production Ready
**Status:** Complete

## Estado final

- M2 Test Coverage: completo.
- #10 cerrada.
- #11 cerrada.
- #18 queda abierta como bug/UX separado: gap UI lockout.
- #3 Chrome Web Store submission queda desbloqueada.

## PRs entregadas

### PR #17 — Wallet flows

- Merge: squash `301b503`
- Cubrio:
  - wallet creation
  - wallet import
  - unlock success
  - failed PIN x3 terminal lockout
  - reset after lockout
- Decision de scope:
  - "wait lockout -> retry succeeds" excluido porque la UI actual no lo implementa.
  - Gap movido a #18.

### PR #19 — Send STX flow

- Merge: squash `3c60b1e`
- Cubrio:
  - send form render
  - invalid recipient
  - insufficient funds
  - confirm flow hasta PIN
  - full submit con txid mockeado
- Agrego helpers:
  - `e2e/helpers/storage.ts`
  - `e2e/helpers/wallet-setup.ts`
  - `e2e/helpers/network-mocks.ts`

### PR #20 — dApp RPC flow

- Merge: squash
- Cubrio:
  - getAddresses approval
  - stx_signMessage approval
  - stx_transferStx approval
  - deny/reject flow
- Agrego:
  - `e2e/fixtures/dapp-payloads.ts`
  - `e2e/helpers/snapshot-mode.ts`
  - `e2e/helpers/chrome-shim.ts`
  - `e2e/dapp-rpc.spec.ts`

## Tests verificados

- `pnpm type-check` limpio
- `wallet-flows + send-flow`: 10/10 passed
- `dapp-rpc`: 4/4 passed
- `wallet-flows + send-flow + dapp-rpc`: 14/14 passed
- Suite completa mantiene 17 fallos preexistentes no atribuibles a estas ramas
  (density, entry-flow-guards, tx-flow-guards, v55-primitives)

## Network safety

- No hay broadcast real en E2E.
- `mockStacksNetwork` cubre:
  - `/balances`
  - `/v2/accounts/*`
  - `/v2/fees/transaction`
  - `/v2/transactions`
  - `/extended/v1/tx/*`
- `blockUnmockedStacksHosts` evita escapes hacia Hiro/Stacks APIs reales.
- dApp RPC responses se observan via `chrome.tabs.sendMessage` shim que
  captura en `window.__rpcResponses`.

## Gaps conocidos

Tracked:

- #18 — Unlock UI does not recover from temporary lockout after failed PIN
  attempts.

No tracked / out of scope:

- queue mode `?mode=queue`
- content-script integration real
- service worker lifecycle
- selectores de UI sin `data-roi`:
  - ActionBar Send button en Home
  - Continue / Cancel / Confirm & Send / Reset Wallet (mitigado con
    `getByRole`)
  - Memo input en SendView
- extra RPC methods no testeados:
  - `stx_callContract`
  - `stx_signStructuredMessage`
  - `stx_deployContract`

## Estado para #3

#3 — Submit extension to Chrome Web Store queda desbloqueada.

Recomendacion: antes de publicar, hacer discovery/checklist especifico
de CWS:

- version
- manifest
- permisos
- build artifact
- screenshots
- descripcion
- privacy policy
- store listing
- remote code policy
- test evidence
- release notes
- rollback plan
